# Carewest Safety Intake — Incident-Response Runbook

Status: operational baseline; named organizational roles pending  
Effective: 2026-07-10

## Activation conditions

Activate this runbook for:

- unauthorized access, disclosure, sharing, or export;
- compromised deployment token, downstream callback, delegated connection, or identity;
- lost, duplicated, altered, or misrouted report;
- storage, Power Automate, SharePoint, or email outage affecting intake;
- unexpected deletion or retention behaviour;
- unusual automated traffic or attempted injection;
- an employee departure affecting ownership or access;
- evidence that sensitive medical, HR, WCB, or other prohibited content was submitted.

## Roles

Assign names before production designation:

| Role | Responsibility |
|---|---|
| Incident commander | Coordinates response and decisions |
| Technical lead | Contains, investigates, restores, and preserves evidence |
| Safety/business owner | Assesses operational impact and report handling |
| Privacy lead | Assesses personal-information impact and notification |
| Security lead | Assesses compromise, identity, and threat activity |
| Records/legal contact | Directs preservation, holds, and disposition |
| Communications owner | Coordinates approved staff/manager communication |

Until those roles are assigned, the technical operator must contain the issue and escalate through existing Aramark management/security channels without making legal or privacy determinations alone.

## Severity guide

| Severity | Example | Initial action target |
|---|---|---|
| SEV-1 | Confirmed unauthorized disclosure, active credential compromise, or widespread loss | Immediate containment and escalation |
| SEV-2 | Multiple lost/misrouted reports or sustained production outage | Begin response within 1 hour |
| SEV-3 | Single duplicate, delayed delivery, or recoverable component failure | Same business day |
| SEV-4 | Test/environment issue with no production data impact | Planned remediation |

Targets are operational goals, not regulatory notification deadlines.

## Response procedure

### 1. Record and preserve

- Open an incident record with UTC start time, discoverer, affected surface, and known report IDs.
- Preserve relevant deployment, authentication, delivery-state, and access logs.
- Do not copy narrative payloads into the incident record unless necessary and authorized.
- Suspend automated deletion for affected records.

### 2. Contain

- If the Azure API is compromised, disable only the affected delivery route and publish/use the Microsoft Forms fallback.
- If a downstream callback is exposed, stop Azure-to-flow delivery, rotate the callback/credential, and preserve queued records.
- If a delegated connection is compromised, disable or revoke it and prevent further flow runs.
- If a deployment credential is compromised, rotate it and review deployments since last known-good use.
- If sharing is incorrect, remove unauthorized access without destroying evidence.

### 3. Assess

Determine:

- first and last known event time;
- data classes and report IDs affected;
- identities, recipients, systems, and locations involved;
- whether data was only exposed or demonstrably accessed/exported;
- whether reports were lost, altered, duplicated, delayed, or misrouted;
- whether legal hold, privacy, security, client, insurer, or regulatory assessment is required.

### 4. Escalate

Notify the designated Safety/business, Privacy, Security, Records/Legal, and Carewest contacts appropriate to the severity. Do not independently promise notification scope or deadlines. Record who made each decision and when.

### 5. Eradicate and restore

- Remove unauthorized roles, links, credentials, code, or routing values.
- Deploy from a verified commit.
- Restore the minimum service path.
- Reconcile every Azure record against SharePoint by report ID and submission ID.
- Retry pending work idempotently.
- Run one controlled report and one duplicate test; delete the test records afterward.
- Confirm Microsoft Forms fallback remains available.

### 6. Close

Document:

- timeline and scope;
- affected records and recipients;
- containment and recovery actions;
- notification decisions and responsible approvers;
- evidence retained and access restrictions;
- root cause and contributing controls;
- corrective actions, owners, and due dates.

Review the incident within five business days for SEV-1/2, or during the next operating review for SEV-3/4.

## Specific playbooks

### Lost or delayed submission

1. Locate the submission ID in Azure Storage.
2. Check delivery status and attempt history.
3. Search SharePoint by report ID and form response ID.
4. If absent, retry once through the idempotent delivery path.
5. Confirm exactly one SharePoint item and expected routing event.

### Duplicate submission

1. Compare submission ID and payload hash.
2. Preserve the earliest accepted record as canonical.
3. Prevent repeated downstream delivery.
4. Reconcile duplicate SharePoint/email effects and document any manual cleanup.

### Compromised Power Automate callback

1. Disable Azure delivery while keeping durable intake available.
2. Rotate or recreate the callback.
3. Update only the server-side application setting.
4. Verify old callback rejection where feasible.
5. Reconcile backlog and monitor for attempted use of the old callback.

## Live Azure Monitor controls (2026-07-10)

| Signal | Rule | Window | Notification |
|---|---|---:|---|
| API health from three Azure regions | `carewest-intake-api-unavailable` | 5 minutes; two failed locations | `carewest-intake-ops` |
| API or queue-worker exception | `carewest-intake-delivery-failure` | 5 minutes | `carewest-intake-ops` |
| Delivery/poison queue contains messages | `carewest-intake-queue-backlog` | 1 hour | `carewest-intake-ops` |

The action group sends common-schema email to the Aramark operator mailbox. The queue
window is one hour because Azure Storage exposes `QueueMessageCount` only with one-hour
or longer evaluation windows. During active incident handling, inspect the outbox table's
`deliveryStatus`, `attemptCount`, and sanitized `lastErrorCode` rather than waiting for the
backlog alert. Never copy payload or personal-information fields into alert text.

The public QR redirect is controlled by `/etc/nginx/safety-redirect.conf` on the existing
VPS. Its current target is `https://proud-beach-0b03f2b10.7.azurestaticapps.net/`; the
pre-cutover GitHub Pages URL is the immediate rollback target.

### Owner departure

1. Inventory Azure RBAC, SWA deployment access, Power Automate connections, SharePoint ownership, and alert recipients.
2. Assign approved replacement owners before removing the departing identity.
3. Reauthorize delegated connections or cut over to the approved workload identity.
4. Rotate individually held deployment and downstream credentials.
