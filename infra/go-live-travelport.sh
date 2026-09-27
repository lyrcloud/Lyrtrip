#!/usr/bin/env bash
# Turn on Travelport booking for the live site (lyrtrip-search behind API Gateway 73j9469lxd).
#
# Run once you have PRODUCTION Travelport credentials and a MongoDB database:
#
#   TRAVELPORT_USERNAME=... TRAVELPORT_PASSWORD=... TRAVELPORT_CLIENT_ID=... \
#   TRAVELPORT_CLIENT_SECRET=... TRAVELPORT_ACCESS_GROUP=... TRAVELPORT_PCC=... \
#   MONGODB_URI='mongodb+srv://...' \
#   [STRIPE_ISSUING_CARDHOLDER_ID=ich_...] [SES_FROM_EMAIL=tickets@lyrtrip.com] \
#   bash infra/go-live-travelport.sh
#
# What it does:
#   1. Saves a rollback version of the current Lambda
#   2. Deploys infra/lambda/search.mjs from the committed HEAD
#   3. Merges the Travelport/Mongo settings into the Lambda's existing environment
#      (existing keys such as STRIPE_SECRET_KEY are kept) and sets TRAVELPORT_ENV=production
#   4. Adds the API Gateway routes the booking flow needs (/api/travelport/*)
set -euo pipefail

FUNCTION=lyrtrip-search
API_ID=73j9469lxd
REGION=us-east-1
R="--region $REGION"

for v in TRAVELPORT_USERNAME TRAVELPORT_PASSWORD TRAVELPORT_CLIENT_ID TRAVELPORT_CLIENT_SECRET TRAVELPORT_ACCESS_GROUP TRAVELPORT_PCC MONGODB_URI; do
  [[ -n "${!v:-}" ]] || { echo "Missing $v" >&2; exit 1; }
done

cd "$(git rev-parse --show-toplevel)"
[[ -z "$(git status --porcelain infra/lambda)" ]] || { echo "infra/lambda has uncommitted changes; commit first" >&2; exit 1; }

echo "1/4 rollback point"
aws lambda publish-version --function-name $FUNCTION $R --description "before Travelport go-live" --query Version --output text

echo "2/4 deploy code from $(git rev-parse --short HEAD)"
T=$(mktemp -d)
for f in search.mjs package.json package-lock.json; do git show "HEAD:infra/lambda/$f" > "$T/$f"; done
(cd "$T" && npm ci --omit=dev --silent && zip -qr "$T.zip" .)
aws lambda update-function-code --function-name $FUNCTION $R --zip-file "fileb://$T.zip" --query LastUpdateStatus --output text
aws lambda wait function-updated-v2 --function-name $FUNCTION $R

echo "3/4 settings"
ENV_FILE=$(mktemp); chmod 600 "$ENV_FILE"
aws lambda get-function-configuration --function-name $FUNCTION $R --query 'Environment.Variables' --output json |
  node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const cur = JSON.parse(s || "{}") || {};
      const add = ["TRAVELPORT_USERNAME","TRAVELPORT_PASSWORD","TRAVELPORT_CLIENT_ID","TRAVELPORT_CLIENT_SECRET",
                   "TRAVELPORT_ACCESS_GROUP","TRAVELPORT_PCC","MONGODB_URI","STRIPE_ISSUING_CARDHOLDER_ID","SES_FROM_EMAIL"];
      for (const k of add) if (process.env[k]) cur[k] = process.env[k];
      cur.TRAVELPORT_ENV = "production";
      delete cur.TRAVELPORT_PREVIEW;      // bookings on
      cur.MONGODB_DB_NAME = cur.MONGODB_DB_NAME || "lyrtrip";
      require("fs").writeFileSync(process.argv[1], JSON.stringify({ Variables: cur }));
      console.log("keys:", Object.keys(cur).join(", "));
    });' "$ENV_FILE"
aws lambda update-function-configuration --function-name $FUNCTION $R --timeout 30 \
  --environment "file://$ENV_FILE" --query LastUpdateStatus --output text
rm -f "$ENV_FILE"
aws lambda wait function-updated-v2 --function-name $FUNCTION $R

echo "4/4 API routes"
INTEGRATION=$(aws apigatewayv2 get-routes --api-id $API_ID $R --query "Items[?RouteKey=='POST /api/search'].Target" --output text)
# CORS preflight is answered by the API's CORS settings, so only POST is needed
for route in "POST /api/travelport/{proxy+}"; do
  if aws apigatewayv2 get-routes --api-id $API_ID $R --query "Items[?RouteKey=='$route'].RouteId" --output text | grep -q .; then
    echo "exists: $route"
  else
    aws apigatewayv2 create-route --api-id $API_ID $R --route-key "$route" --target "$INTEGRATION" --query RouteKey --output text
  fi
done

echo "Done. Test: search a flight on https://www.lyrtrip.com — results should come from Travelport."
