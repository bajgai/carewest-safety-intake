# SharePoint presentation layer

These files define the native SharePoint/Microsoft Lists presentation layer for the Carewest Hazard Reports register. They change display and form layout only; they do not alter report data, flow routing, or the intake contract.

- `manager-triage-gallery.json` — action-first gallery cards for open reports.
- `report-form-header.json` — branded report header.
- `report-form-body.json` — five-section report form with intake fields read-only.

The live list remains the source of truth. Keep the original `All Items` view as the administrative fallback.

## Conditional visibility

Apply these formulas through **Edit form → Edit columns → Edit conditional formula**:

| Display field | Formula |
|---|---|
| Hazard Category | `=if([$Report_x0020_Type] == 'Hazard', 'true', 'false')` |
| Incident Type, Incident Date, Incident Time, Body Part Injured, Body Side, Witness Present, Witness Name, Witness Contact | `=if([$Report_x0020_Type] == 'Incident', 'true', 'false')` |
| Maintenance Urgency | `=if([$Report_x0020_Type] == 'Maintenance', 'true', 'false')` |
| Chemical/Product Name, Issue Type | `=if([$Report_x0020_Type] == 'Chemical/Product Issue', 'true', 'false')` |
| Concern Type, Repeat Issue | `=if([$Report_x0020_Type] == 'Cleaning Quality Concern', 'true', 'false')` |
| Injury/Illness Flag | `=if([$Report_x0020_Type] == 'Hazard', 'true', if([$Report_x0020_Type] == 'Incident', 'true', 'false'))` |
| Area Safe Now | `=if([$Report_x0020_Type] == 'Hazard', 'true', if([$Report_x0020_Type] == 'Incident', 'true', if([$Report_x0020_Type] == 'Chemical/Product Issue', 'true', if([$Report_x0020_Type] == 'Cleaning Quality Concern', 'true', 'false'))))` |
| Evidence Provided, Urgency | `=if([$Report_x0020_Type] != 'Feedback', 'true', 'false')` |
| Evidence Follow-Up Link | `=if([$Evidence_x0020_Provided] == 1, 'true', 'false')` |
| Closure Summary, Closed Date | `=if([$Status] == 'Closed by Site Manager', 'true', 'false')` |

Hide these routing/system fields from the ordinary form using **Edit columns**; they remain available in `All Items` and list settings for administrators:

- Form Response ID
- Site Code
- Site Manager Email
- General Manager Email
- Operations Visibility Email
