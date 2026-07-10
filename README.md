# Carewest Safety Intake — custom front-end (pilot)

> **Azure managed-identity path deployed 2026-07-10.** The Free Static Web App at
> `https://proud-beach-0b03f2b10.7.azurestaticapps.net` now submits to the Flex
> Consumption Function App `carewest-intake-api-yyc`. The API persists to Azure
> Storage through `carewest-intake-api-mi`, queues delivery, and invokes the existing
> Power Automate flow server-side. The Static Web App remains on the Free plan.

## Production-hardening documents

- [Production architecture](docs/architecture/PRODUCTION-ARCHITECTURE.md)
- [Managed identity without a Static Web Apps upgrade](docs/architecture/ADR-001-IDENTITY-WITHOUT-SWA-UPGRADE.md)
- [Security baseline](docs/governance/SECURITY-BASELINE.md)
- [Provisional retention, privacy, and records standard](docs/governance/RETENTION-PRIVACY-RECORDS.md)
- [Incident-response runbook](docs/runbooks/INCIDENT-RESPONSE.md)

The application source was restored from `bajgai/carewest-safety-intake` at commit `03d4c82c1ed3f27af8263c6104bd91ca17ae0b90`. The Azure-managed-identity and governance work in this directory supersedes the pilot-only security assumptions where the documents conflict.

A branded, plain-language **safety/hazard/maintenance/feedback intake form** hosted on
GitHub Pages. On submit it POSTs to a **Power Automate "When an HTTP request is received"**
flow that **reuses the existing Carewest Hazard Reports SharePoint register and the
manager-routing email** — so the front-end is custom and gorgeous while the whole back-end
workflow continues unchanged.

> **Pilot / non-production.** The flow runs in a free Power Platform *Developer* environment
> and writes to the register on a personal SharePoint site. This is a time-boxed pilot, not
> the production system. See `HANDOFF.md` → "Production note".

```
QR / link  →  GitHub Pages form (docs/index.html)
           →  fetch() POST, Content-Type: text/plain  (a CORS "simple request" → no preflight)
           →  Power Automate HTTP flow  (DEV env c67b47bb…, premium HTTP trigger)
                • parse JSON · honeypot + shared-secret guard · generate Report ID
                • Switch on site → manager email + site code
                • Create item in EXISTING list  Carewest Hazard Reports (8d84f7b5…)
                • Send manager email (urgency-first subject, Importance High for High/Emergency)
                • Response 200 {reportId} + Access-Control-Allow-Origin: *
           →  page shows success screen with the returned Report ID
Existing Flow 2 (manager review/close) keeps polling the same list, unchanged.
```

Microsoft Forms is **removed from the path** (you cannot POST into Forms from an external
page). The existing Forms QR can run in parallel during the pilot — both write to the same list.

## Repo layout
| Path | What |
|---|---|
| `docs/index.html` | The form. Fill `TRIGGER_URL` with the Flex Function report endpoint at deployment. |
| `docs/assets/` | Aramark FM brand assets. |
| `flow/build_http_flow.py` | Generates the Power Automate flow definition from `CONTRACT.json`. |
| `flow/flow-definition.json` | Generated PATCH/PUT body (connection ids are placeholders). |
| `flow/patch_flow.sh` | Discovers dev-env connections, fills + PATCHes the flow, prints the trigger URL. |
| `qr/` | QR generator + generated QR for the Pages URL. |
| `CONTRACT.json` | **Single source of truth** — every exact string the form/flow/SharePoint must agree on. |
| `HANDOFF.md` | The remaining manual step (create 2 OAuth connections) + the finish recipe + tests. |

## Status — LIVE (managed-identity path deployed 2026-07-10)
- [x] Azure Static Web App remains on the Free plan.
- [x] Flex Consumption API and queue worker deployed in Canada Central.
- [x] User-assigned identity has storage roles scoped separately for host and report data.
- [x] Public browser code contains no Power Automate callback or intake key.
- [x] Exact-origin CORS, API health, persistence, duplicate handling, queue delivery, Power Automate, SharePoint write, manager email, and report-ID pass-through verified live.
- [x] Live test rows removed from SharePoint after verification.
- [x] Form built (`docs/index.html`) — wired with the live trigger URL, validated, honeypot + shared-secret, exact backend strings.
- [x] Flow definition generated (`flow/flow-definition.json`, committed with connection placeholders).
- [x] GitHub Pages publishing this repo from `/docs`.
- [x] QR generated + decode-verified for the Pages URL.
- [x] **Two OAuth connections created** in the DEV env (SharePoint + Office 365 Outlook).
- [x] **Flow created + Started** in the DEV env (`Hazard Report - Web Intake (HTTP)`, flow id `7123164d-5555-5d63-2a79-f5ba344673a4`) and trigger URL wired into the form.
- [x] **Verified live end-to-end:** browser submit from the Pages origin → 200 → success screen with the returned Report ID (CORS read-back confirmed); register row created; manager email sent; run Succeeded with exactly one Response. Spam guard (wrong key / honeypot) → `{status:ok}`, no row, no email. All test rows deleted.
- [ ] Post the QR (`qr/`) at sites, alongside the existing Forms QR, and watch the register.

Pages URL: **https://bajgai.github.io/carewest-safety-intake/** · **the form is live and accepting reports.**
