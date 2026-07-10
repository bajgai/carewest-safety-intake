# ADR-001 — Managed Identity Without a Static Web Apps Upgrade

Status: deployed and verified  
Date: 2026-07-10

## Context

The existing `carewestyyc` Azure Static Web App is on the Free plan. Live portal verification showed that attaching a managed identity to that resource requires Static Web Apps Standard. The owner explicitly declined that upgrade.

The public form still needs an identity-capable server boundary that can persist accepted reports to `carewestyycdata` and keep the downstream Power Automate callback out of browser code.

## Decision

Keep the Static Web App on Free and deploy a separate Azure Functions app on the Flex Consumption plan in Canada Central.

Use a user-assigned managed identity for deployment and runtime storage access. A user-assigned identity avoids coupling the workload identity lifecycle to one Function App and can be created by the Azure subscription owner without an Entra directory-admin role.

The browser calls the Function's public HTTPS endpoint directly. Configure Function App CORS with exact allowed origins only:

- `https://proud-beach-0b03f2b10.7.azurestaticapps.net`
- the live GitHub Pages origin during migration, if it remains active
- the final custom intake origin when available

Do not use `*` for production CORS.

## Target resources

| Resource | Proposed name | Purpose |
|---|---|---|
| User-assigned managed identity | `carewest-intake-api-mi` | Stable workload identity |
| Flex Consumption Function App | `carewest-intake-api-yyc` | `/api/report`, `/api/health`, retry worker |
| Function host storage | `cwintakefuncyyc` | Isolated Functions host and deployment artifacts |
| Deployment container | `function-releases` in `cwintakefuncyyc` | Identity-authenticated code package |
| Intake table | `SafetyIntakeOutbox` | Durable accepted reports and delivery state |
| Retry queue | `safety-intake-delivery` | Asynchronous downstream delivery |
| Poison queue | platform queue poison handling or explicit dead-letter table | Failed-message investigation |

## Least-privilege roles

Application-data assignments are scoped to `carewestyycdata`:

- Storage Queue Data Contributor — delivery and retry queues.
- Storage Table Data Contributor — intake/outbox and idempotency records.

The Functions host requires Storage Blob Data Owner on the separate `cwintakefuncyyc` host account. This broader host role is deliberately isolated from the safety-report data account.

Do not grant Owner, Contributor, Storage Account Contributor, or Storage Blob Data Owner to the workload identity.

## Request path

```text
Free Static Web App
  -> HTTPS POST to Flex Function /api/report
       -> validate and persist through managed identity
       -> enqueue delivery through managed identity
       -> return report ID
  -> queue-triggered Function worker
       -> call existing Power Automate flow server-side
       -> update delivery state
```

The HTTP function and worker share the same code deployment and identity. The API is public because reporters do not sign in, but downstream credentials remain server-side.

## Cost and operational characteristics

- No Static Web Apps plan upgrade.
- Flex Consumption can scale to zero and charges for executions and execution time after applicable monthly grants.
- Do not enable always-ready instances for the initial low-volume workload.
- A cold start is acceptable for this reporting workflow if the form communicates that submission can take several seconds.
- Configure a low maximum instance count and queue concurrency to protect Power Automate and SharePoint.

## Alternatives considered

### Static Web Apps Standard

Rejected by owner because it requires a paid SWA plan upgrade.

### Consumption Logic App with managed identity

Not selected as the public trust boundary. Its request-trigger callback is itself a bearer/SAS URL unless reporter authentication is required, and the Office 365/SharePoint managed connectors still normally require authenticated API connections. It does not remove the important delegated-connector dependency by itself.

### Azure Container Apps Consumption

Technically viable and supports managed identity and scale-to-zero. Rejected for the first release because it adds a container image, registry or image-distribution workflow, Container Apps environment, ingress, revision, and scaling configuration without adding value for this small HTTP/queue workload.

### Free App Service Web App

Not selected because the Free tier is intended for limited development/testing, has weaker operational characteristics, and offers no advantage over Functions Flex Consumption for an event-driven intake API.

### User-assigned identity directly on Static Web Apps Free

Not possible. The portal blocks the Static Web App Identity feature on the Free plan.

## Consequences

- The API uses a different origin because linking a bring-your-own Function backend to Static Web Apps also requires Standard.
- Exact CORS configuration becomes a required security control.
- The Function App, identity, deployment artifacts, and role assignments become additional Azure resources to operate.
- Microsoft 365 remains behind the temporary delegated Power Automate connections until tenant administrators approve the future `Sites.Selected` workload identity design.

## Deployment gates

- [x] Confirm the Azure resource names and pay-per-use Flex Consumption creation.
- [x] Verify the required resource providers are registered.
- [x] Create the identity before the Function App so deployment storage uses identity authentication from first deployment.
- [x] Verify role assignments by principal ID and storage-account scope.
- [x] Deploy without storage connection strings.
- [x] Verify exact allowed CORS origins by read-back.
- Test storage outage, duplicate submission, queue retry, downstream outage, and Forms fallback.
