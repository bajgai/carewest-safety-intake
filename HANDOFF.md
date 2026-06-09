# HANDOFF — finishing the Carewest Safety Intake pilot

Everything that can be automated is done. **One step needs a browser** (creating two OAuth
connections); the rest is `az`/`gh` commands you can run, or hand back to a fresh session.

`az` is already logged into tenant `b1519f0f-…` (re-login if >~8h:
`az login --tenant b1519f0f-2dbf-4e21-bf34-a686ce97588a --allow-no-subscriptions`).

---

## Step 1 — Create the two OAuth connections in the DEV env  ← the ONLY manual gate

The HTTP-trigger flow is premium, so it lives in the **Developer environment**
`c67b47bb-593f-e85f-8afb-a541c31aba17` (`PowerPagesDeveloper-052126-141619`). A flow there can
still write to the personal-site SharePoint list via its own connections — but those connections
must exist *in that env*, and connector OAuth consent has **no headless path**.

1. Go to <https://make.powerautomate.com> → top-right environment picker → **PowerPagesDeveloper-052126-141619**.
2. Left nav → **Connections** → **+ New connection**:
   - **SharePoint** — sign in as `bajgai-niranjan@aramark.ca`.
   - **Office 365 Outlook** — sign in as `bajgai-niranjan@aramark.ca`.
3. (Stay in this env for Step 2.)

## Step 2 — Create the flow shell (browser, ~30 s)

In the **same DEV env**: **+ Create → Instant cloud flow → skip trigger picker → search
"When an HTTP request is received" → Create**. Save once (top-right). This mints the flow and
its trigger URL. Copy the **flow ID** from the URL
(`make.powerautomate.com/environments/c67b47bb…/flows/<FLOW_ID>/…`).

> Why browser, not `az`: PATCHing an existing flow via `az rest` is proven; *creating* a new
> flow + minting the HTTP callback URL purely from `az rest` is not verified in this tenant.
> Create the shell in the UI, then let the script below PATCH in all the logic.

## Step 3 — PATCH the full logic + get the trigger URL (one command)

```bash
cd flow
./patch_flow.sh <FLOW_ID>
```
This auto-discovers the two connection ids you just created, regenerates
`flow-definition.json` with them, PATCHes the flow (routing Switch, Create-item with every
column, decision-ready email, CORS Response), and prints the **trigger POST URL**.

If `patch_flow.sh` can't fetch the callback URL, get it manually:
```bash
az rest --method POST --resource "https://service.flow.microsoft.com/" \
  --url "https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/c67b47bb-593f-e85f-8afb-a541c31aba17/flows/<FLOW_ID>/triggers/manual/listCallbackUrl?api-version=2016-11-01" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('response',{}).get('value') or json.load(sys.stdin).get('value'))"
```
(or just open the trigger card in the maker UI — the URL is shown there after save.)

## Step 4 — curl-test BEFORE touching the page

Routes Belcher → Ops, so no real manager is paged:
```bash
curl -i -X POST "<TRIGGER_URL>" -H "Content-Type: text/plain" --data '{
  "reportType":"Hazard","site":"Colonel Belcher","reporterName":"",
  "location":"TEST - delete me","description":"curl smoke test","urgency":"High",
  "areaSafeNow":"No - site manager help needed","evidenceAvailable":"No",
  "injuryFlag":"No","hazardCategory":"Housekeeping","helpNeeded":"",
  "honeypot":"","intakeKey":"cwsi-pilot-3f9aK2qLxR"}'
```
Expect `200` + `{"reportId":"HZ-…","status":"received"}`. Confirm a row appears in **Carewest
Hazard Reports** and a manager email arrives. Test the spam guard too — same body with
`"intakeKey":"wrong"` must return `{"status":"ok"}` and create **no** row.
**Delete the test row(s) afterward.**

## Step 5 — Wire the page + publish

Put the trigger URL into the form and push:
```bash
cd ..
sed -i '' 's#__REPLACE_WITH_FLOW_TRIGGER_URL__#<TRIGGER_URL>#' docs/index.html
git add docs/index.html && git commit -m "wire trigger URL" && git push
```
Load <https://bajgai.github.io/carewest-safety-intake/>, submit a test of each type, confirm
the row + email + the success screen shows the returned Report ID. Watch the browser console
for CORS errors (if the response can't be read, re-check the Response action's
`Access-Control-Allow-Origin: *`). **Delete all test rows.**

## Step 6 — QR + pilot
`qr/safety-intake-qr.png` already points at the Pages URL (decode-verified). Post it alongside
the existing Microsoft Forms QR (both write to the same register during the parallel pilot).
Test by phone on cellular (off corporate wifi) to prove public reach.

---

## The string contract (do not drift — see `CONTRACT.json`)
- **Sites** are exact: `Signal Point` (NOT "Signal Pointe"), `Nickle House`, etc. A mismatch
  falls through to the fallback/routing-review branch.
- **Report types** are exact: `Hazard`, `Incident`, `Maintenance`, `Feedback`,
  `Chemical/Product Issue`, `Cleaning Quality Concern`.
- **Choice columns** in the register only accept their listed values. The form emits those
  exact strings (hazard category, injury flag `Yes - tell supervisor now`, area-safe
  `No - site manager help needed`). The **only** mapped field is urgency: the form's
  4-point `Low/Medium/High/Emergency` → SharePoint `1 - Low / 2 - Medium / 3 - High /
  5 - Emergency` (done in the flow; `4 - Very high` is intentionally unused).

## Security notes (pilot)
- The trigger URL is **public** (it sits in `docs/index.html`). Protection is a honeypot +
  a shared key. The key (`cwsi-pilot-3f9aK2qLxR`) is sent in the JSON **body**, not an HTTP
  header — a custom header would trigger a CORS preflight the flow can't answer. It is a
  weak drive-by filter, **not** a real secret; anyone who reads the page source has it.
- Keep the DEV env alive (touch it ≥ every ~90 days) and **export the flow** periodically
  (`az rest GET …/flows/<id>?api-version=2016-11-01 > flow/flow-export-<date>.json`) so a
  dev-env cleanup never loses it.
- **Production note for IT:** to go live for real Carewest staff at scale, the ask is a
  **production Power Platform environment + a paid Power Automate plan** (HTTP trigger is
  premium) or **Power Pages**, plus a Carewest-owned SharePoint site (custody currently sits
  on a personal account — the redesign doc calls that the existential risk). The working
  pilot + the real register data are the business case.

## Rollback
Nothing here touches the live Microsoft Form, Flow 1, Flow 2, or the register schema. To stop
the pilot: turn the DEV-env flow off (or delete it) and take down the QR. The existing Forms
path is unaffected throughout.
