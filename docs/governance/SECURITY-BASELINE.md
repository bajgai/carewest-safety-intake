# Carewest Safety Intake — Security Baseline

Status: effective technical baseline; organizational approval pending  
Effective: 2026-07-10

## Scope

This baseline covers the Azure Static Web App, its managed API, the Azure Storage delivery buffer, deployment credentials, the existing Power Automate delivery flow, and the existing SharePoint register.

## Identity and access

- Use a user-assigned managed identity on the standalone Azure Functions Flex Consumption API. The `carewestyyc` Static Web App remains on Free and receives no Azure resource permissions.
- Assign roles at the `carewestyycdata` storage-account scope, not subscription or resource-group scope.
- Grant only the data-plane roles required by implemented storage types.
- Do not use storage account keys, shared connection strings, or credentials in browser code.
- Keep the existing delegated Power Automate connections as a time-bounded exception until an approved Microsoft 365 workload identity or service account is available.
- Maintain two accountable human owners for production resources and connections.
- Review role assignments and connection ownership quarterly and on any role departure.

## Public intake controls

- Keep the report endpoint anonymous only because the operational requirement is no-login reporting.
- Validate content type, total body size, field count, field lengths, allowed fields, and exact contract values server-side.
- Reject unexpected nested values and unknown fields.
- Escape all user text before email or HTML rendering.
- Apply bounded rate controls and bot filtering without treating them as authentication.
- Do not accept files, URLs intended for automatic fetching, HTML, scripts, or executable content.
- Use an idempotency key and payload hash for replay protection.
- Return generic errors; never disclose stack traces, resource names, connector details, or credentials.

## Secrets and deployment

- Store the temporary Power Automate callback and intake credential in Azure application settings.
- Never commit `.env`, deployment tokens, callback URLs, connection exports, storage keys, or session material.
- Rotate a credential immediately after disclosure, suspected disclosure, owner departure, or unauthorized deployment.
- Restrict deployment-token access and prefer identity-backed CI/CD when organizational ownership is available.
- Record production deployments with commit, operator, timestamp, and verification result.

## Data protection

- Collect only the approved fields in `CONTRACT.json`.
- Do not collect medical narratives, WCB claim details, HR cases, harassment-investigation details, government identifiers, or payment information.
- Do not copy reporter names or narrative descriptions into telemetry.
- Encrypt traffic with HTTPS and use Azure platform encryption at rest.
- Keep storage and logs in approved Canadian regions where the selected service permits.
- Do not enable third-party analytics, advertising, session replay, or tracking pixels.

## Monitoring

Alert or surface an operational failure when:

- storage writes fail;
- downstream delivery remains pending beyond the service target;
- duplicate or invalid submissions exceed the normal baseline;
- a deployment token or downstream callback is rotated;
- the number or age of pending records crosses the documented threshold;
- an identity or role assignment changes.

Monitoring output must use report IDs and sanitized error codes.

## Temporary delegated-connection exception

The existing Power Automate SharePoint and Outlook connections are individually owned and therefore remain a custody and continuity risk. Until replaced:

1. Keep the connection behind the Azure API.
2. Verify it with the health-check cadence.
3. Export recoverable flow definitions without secrets.
4. Maintain a reauthorization runbook.
5. Do not describe the arrangement as service-account or workload-identity authentication.

## Approval-dependent target

Request a tenant-approved identity with:

- `Sites.Selected`, scoped to the Carewest reporting site;
- the narrowest approved mail-sending path;
- certificate or managed-identity authentication rather than a client secret;
- two owners and a documented lifecycle;
- tenant-admin consent and security review;
- removal of the individual connections after verified cutover.
