#!/usr/bin/env bash
# Finish the Carewest Safety Intake flow: discover the dev-env connections, fill them into the
# generated definition, PATCH the flow, and print the HTTP trigger URL.
#
# Usage:  ./patch_flow.sh <FLOW_ID>
# Prereq: az logged into tenant b1519f0f-… ; the SharePoint + Office 365 Outlook connections
#         already created in the DEV env (see HANDOFF.md Step 1); the flow shell created (Step 2).
set -euo pipefail

ENV="c67b47bb-593f-e85f-8afb-a541c31aba17"
FLOW_ID="${1:?usage: ./patch_flow.sh <FLOW_ID>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
FLOWRES="https://service.flow.microsoft.com/"
PARES="https://service.powerapps.com/"
API="2016-11-01"

conn_id () { # $1 = shared_sharepointonline | shared_office365  -> newest connection name
  az rest --method GET --resource "$PARES" \
    --url "https://api.powerapps.com/providers/Microsoft.PowerApps/apis/$1/connections?api-version=2020-06-01&\$filter=environment eq '$ENV'" \
  | python3 -c "import sys,json;v=json.load(sys.stdin).get('value',[]);print(v[0]['name'] if v else '')"
}

echo "Discovering connections in dev env…"
SP=$(conn_id shared_sharepointonline)
O365=$(conn_id shared_office365)
echo "  SharePoint : ${SP:-<none>}"
echo "  Office 365 : ${O365:-<none>}"
[ -n "$SP" ]   || { echo "ERROR: no SharePoint connection in dev env — create it (HANDOFF Step 1)."; exit 1; }
[ -n "$O365" ] || { echo "ERROR: no Office 365 Outlook connection in dev env — create it (HANDOFF Step 1)."; exit 1; }

echo "Regenerating flow-definition.json with connection ids…"
python3 "$HERE/build_http_flow.py" --sp "$SP" --o365 "$O365" >/dev/null
echo "PATCHing flow $FLOW_ID …"
az rest --method PATCH --resource "$FLOWRES" \
  --url "https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/$ENV/flows/$FLOW_ID?api-version=$API" \
  --headers "Content-Type=application/json" \
  --body "@$HERE/flow-definition.json" >/dev/null
echo "  PATCH ok."

echo "Fetching trigger URL…"
URL=$(az rest --method POST --resource "$FLOWRES" \
  --url "https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/$ENV/flows/$FLOW_ID/triggers/manual/listCallbackUrl?api-version=$API" 2>/dev/null \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('response',{}).get('value') or d.get('value') or '')" 2>/dev/null || true)

echo ""
if [ -n "$URL" ]; then
  echo "TRIGGER URL:"
  echo "  $URL"
  echo ""
  echo "Next: curl-test it (HANDOFF Step 4), then put it in ../docs/index.html (Step 5)."
else
  echo "Could not auto-fetch the trigger URL. Open the trigger card in the maker UI (it's shown"
  echo "after save), or see the manual listCallbackUrl command in HANDOFF.md Step 3."
fi
