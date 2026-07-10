# Carewest Safety Intake — Provisional Retention, Privacy, and Records Standard

Status: provisional operational control; not a legal retention schedule  
Effective: 2026-07-10

## Authority boundary

This document establishes conservative technical handling rules that can be enforced immediately. It does not select the authoritative legal retention period for occupational health and safety, incident, employment, insurance, litigation, or Carewest records. Aramark/Carewest Privacy, Legal, Safety, and Records Management must approve the final schedule and Microsoft Purview configuration.

Until that approval exists, do not automatically delete the SharePoint system-of-record copy.

## Purpose and permitted use

Information is collected only to receive, route, investigate, correct, and close Carewest operational safety, incident, maintenance, product, cleaning-quality, and feedback reports. It must not be repurposed for unrelated employee monitoring, performance scoring, marketing, or analytics.

## Data minimization

- Reporter name is collected only where the approved branch requires follow-up.
- Free text must instruct reporters not to enter medical, WCB, HR, harassment, government-ID, or other unnecessary sensitive information.
- Public intake does not accept attachments.
- Logs contain report identifiers and technical state only.
- Test data is visibly marked and removed after verification.

## Provisional lifecycle

| Record class | Provisional technical rule | Final authority required |
|---|---|---|
| Browser form state | Do not persist after submission or abandonment | Product owner |
| Azure successful-delivery buffer | Eligible for deletion 30 days after verified SharePoint reconciliation | Technical owner plus records approval before automation |
| Azure pending or failed delivery | Retain until reconciled and reviewed; never age-delete unresolved reports | Safety/records owner |
| Application diagnostics | 30 days; no payloads, names, or narrative | Security/privacy owner |
| Security and access audit evidence | 90 days where supported | Security/records owner |
| SharePoint report | No automated deletion pending approved schedule | Aramark/Carewest Legal, Safety, Privacy, Records |
| Manager email | Operational notification, not the authoritative record; avoid unnecessary forwarding | Messaging/records owner |
| Flow/source exports | Retain current and recovery-required versions; exclude secrets and report data | Technical owner |
| Test submissions | Delete promptly after end-to-end verification | Test operator |

The 30-day Azure value is a delivery-buffer target, not the legal retention period for a safety record. Automated deletion must remain disabled until the data owner approves reconciliation evidence and disposition behaviour.

## Access and disclosure

- Limit access to personnel who need it for intake operation, investigation, remediation, privacy/security response, or records administration.
- Do not expose the register through anonymous or broad tenant sharing.
- Verify recipients and routing changes against the approved routing register.
- Record and review exports of production report data.
- Use secure SharePoint links rather than forwarding full narratives when practical.

## Accuracy and correction

- Preserve the original submitted value and record later corrections as attributed changes.
- Use the report ID to correlate the Azure intake, SharePoint item, email, and corrective action.
- Do not silently overwrite the original narrative.
- Route access, correction, or privacy questions to the designated privacy/business owner once assigned.

## Records controls to request

The production approval package must specify:

1. authoritative record copy and accountable record owner;
2. record categories and approved retention periods;
3. retention trigger, including submission, closure, event, or case completion;
4. legal hold and investigation hold behaviour;
5. correction, versioning, and audit requirements;
6. disposition reviewer and proof-of-disposition requirements;
7. rules for email, exports, backups, and duplicate technical copies;
8. privacy notice and access/correction contact;
9. breach assessment and notification roles;
10. Microsoft Purview labels, scopes, licensing, and administrators.

## Review cadence

- Review this provisional standard within 30 days.
- Review after any new report type, attachment feature, system-of-record migration, security incident, or regulatory/legal direction.
- Replace this document with the approved schedule or link it to the authoritative corporate policy once adopted.

