# Production Readiness Gate

Status: **NOT APPROVED FOR PRODUCTION**

Last reviewed: 2026-07-13

This is the release evidence register for the extensible Carewest intake platform. A
technical deployment is not production approval. Each gate requires a named corporate
owner, a durable evidence link, and an approval date before the production feature flag
or a real Cleaning Review QR entry point can be enabled.

| Gate | Status | Required owner | Evidence | Approval date |
|---|---|---|---|---|
| Managed solution imported into an IT-owned Power Platform environment | NOT APPROVED | Power Platform administrator | Target environment ID, import job, solution version, checker result | TBD |
| Azure subscription formally accepted or resources rebuilt in an IT-owned subscription | NOT APPROVED | Azure platform owner | Subscription decision, resource inventory, cost centre, support owner | TBD |
| Corporate administrators and non-person service identities assigned | NOT APPROVED | Azure and Power Platform administrators | RBAC export, Dataverse application users, break-glass procedure | TBD |
| Privacy review | NOT APPROVED | Privacy owner | Approved data fields, notice, access/correction route, risk assessment | TBD |
| Records and retention review | NOT APPROVED | Records/Legal owner | Approved retention schedule, disposition and legal-hold controls | TBD |
| Security review | NOT APPROVED | Security owner | Threat review, least-privilege evidence, monitoring and incident contacts | TBD |
| Business-owner acceptance | NOT APPROVED | Carewest/Aramark business owner | Pilot scope, service levels, escalation and fallback acceptance | TBD |
| Submission Assignment Notification uses an IT-owned Outlook connection reference | BLOCKED; FLOW OFF | Microsoft 365/Power Platform owner | Connection owner, connection reference binding, successful synthetic notification | TBD |
| One-site/one-program controlled pilot approved | NOT APPROVED | Business, Privacy, Records, Security, Technical owners | Signed pilot record and rollback window | TBD |
| Existing safety form remains published during pilot | TECHNICALLY VERIFIED | Technical owner | Existing `/safety` route and API health proof | N/A |
| Permanent QR artwork approved for printing/posting | NOT APPROVED; DO NOT PRINT | Business and site owner | Final redirect test, artwork version, site placement list | TBD |

## Activation rule

Production `CAREWEST_EXTENSIBLE_INTAKE_ENABLED` remains `false` until every gate above
is approved. The notification flow remains off until its Outlook connection is IT-owned.
After approval, activate exactly one governed Site and Intake Program, verify Dataverse
delivery, manager notification, reporting, monitoring and rollback, then approve the
permanent QR artwork. Keep the existing safety form available throughout the pilot.

## Evidence handling

Store approvals and exports in the IT-designated SharePoint/records location. This
repository may link to evidence but must not contain personal data, tokens, connection
secrets, downloaded tenant exports or sensitive screenshots.
