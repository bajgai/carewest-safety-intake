#!/usr/bin/env python3
"""
Build the Power Automate "When an HTTP request is received" flow definition for the
Carewest Safety Intake pilot, porting Flow 1's routing + email logic to a clean JSON
payload contract (see ../CONTRACT.json).

Output: flow-definition.json  (a PATCH/PUT body for the Power Automate management API).

Connection names are placeholders until the two OAuth connections are created in the
DEV env (c67b47bb-593f-e85f-8afb-a541c31aba17):
    __SHAREPOINT_CONN__   -> shared_sharepointonline connection "name" (unique id)
    __OFFICE365_CONN__    -> shared_office365 connection "name" (unique id)
Fill them with:  python3 build_http_flow.py --sp <id> --o365 <id>
or leave placeholders and sed them in later.

Usage:
    python3 build_http_flow.py [--sp <sharepoint_conn_id>] [--o365 <office365_conn_id>]
"""
import json, sys, os, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
CONTRACT = json.load(open(os.path.join(HERE, "..", "CONTRACT.json")))

INFRA = CONTRACT["infra"]
ROUTING = CONTRACT["site_routing"]
CONST = CONTRACT["constants"]
SP_SITE = INFRA["sharepointSiteUrl"]
LIST_GUID = INFRA["listGuid"]
INTAKE_KEY = "cwsi-pilot-3f9aK2qLxR"   # MUST equal INTAKE_KEY in ../docs/index.html

DISPLAY_NAME = "Hazard Report - Web Intake (HTTP)"

# ---- expression shorthands -------------------------------------------------
P  = "outputs('Compose_payload')"
RT = "outputs('Compose_reportType')"
ST = "outputs('Compose_site')"

def f(name):           # coalesced payload string field
    return f"coalesce({P}?['{name}'],'')"

def auth():
    return "@parameters('$authentication')"

# ---- email body (one big @concat expression) -------------------------------
def trow(label, value_expr):
    """A table row that disappears entirely when its value is blank."""
    html_open = ('<tr><td style="padding:3px 14px 3px 0;color:#54565A;font-weight:600;'
                 'vertical-align:top;white-space:nowrap">' + label + '</td>'
                 '<td style="padding:3px 0;color:#1c1c1e">')
    return (f"if(empty(trim({value_expr})),'',"
            f"concat('{html_open}',{value_expr},'</td></tr>'))")

def email_body_expr():
    urgency = f("urgency")
    # urgency chip color
    urg_color = (f"if(equals({urgency},'Emergency'),'#D8002A',"
                 f"if(equals({urgency},'High'),'#C75300',"
                 f"if(equals({urgency},'Medium'),'#B26A00','#3f7a3f')))")
    # safety / WCB line: always for Incident; for injury-flagged Hazard
    safety = (f"if(equals({RT},'Incident'),"
              "'<p style=\"margin:0 0 14px;padding:11px 14px;background:#FCEEF1;border-left:4px solid #D8002A;color:#7a0a22\">"
              "<strong>Incident report.</strong> Serious incidents and any injury or illness must also be filed in the "
              "official Carewest injury/illness + WCB/Riskonnect process. This form does not replace it.</p>',"
              f"if(or(equals({f('injuryFlag')},'Yes - tell supervisor now'),equals({f('injuryFlag')},'Not sure')),"
              "'<p style=\"margin:0 0 14px;padding:11px 14px;background:#FCEEF1;border-left:4px solid #D8002A;color:#7a0a22\">"
              "<strong>Possible injury or illness reported.</strong> Please follow the official Carewest injury/illness "
              "reporting process in parallel. Do not collect medical details in this channel.</p>',''))")

    # plain-English lead line (good inbox preview)
    lead = (f"concat('<p style=\"margin:0 0 14px;font-size:15px\"><strong>',{RT},"
            f"'</strong> at ',{ST},"
            f"if(empty(trim({f('location')})),'',concat(' &mdash; ',{f('location')})),"
            f"if(empty(trim({urgency})),'',concat(' &mdash; ',{urgency},' urgency')),"
            f"if(equals({f('areaSafeNow')},'No - site manager help needed'),' &mdash; <span style=\"color:#D8002A;font-weight:700\">AREA NOT SAFE</span>',''),"
            "'.</p>')")

    # "at a glance" common rows
    glance_rows = ",".join([
        trow("Report ID", "variables('varReportId')"),
        trow("Report type", RT),
        trow("Site", ST),
        trow("Site code", "variables('varSiteCode')"),
        # urgency with color chip
        ("if(empty(trim(" + urgency + ")),'',concat('<tr><td style=\"padding:3px 14px 3px 0;color:#54565A;font-weight:600\">Urgency</td>"
         "<td style=\"padding:3px 0\"><span style=\"display:inline-block;padding:1px 9px;border-radius:10px;color:#fff;font-weight:700;font-size:12px;background:'," + urg_color + ",'\">'," + urgency + ",'</span></td></tr>'))"),
        trow("Area safe now", f("areaSafeNow")),
        trow("Injury / illness", f("injuryFlag")),
        trow("Reporter", "if(empty(trim(" + f("reporterName") + ")),'(anonymous)'," + f("reporterName") + ")"),
        trow("Submitted (UTC)", "formatDateTime(utcNow(),'yyyy-MM-dd HH:mm')"),
    ])

    # type-specific rows
    type_rows = ",".join([
        trow("Hazard category", f("hazardCategory")),
        trow("Incident date/time", f("incidentDateTime")),
        trow("Incident type", f("incidentType")),
        trow("Body part injured", "trim(concat(" + f("bodyPart") + ",' '," + f("side") + "))"),
        trow("Witness present", f("witnessPresent")),
        trow("Witness name", f("witnessName")),
        trow("Witness contact", f("witnessContact")),
        trow("Product / chemical", f("productName")),
        trow("Issue type", f("issueType")),
        trow("Concern type", f("concernType")),
        ("if(equals(" + RT + ",'Cleaning Quality Concern'),concat('<tr><td style=\"padding:3px 14px 3px 0;color:#54565A;font-weight:600\">Repeat issue</td>"
         "<td style=\"padding:3px 0\">',if(equals(" + f("repeatIssue") + ",'Yes'),'Yes &mdash; keeps happening','No &mdash; first time'),'</td></tr>'),'')"),
        trow("Evidence available", f("evidenceAvailable")),
    ])

    desc = ("if(empty(trim(" + f("description") + ")),'',concat('<p style=\"margin:16px 0 4px;color:#54565A;font-weight:600\">Description</p>"
            "<blockquote style=\"margin:0;padding:10px 14px;background:#F4F7FA;border-left:3px solid #01426A;color:#1c1c1e;white-space:pre-wrap\">',"
            + f("description") + ",'</blockquote>'))")

    helpx = ("if(empty(trim(" + f("helpNeeded") + ")),'',concat('<p style=\"margin:14px 0 4px;color:#54565A;font-weight:600\">Anything else / help needed</p>"
             "<p style=\"margin:0;white-space:pre-wrap\">'," + f("helpNeeded") + ",'</p>'))")

    feedback_sugg = ("if(empty(trim(" + f("feedbackSuggestion") + ")),'',concat('<p style=\"margin:14px 0 4px;color:#54565A;font-weight:600\">Suggestion</p>"
                     "<p style=\"margin:0;white-space:pre-wrap\">'," + f("feedbackSuggestion") + ",'</p>'))")

    # record link (CTA) — short anchor text, URL in href only
    link = ("concat('<p style=\"margin:18px 0 6px\"><a href=\"',outputs('Create_list_item')?['body/{Link}'],"
            "'\" style=\"display:inline-block;background:#01426A;color:#ffffff;text-decoration:none;font-weight:700;"
            "padding:10px 18px;border-radius:6px\">Open report ',variables('varReportId'),'</a></p>"
            "<p style=\"margin:0;color:#54565A;font-size:12px\">Can&#39;t open the link? Just reply to this email. "
            "The Carewest Safety Intake list is the source of truth; this email is the routing channel.</p>')")

    glance_table = ("concat('<table cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;font-size:14px;margin:0 0 10px\">',"
                    + glance_rows + ",'</table>')")
    type_table = ("concat('<table cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;font-size:14px;margin:0 0 4px\">',"
                  + type_rows + ",'</table>')")

    body = ("@concat("
            "'<div style=\"font-family:Segoe UI,Arial,sans-serif;color:#1c1c1e;max-width:640px\">',"
            + safety + ","
            + lead + ","
            + glance_table + ","
            + type_table + ","
            + desc + ","
            + helpx + ","
            + feedback_sugg + ","
            + link + ","
            "'</div>')")
    return body

# ---- subject / cc / importance --------------------------------------------
def subject_expr():
    label = ("if(equals(" + RT + ",'Hazard'),'New Hazard Report',"
             "if(equals(" + RT + ",'Incident'),'New Incident Report',"
             "if(equals(" + RT + ",'Maintenance'),'New Maintenance Report',"
             "if(equals(" + RT + ",'Feedback'),'New Feedback',"
             "if(equals(" + RT + ",'Chemical/Product Issue'),'New Chemical/Product Issue',"
             "if(equals(" + RT + ",'Cleaning Quality Concern'),'New Cleaning Quality Concern','New Report'))))))")
    urgent = "if(or(equals(" + f("urgency") + ",'High'),equals(" + f("urgency") + ",'Emergency')),'[URGENT] ','')"
    routing = "if(empty(variables('varSiteManagerEmail')),'Routing Review Required - ','')"
    return ("@{concat(" + routing + "," + urgent + "," + label + ",' - '," + ST + ",' - ',variables('varReportId'))}")

def cc_expr():
    return ("@{if(equals(" + RT + ",'Incident'),'li-wenyuan@aramark.ca;bajgai-niranjan@aramark.ca',"
            "if(or(equals(" + RT + ",'Chemical/Product Issue'),equals(" + RT + ",'Cleaning Quality Concern')),"
            "'bajgai-niranjan@aramark.ca',''))}")

def importance_expr():
    return ("@{if(or(equals(" + f("urgency") + ",'High'),equals(" + f("urgency") + ",'Emergency'),equals(" + RT + ",'Incident')),'High','Normal')}")

# ---- urgency mapping (form 4-point -> SharePoint 1-5 choice) ----------------
def urgency_value_expr():
    u = f("urgency")
    return ("@if(equals(" + u + ",'Low'),'1 - Low',"
            "if(equals(" + u + ",'Medium'),'2 - Medium',"
            "if(equals(" + u + ",'High'),'3 - High',"
            "if(equals(" + u + ",'Emergency'),'5 - Emergency',null))))")

# ---- Switch cases ----------------------------------------------------------
def switch_cases():
    cases = {}
    short = {  # site -> short PascalCase used in action names (matches live flow)
        "Colonel Belcher":"Belcher","Signal Point":"SignalPoint","Sarcee":"Sarcee",
        "Royal Park":"RoyalPark","Garrison Green":"GarrisonGreen","Glenmore Park":"GlenmorePark",
        "Dr Fanning":"DrFanning","George Boyak":"GeorgeBoyak","Nickle House":"NickleHouse"}
    for site, r in ROUTING.items():
        s = short[site]
        cases["Case_"+s] = {
            "case": site,
            "actions": {
                "Set_email_"+s: {"type":"SetVariable","inputs":{"name":"varSiteManagerEmail","value":r["manager"]},"runAfter":{}},
                "Set_code_"+s:  {"type":"SetVariable","inputs":{"name":"varSiteCode","value":r["code"]},"runAfter":{"Set_email_"+s:["Succeeded"]}},
            }
        }
    return cases

# ---- Create item parameters ------------------------------------------------
def create_item_params():
    return {
        "dataset": SP_SITE,
        "table": LIST_GUID,
        "item/Title": "@{variables('varReportId')}",
        "item/Report_x0020_Type/Value": "@"+RT,
        "item/Site/Value": "@"+ST,
        "item/Site_x0020_Code": "@variables('varSiteCode')",
        "item/Site_x0020_Manager_x0020_Email": "@variables('varSiteManagerEmail')",
        "item/Status/Value": "@if(equals(variables('varSiteManagerEmail'),''),'Routing Review Required','Sent to Site Manager')",
        "item/Reporter_x0020_Name": "@"+f("reporterName"),
        "item/Hazard_x0020_Area": "@"+f("location"),
        "item/Description": "@"+f("description"),
        "item/Help_x0020_Needed_x0020_Or_x0020": "@if(equals("+RT+",'Feedback'),"+f("feedbackSuggestion")+","+f("helpNeeded")+")",
        "item/Evidence_x0020_Provided": "@equals("+P+"?['evidenceAvailable'],'Yes')",
        "item/Urgency/Value": urgency_value_expr(),
        "item/Area_x0020_Safe_x0020_Now/Value": "@if(empty("+f("areaSafeNow")+"),null,"+P+"?['areaSafeNow'])",
        "item/Injury_x002f_Illness_x0020_Flag/Value": "@if(empty("+f("injuryFlag")+"),null,"+P+"?['injuryFlag'])",
        "item/Hazard_x0020_Category/Value": "@if(equals("+RT+",'Hazard'),if(empty("+f("hazardCategory")+"),null,"+P+"?['hazardCategory']),null)",
        "item/Incident_x0020_Date": "@if(empty("+f("incidentDateTime")+"),null,"+P+"?['incidentDateTime'])",
        "item/Incident_x0020_Time": "@if(empty("+f("incidentDateTime")+"),'',last(split("+P+"?['incidentDateTime'],'T')))",
        "item/Incident_x0020_Type": "@"+f("incidentType"),
        "item/Body_x0020_Part_x0020_Injured": "@"+f("bodyPart"),
        "item/Body_x0020_Side": "@"+f("side"),
        "item/Witness_x0020_Present": "@"+f("witnessPresent"),
        "item/Witness_x0020_Name": "@"+f("witnessName"),
        "item/Witness_x0020_Contact": "@"+f("witnessContact"),
        "item/Chemical_x002f_Product_x0020_Nam": "@"+f("productName"),
        "item/Issue_x0020_Type": "@"+f("issueType"),
        "item/Concern_x0020_Type": "@"+f("concernType"),
        "item/Repeat_x0020_Issue": "@equals("+P+"?['repeatIssue'],'Yes')",
        "item/Form_x0020_Response_x0020_ID": CONST["sourceMarker"],
        "item/Submitted_x0020_Date_x002f_Time": "@utcNow()",
        "item/General_x0020_Manager_x0020_Emai": CONST["generalManagerEmail"],
        "item/Operations_x0020_Visibility_x002": CONST["operationsVisibilityEmail"],
    }

# ---- assemble definition ---------------------------------------------------
def build():
    real_actions = {
        "Compose_site": {"type":"Compose","inputs":"@trim(string(coalesce("+P+"?['site'],'')))","runAfter":{}},
        "Compose_reportType": {"type":"Compose","inputs":"@trim(string(coalesce("+P+"?['reportType'],'')))","runAfter":{"Compose_site":["Succeeded"]}},
        "Switch_on_Site": {
            "type":"Switch","expression":"@"+ST,
            "cases": switch_cases(),
            "default": {"actions": {}},
            "runAfter":{"Compose_reportType":["Succeeded"]}
        },
        "Create_list_item": {
            "type":"OpenApiConnection",
            "inputs":{
                "host":{"apiId":"/providers/Microsoft.PowerApps/apis/shared_sharepointonline","connectionName":"shared_sharepointonline","operationId":"PostItem"},
                "parameters": create_item_params(),
                "authentication": auth()
            },
            "runAfter":{"Switch_on_Site":["Succeeded"]}
        },
        "Compose_email_body": {"type":"Compose","inputs":email_body_expr(),"runAfter":{"Create_list_item":["Succeeded"]}},
        "Send_email_to_manager": {
            "type":"OpenApiConnection",
            "inputs":{
                "host":{"apiId":"/providers/Microsoft.PowerApps/apis/shared_office365","connectionName":"shared_office365","operationId":"SendEmailV2"},
                "parameters":{
                    "emailMessage/To":"@{if(empty(variables('varSiteManagerEmail')),variables('varFallbackEmail'),variables('varSiteManagerEmail'))}",
                    "emailMessage/Cc":cc_expr(),
                    "emailMessage/Subject":subject_expr(),
                    "emailMessage/Body":"@outputs('Compose_email_body')",
                    "emailMessage/Importance":importance_expr()
                },
                "authentication": auth()
            },
            "runAfter":{"Compose_email_body":["Succeeded"]}
        },
        "Response_success": {
            "type":"Response","kind":"Http",
            "inputs":{
                "statusCode":200,
                "headers":{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"},
                "body":{"reportId":"@variables('varReportId')","status":"received"}
            },
            "runAfter":{"Send_email_to_manager":["Succeeded","Failed","Skipped"]}
        },
        # failure path on list-write (Phase 5 RT-2): notify Ops + still return a ref id
        "Send_email_failure": {
            "type":"OpenApiConnection",
            "inputs":{
                "host":{"apiId":"/providers/Microsoft.PowerApps/apis/shared_office365","connectionName":"shared_office365","operationId":"SendEmailV2"},
                "parameters":{
                    "emailMessage/To": CONST["operationsVisibilityEmail"],
                    "emailMessage/Subject":"@{concat('[ACTION] Safety intake write FAILED - ',"+ST+",' - ',variables('varReportId'))}",
                    "emailMessage/Body":"@{concat('<p>A web safety-intake submission could not be written to the register. Raw payload below.</p><pre>',string("+P+"),'</pre>')}",
                    "emailMessage/Importance":"High"
                },
                "authentication": auth()
            },
            "runAfter":{"Create_list_item":["Failed","TimedOut"]}
        },
        "Response_pending": {
            "type":"Response","kind":"Http",
            "inputs":{
                "statusCode":200,
                "headers":{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"},
                "body":{"reportId":"@variables('varReportId')","status":"pending"}
            },
            "runAfter":{"Send_email_failure":["Succeeded","Failed","Skipped"]}
        }
    }

    actions = {
        "Init_varReportId": {"type":"InitializeVariable","inputs":{"variables":[{"name":"varReportId","type":"String",
            "value":"@concat('HZ-', formatDateTime(utcNow(), 'yyyyMMdd-HHmm'), '-', take(replace(guid(), '-', ''), 4))"}]},"runAfter":{}},
        "Init_varSiteManagerEmail": {"type":"InitializeVariable","inputs":{"variables":[{"name":"varSiteManagerEmail","type":"String","value":""}]},"runAfter":{"Init_varReportId":["Succeeded"]}},
        "Init_varSiteCode": {"type":"InitializeVariable","inputs":{"variables":[{"name":"varSiteCode","type":"String","value":""}]},"runAfter":{"Init_varSiteManagerEmail":["Succeeded"]}},
        "Init_varFallbackEmail": {"type":"InitializeVariable","inputs":{"variables":[{"name":"varFallbackEmail","type":"String","value":CONST["fallbackEmail"]}]},"runAfter":{"Init_varSiteCode":["Succeeded"]}},
        "Compose_payload": {"type":"Compose","inputs":"@json(triggerBody())","runAfter":{"Init_varFallbackEmail":["Succeeded"]}},
        "Condition_spam_guard": {
            "type":"If",
            "expression":{"and":[
                {"equals":["@empty(trim(coalesce("+P+"?['honeypot'],'')))", True]},
                {"equals":["@trim(coalesce("+P+"?['intakeKey'],''))", INTAKE_KEY]}
            ]},
            "actions": real_actions,
            "else":{"actions":{
                "Response_spam":{
                    "type":"Response","kind":"Http",
                    "inputs":{"statusCode":200,"headers":{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"},
                              "body":{"status":"ok"}},
                    "runAfter":{}
                }
            }},
            "runAfter":{"Compose_payload":["Succeeded"]}
        }
    }

    definition = {
        "$schema":"https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
        "contentVersion":"1.0.0.0",
        "parameters":{
            "$authentication":{"defaultValue":{},"type":"SecureObject"},
            "$connections":{"defaultValue":{},"type":"Object"}
        },
        "triggers":{
            "manual":{
                "type":"Request","kind":"Http",
                "inputs":{"schema":{"type":"object","properties":{}}}
            }
        },
        "actions": actions,
        "outputs":{}
    }

    connection_refs = {
        "shared_sharepointonline":{
            "apiName":"sharepointonline","displayName":"SharePoint",
            "connectionName":"__SHAREPOINT_CONN__",
            "id":"/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
            "source":"Embedded","tier":"Standard"
        },
        "shared_office365":{
            "apiName":"office365","displayName":"Office 365 Outlook","brandColor":"#0078D4",
            "connectionName":"__OFFICE365_CONN__",
            "id":"/providers/Microsoft.PowerApps/apis/shared_office365",
            "source":"Embedded","tier":"Standard"
        }
    }

    return {"properties":{"displayName":DISPLAY_NAME,"definition":definition,"connectionReferences":connection_refs}}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sp", help="shared_sharepointonline connection id")
    ap.add_argument("--o365", help="shared_office365 connection id")
    ap.add_argument("-o","--out", default=os.path.join(HERE,"flow-definition.json"))
    args = ap.parse_args()

    body = build()
    s = json.dumps(body, indent=2)
    if args.sp:   s = s.replace("__SHAREPOINT_CONN__", args.sp)
    if args.o365: s = s.replace("__OFFICE365_CONN__", args.o365)
    with open(args.out,"w") as fh:
        fh.write(s)
    # validate it parses
    json.loads(s)
    print("wrote", args.out, "(", len(s), "bytes )")
    if "__SHAREPOINT_CONN__" in s or "__OFFICE365_CONN__" in s:
        print("NOTE: connection placeholders still present — fill with --sp/--o365 before PATCH.")

if __name__ == "__main__":
    main()
