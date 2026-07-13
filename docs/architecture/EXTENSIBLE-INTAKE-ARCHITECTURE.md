# Extensible Azure + Power Platform Intake Architecture

Status: guarded Azure API and public QR frontend deployed; production integration disabled
Owner: Aramark Carewest operations
Last reviewed: 2026-07-13

## Decision

Use Azure for anonymous public intake and Power Platform for authenticated internal
configuration and case management:

```text
Power Platform environment
  -> model-driven Power App
  -> Dataverse
  -> Power Automate

Azure subscription
  -> public website
  -> API and stable QR resolution
  -> durable storage/outbox
  -> monitoring and retry
```

This is one configuration-driven intake platform, not a separate app for each
housekeeping process. Safety Report and Cleaning Review are the first Intake Programs.
Maintenance, feedback, inventory, and inspections can be added as configuration plus
versioned templates.

The existing Azure safety form remains the authoritative path while this foundation is
validated. No production reports are sent to the Developer environment.

## Guarded Azure implementation

The guarded API package was deployed to `carewest-intake-api-yyc` on 2026-07-13.
Azure loaded all six functions, `/api/health` returned `200` with reachable storage, and
the disabled entry-point probe returned `404`. No synthetic or real report was submitted
during that release verification. The Static Web App now serves the updated frontend;
`/q/test-cleaning` returned `200` from the navigation fallback while the resolver remained
disabled.

The Function App now has three separate contracts:

- `POST /api/report` is the unchanged safety-to-Power-Automate contract;
- `GET /api/entry-points/{entryKey}` resolves public, display-safe QR configuration;
- `POST /api/intake/{entryKey}` accepts a bounded common envelope and queues an
  idempotent Dataverse upsert.

The two extensible routes return `404` unless
`CAREWEST_EXTENSIBLE_INTAKE_ENABLED=true`. Their configuration table and delivery queue
are created only when the guarded path is used. The existing `SafetyIntakeOutbox` table
is reused only as a durable transport outbox; Dataverse remains the internal system of
record.

Configuration is synchronized with the checked-in CLI contract:

```bash
cd api
npm run sync:entry-points -- ../infra/entry-points.example.json
```

The example records are synthetic and inactive. Activation must be a deliberate change
after the Dataverse application user, field map, and end-to-end retry test are complete.

## Development foundation created

Environment: `PowerPagesDeveloper-052126-141619`
Environment ID: `c67b47bb-593f-e85f-8afb-a541c31aba17`
Solution: `Carewest Operations Intake` (`CarewestOperationsIntake`)
Publisher prefix: `cwi`

The unmanaged solution currently contains:

- a published model-driven app named `Carewest Operations Intake`;
- five Dataverse tables: Site, Intake Program, QR Entry Point, Intake Submission, and
  Follow-up Action;
- a Microsoft Dataverse connection reference;
- a disabled `Submission Assignment Notification` cloud flow.

The flow watches for added Intake Submission rows at organization scope, resolves the
related QR Entry Point, checks its Responsible Manager Email, and prepares an Outlook
notification. Its no-recipient branch records that routing is missing instead of
attempting a send. The flow checker reports no errors or warnings. It is intentionally
**off**, its current connection is development-only, and it sends no notification. The
generated sample rows are synthetic and must not be treated as production configuration
or evidence.

The Developer schema also has separate Submission ID and Location columns on Intake
Submission and Responsible Manager Email on QR Entry Point. Submission ID is the
idempotency key; External Report ID remains the human-facing reference.

## Stable QR entry-point contract

Target public URL:

```text
https://bajgai.cloud/q/{entryKey}
```

An `entryKey` identifies one QR Entry Point. The API, not the browser, resolves:

- active Site;
- active Intake Program;
- default location;
- current template version;
- effective-from and effective-to dates;
- approved routing configuration.

The QR URL stays stable when a form layout or manager assignment changes. Administrators
change the configuration record instead of reprinting the QR code.

The API rejects unknown, inactive, not-yet-effective, and expired entry keys. Query
parameters may prefill display-only values but cannot override trusted routing fields.

## Dataverse model

| Table | Purpose | Required business fields |
|---|---|---|
| Site | A physical operating location | Site code, name, active |
| Intake Program | A reusable intake type | Program key, name, description, template version, active |
| QR Entry Point | Stable QR configuration | Entry key, display name, URL slug, Site, Intake Program, default location, active, effective dates |
| Intake Submission | Internal case record | Submission/external IDs, Site, Intake Program, QR Entry Point, source, template version, received time, priority, status, summary, description, structured payload JSON, Azure delivery status |
| Follow-up Action | Work performed against a submission | Intake Submission, action, owner, due date, status, resolution, completed time |

Documents and photos remain in governed SharePoint or OneDrive libraries. Dataverse
stores links and operational metadata, not duplicate binary evidence.

## Public-to-internal handoff

The production handoff must be asynchronous and idempotent:

1. Azure validates the entry key and program-specific payload.
2. The browser supplies an opaque retry key; Azure assigns a report ID, persists the
   canonical payload, and returns acceptance.
3. A queue worker delivers the record to a governed integration endpoint.
4. The integration upserts Intake Submission at a deterministic Dataverse record ID
   derived from `submissionId`.
5. Power Automate assigns the case using Site plus Intake Program and notifies the
   responsible manager.
6. Azure records the Dataverse reference and delivery result; retries never create a
   duplicate case.

Azure remains the acceptance boundary. A Dataverse or Power Automate outage must not
erase an accepted submission or make the reporter resubmit. The worker marks a failed
handoff `PendingRetry`; it marks `Delivered` only after Dataverse confirms the upsert.

## Program-specific form data

Common fields stay first-class on Intake Submission. Program-specific answers are a
versioned JSON object validated against the Intake Program's template version. This
avoids adding sparse columns for every future housekeeping process while preserving a
stable common reporting surface.

Promote frequently reported fields to Dataverse columns only when they have a defined
type, owner, retention need, and cross-program reporting value.

## Security and ownership boundaries

- Azure accepts anonymous submissions but exposes no Power Automate callback, Dataverse
  credential, storage key, or tenant token to the browser.
- The Power App is authenticated and restricted to approved managers and administrators.
- Production integration uses managed/workload identity or an IT-owned service identity,
  not a personal connection.
- Logs contain identifiers and state transitions, not reporter names or narrative text.
- The current Power Apps Developer environment is for configuration and test data only.
- Production Azure resources belong in an IT-governed subscription with corporate
  administrators, policy, monitoring, and recovery ownership.

## Migration gates

1. **Developer prototype:** review generated columns, relationships, forms, views, and
   synthetic rows; finish the disabled flow without enabling notifications.
2. **Azure shadow integration:** deploy `/q/{entryKey}` and idempotent Dataverse delivery
   behind a disabled feature flag while `/safety` remains authoritative.
3. **IT-owned Power Platform:** import a managed solution into an approved production
   environment and bind governed connection references and security roles.
4. **IT-owned Azure:** transfer or rebuild the website, API, storage, identities,
   monitoring, DNS, and runbooks under corporate ownership.
5. **Controlled cutover:** run fallback, duplicate, outage, retention, and access tests;
   then enable one program/site at a time.

The system is not production-ready until both sides have named business, privacy,
security, technical, and records owners and the end-to-end outage/retry test passes.
