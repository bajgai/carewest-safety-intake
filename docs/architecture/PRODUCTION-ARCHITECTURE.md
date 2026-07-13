# Carewest Safety Intake — Production Architecture

Status: operational hardening baseline  
Owner: Aramark Carewest operations  
Last reviewed: 2026-07-13

## Decision

Use the existing Azure Static Web App `carewestyyc` as the public intake surface and a separate Azure Functions Flex Consumption app as the managed-identity trust boundary. Persist an accepted submission to Azure Storage before attempting downstream delivery. Keep the existing Power Automate and SharePoint workflow as the temporary delivery and manager-review layer, and keep Microsoft Forms as an independent fallback. See [ADR-001](ADR-001-IDENTITY-WITHOUT-SWA-UPGRADE.md).

This is an operational pilot architecture. It does not become organization-owned production until the future approvals in this document are completed.

The development Power Platform environment now also contains the non-production
`Carewest Operations Intake` solution: five Dataverse tables, a published model-driven
app, and a disabled assignment-flow shell. This is the extensible internal-management
foundation, not a production cutover. The live Azure intake and existing downstream
workflow remain unchanged. See
[Extensible Azure + Power Platform intake architecture](EXTENSIBLE-INTAKE-ARCHITECTURE.md).

## Current Azure resources

| Resource | Purpose | Region / tier |
|---|---|---|
| `carewestyyc` Static Web App | Public form and `/api` boundary | Global, Free |
| `carewestyycdata` Storage account | Durable intake/outbox and retry state | Canada Central |
| `carewestyyc` resource group | Workload boundary | Azure subscription 1 |

The target API uses a user-assigned managed identity for Azure Storage access. Live verification on 2026-07-10 found that the current Static Web App Free plan blocks identity configuration, so the identity is attached to the separate Flex Consumption Function App instead. Do not add storage account keys or connection strings to application code or browser-delivered assets.

## Target request path

```text
QR / bajgai.cloud/safety
  -> Azure Static Web App
  -> HTTPS POST to the Flex Function /api/report endpoint
       1. validate the CONTRACT.json allowlists and field limits
       2. generate or resolve the idempotent report ID
       3. persist the submission with DeliveryStatus=Received
       4. call the existing Power Automate web-intake flow server-side
       5. record Delivered, PendingRetry, or Failed
  -> existing SharePoint register
  -> existing manager email and Flow 2 review/closure

Microsoft Forms -> existing Forms intake flow -> same SharePoint register
```

## Extensible intake direction

The target platform separates anonymous public intake from authenticated internal
operations:

```text
Public QR -> Azure web app/API/storage/monitoring
                       |
                       v
                governed integration
                       |
                       v
Internal users -> Power App/Dataverse/Power Automate
```

Each physical QR code will use a stable entry key. Azure resolves that key to one
active Site and Intake Program and applies the program's current template version.
The public client must not be allowed to choose trusted site, program, or routing
values directly. The current `/safety` route remains in service until the generic
`/q/{entryKey}` contract is implemented and verified.

## Required invariants

- `CONTRACT.json` is the string and routing contract. Unknown sites, report types, choices, and payload fields are rejected server-side.
- Durable storage succeeds before the API reports acceptance.
- A stable `submissionId` is the idempotency key. Replays return the original report ID and never create a second email or list item.
- The Power Automate callback URL and intake credential are server settings, never public JavaScript.
- The public API does not accept files or attachments.
- Logs contain report IDs and state transitions, not names or narrative payloads.
- Failed delivery does not delete the accepted report.
- Microsoft Forms remains available until a documented fallback drill succeeds.

## Storage model

Minimum outbox record:

| Field | Purpose |
|---|---|
| `PartitionKey` | Submission month or site code |
| `RowKey` | Report ID |
| `SubmissionId` | Idempotency lookup |
| `Payload` | Validated canonical JSON |
| `PayloadHash` | Integrity and duplicate comparison |
| `ReceivedAt` | UTC receipt time |
| `DeliveryStatus` | `Received`, `Delivered`, `PendingRetry`, `Failed`, `Reconciled` |
| `AttemptCount` | Delivery attempts |
| `LastAttemptAt` | UTC attempt time |
| `DownstreamReference` | SharePoint item or flow reference when known |
| `LastErrorCode` | Sanitized operational error; no payload text |

## Failure behaviour

| Failure | Required behaviour |
|---|---|
| Static site unavailable | Display/document Microsoft Forms fallback |
| API validation failure | Return a safe 4xx response; do not persist |
| Storage unavailable | Do not claim acceptance; direct reporter to fallback |
| Power Automate unavailable | Preserve record as `PendingRetry`; return report ID and delayed-delivery notice |
| SharePoint or email failure | Preserve record; alert operations; retry idempotently |
| Duplicate submission | Return original report ID; do not duplicate downstream work |
| Compromised downstream credential | Disable Azure-to-flow delivery, preserve intake, rotate credential, reconcile backlog |

## Deployment stages

### Stage 0 — foundation

- Restore the authoritative `carewest-safety-intake` source into this project.
- Adopt the security, privacy/retention, and incident-response documents beside this file.
- Deploy the API as an Azure Functions Flex Consumption app with a user-assigned managed identity while retaining the Static Web App Free plan as the public front end.
- Enable the chosen compute identity and grant storage data-plane roles only at `carewestyycdata` scope.

### Stage 1 — same-day application hardening

- Deploy the form to `carewestyyc`.
- Implement `/api/report` and `/api/health`.
- Persist before downstream delivery.
- Move the Power Automate callback and intake key to server settings.
- Run contract, duplicate, failure, cellular, and fallback tests.

### Stage 2 — approval-dependent production migration

- Move the SharePoint register to a Carewest-owned site.
- Import the `Carewest Operations Intake` solution into an IT-owned production Power
  Platform environment; do not promote the current Developer environment.
- Replace personal Power Platform connections with governed connection references,
  service identities, and corporate administrators.
- Obtain an approved workload identity with `Sites.Selected` access to only that site.
- Replace individual Outlook/SharePoint connector ownership.
- Approve the authoritative records schedule and configure Microsoft Purview.
- Assign business, privacy, security, technical, and disposition owners.
- Move the Azure resources to an IT-governed subscription if required.

## Acceptance gates

- Storage access works through managed identity with account keys absent from application configuration.
- An accepted test can survive a simulated downstream outage and later reconcile once.
- Duplicate submission testing produces one stored report, one SharePoint item, and one email.
- Logs and alerts contain no reporter name or narrative.
- Microsoft Forms fallback is reachable from the published fallback instructions.
- Rollback does not affect Forms Flow 1, manager-review Flow 2, or the existing register.
