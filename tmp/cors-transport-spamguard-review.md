# Carewest Safety Intake — CORS / Transport / Spam Guard verification (2026-06-08)

Reviewed: CONTRACT.json, docs/index.html, flow/build_http_flow.py, flow/flow-definition.json
Refs: tmp/hazard-report-work-2026-06-08/{flow1-live-final, sharepoint-fields-after}.json

## 1. Content-Type text/plain, no custom headers — PASS
docs/index.html onSubmit fetch (line 539-543): method POST, headers `{'Content-Type':'text/plain'}` only,
body JSON.stringify(payload). No Authorization / X-* header. Simple CORS request, no preflight. Matches
CONTRACT.cors.requestContentType. The HTTP trigger has no OPTIONS handler, so this is required and correct.

## 2. INTAKE_KEY in body, both sides agree — PASS
Historical form: INTAKE_KEY was a public pilot value, placed in payload.intakeKey in the body rather than a header.
Flow generator build_http_flow.py previously hard-coded the same public pilot value. Generated flow-definition.json
Condition_spam_guard compares to literal "cwsi-pilot-3f9aK2qLxR" (line 116). Same value, body-based. Good.

## 3. Access-Control-Allow-Origin: * on all response paths — PASS as stated, BUT see Finding A
Response_success (464-465), Response_pending (508-509), Response_spam (533-535) all set ACAO:*. All three
literally carry the header. However the response WIRING is broken (Finding A).

## 4. Honeypot + intakeKey spam guard — PASS
Condition_spam_guard (line 103): If AND of:
  - empty(trim(coalesce(honeypot,''))) == true
  - trim(coalesce(intakeKey,'')) matched the historical public pilot value
True branch = Create_list_item + Send_email_to_manager + (failure email) + responses.
Else branch = ONLY Response_spam {status:"ok"}, ACAO:*. No SharePoint write, no email.
So a bot (honeypot filled OR wrong/missing key) gets a bland 200 {status:"ok"} and creates no row, sends no
email. The `equals(empty(...),true)` boolean compare is correct (boolean-to-boolean, no coercion bug).
Form also short-circuits client-side: if honeypot filled, fakes success and sends nothing (line 529-531).

## 5. Placeholder TRIGGER_URL handled gracefully — PASS
TRIGGER_URL = "__REPLACE_WITH_FLOW_TRIGGER_URL__" (line 159). onSubmit checks
`TRIGGER_URL.indexOf('__REPLACE')===0` (line 532) BEFORE fetch and shows the "not connected yet" banner,
never POSTing to a bogus URL.

---

## Finding A (HIGH) — Both Response actions fire on every non-spam submission; runs fail
flow-definition.json + build_http_flow.py generator (lines ~271/286/295).

runAfter wiring:
- Response_success  runAfter Send_email_to_manager: [Succeeded, Failed, Skipped]
- Send_email_failure runAfter Create_list_item: [Failed, TimedOut]
- Response_pending  runAfter Send_email_failure: [Succeeded, Failed, Skipped]

Happy path (Create_list_item Succeeds):
  Send_email_to_manager Succeeds -> Response_success runs.
  Send_email_failure is SKIPPED (Create_list_item didn't Fail/TimeOut).
  Response_pending runAfter includes "Skipped" -> Response_pending ALSO runs.
Failure path (Create_list_item Fails):
  Send_email_to_manager SKIPPED -> Response_success runAfter includes "Skipped" -> fires anyway.
  Send_email_failure runs -> Response_pending runs.
=> Both Response actions become eligible on EVERY submission, in parallel branches.

Consequences:
  1. Two Response/Http actions -> first to complete answers the caller; the second errors
     "a response has already been sent" -> the run is marked FAILED on every legitimate submission.
     Noise + masks real failures, and the live flow pattern has flowFailureAlertSubscribed.
  2. The shorter branch (Response_pending via the skipped failure email) often wins the race, so a
     SUCCESSFUL write can return status:"pending". Page only reads reportId (present in both) so the user
     still sees success, but flow semantics are inverted and the run fails.

Fix (in the generator, then regenerate flow-definition.json): make the two responses mutually exclusive so
exactly one runs. Recommended: wrap Create_list_item + Compose_email_body + Send_email_to_manager in a Scope;
Response_success runAfter Scope [Succeeded]; Send_email_failure + Response_pending runAfter Scope
[Failed, TimedOut]. Do NOT merely drop "Skipped" from the runAfters — that leaves a no-response hole when the
manager email fails after a successful write.

## Finding B (LOW) — Non-JSON body -> no Response action -> default 202 with no ACAO
Compose_payload = @json(triggerBody()) throws on a non-JSON body. Compose_payload fails ->
Condition_spam_guard (runAfter Compose_payload:[Succeeded]) is Skipped -> no Response action runs ->
trigger returns default 202 with no ACAO header. Irrelevant to the real form (always valid JSON) and to bots
(don't read CORS), but worth a defensive note. Optionally guard with a JSON-validity check or trigger schema.
