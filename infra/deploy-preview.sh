#!/usr/bin/env bash
# Put Travelport hotels/flights on www.lyrtrip.com using the TRIAL (pre-production) account.
#
#   bash infra/deploy-preview.sh          # preview: results shown, every checkout refused
#   bash infra/deploy-preview.sh test     # test site: full booking flow, Stripe TEST cards only
#
# Test mode needs in .env.local: a Stripe TEST key (STRIPE_SECRET_KEY=sk_test_...), used only
# for Travelport bookings as TRAVELPORT_STRIPE_SECRET_KEY (the site's own Stripe key is kept),
# and MONGODB_URI. Bookings go to the MONGODB_DB_NAME=lyrtrip_test database and are marked
# "TEST BOOKING — NOT VALID FOR TRAVEL". Switch to real booking with go-live-travelport.sh.
#
# Steps: rollback version → deploy API code from HEAD → merge settings → add
# /api/travelport/* route → build and publish the frontend.
set -euo pipefail

FUNCTION=lyrtrip-search
API_ID=73j9469lxd
BUCKET=s3://lyrtrip-website-hosting
DISTRIBUTIONS="E2MAYSXZB0XTQ1 E2T1R9OO63W8NI"
R="--region us-east-1"

cd "$(git rev-parse --show-toplevel)"
[[ -z "$(git status --porcelain infra/lambda src)" ]] || { echo "Uncommitted changes in infra/lambda or src; commit first" >&2; exit 1; }
MODE=${1:-preview}
[[ "$MODE" == preview || "$MODE" == test ]] || { echo "Usage: $0 [preview|test]" >&2; exit 1; }
set -a; . ./.env.local; set +a
if [[ "$MODE" == test ]]; then
  [[ "${STRIPE_SECRET_KEY:-}" == sk_test_* ]] || { echo "Test mode needs a Stripe TEST key (sk_test_...) in .env.local" >&2; exit 1; }
  [[ -n "${MONGODB_URI:-}" ]] || { echo "Test mode needs MONGODB_URI in .env.local" >&2; exit 1; }
  export TRAVELPORT_STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
fi
export MODE
for v in TRAVELPORT_USERNAME TRAVELPORT_PASSWORD TRAVELPORT_CLIENT_ID TRAVELPORT_CLIENT_SECRET TRAVELPORT_ACCESS_GROUP; do
  [[ -n "${!v:-}" ]] || { echo "Missing $v in .env.local" >&2; exit 1; }
done

echo "1/5 rollback point"
aws lambda publish-version --function-name $FUNCTION $R --description "before Travelport $MODE" --query Version --output text

echo "2/5 deploy API code from $(git rev-parse --short HEAD)"
T=$(mktemp -d)
for f in search.mjs package.json package-lock.json; do git show "HEAD:infra/lambda/$f" > "$T/$f"; done
(cd "$T" && npm ci --omit=dev --silent && zip -qr "$T.zip" .)
aws lambda update-function-code --function-name $FUNCTION $R --zip-file "fileb://$T.zip" --query LastUpdateStatus --output text
aws lambda wait function-updated-v2 --function-name $FUNCTION $R

echo "3/5 settings ($MODE mode, existing keys kept)"
ENV_FILE=$(mktemp); chmod 600 "$ENV_FILE"
aws lambda get-function-configuration --function-name $FUNCTION $R --query 'Environment.Variables' --output json |
  node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const cur = JSON.parse(s || "{}") || {};
      for (const k of ["TRAVELPORT_USERNAME","TRAVELPORT_PASSWORD","TRAVELPORT_CLIENT_ID",
                       "TRAVELPORT_CLIENT_SECRET","TRAVELPORT_ACCESS_GROUP","TRAVELPORT_PCC"]) {
        if (process.env[k]) cur[k] = process.env[k];
      }
      delete cur.TRAVELPORT_ENV;          // pre-production Travelport
      if (process.env.MODE === "test") {
        cur.TRAVELPORT_TEST_SITE = "true";
        delete cur.TRAVELPORT_PREVIEW;
        cur.TRAVELPORT_STRIPE_SECRET_KEY = process.env.TRAVELPORT_STRIPE_SECRET_KEY;
        cur.MONGODB_URI = process.env.MONGODB_URI;
        cur.MONGODB_DB_NAME = "lyrtrip_test";
      } else {
        cur.TRAVELPORT_PREVIEW = "true";
        delete cur.TRAVELPORT_TEST_SITE;
      }
      require("fs").writeFileSync(process.argv[1], JSON.stringify({ Variables: cur }));
      console.log("keys:", Object.keys(cur).join(", "));
    });' "$ENV_FILE"
aws lambda update-function-configuration --function-name $FUNCTION $R --timeout 30 \
  --environment "file://$ENV_FILE" --query LastUpdateStatus --output text
rm -f "$ENV_FILE"
aws lambda wait function-updated-v2 --function-name $FUNCTION $R

echo "4/5 API route"
INTEGRATION=$(aws apigatewayv2 get-routes --api-id $API_ID $R --query "Items[?RouteKey=='POST /api/search'].Target" --output text)
ROUTE="POST /api/travelport/{proxy+}"
if aws apigatewayv2 get-routes --api-id $API_ID $R --query "Items[?RouteKey=='$ROUTE'].RouteId" --output text | grep -q .; then
  echo "exists: $ROUTE"
else
  aws apigatewayv2 create-route --api-id $API_ID $R --route-key "$ROUTE" --target "$INTEGRATION" --query RouteKey --output text
fi

echo "5/5 frontend"
rm -rf out && npm run build >/dev/null
cd out
ROUTES=$(find . -name '*.html' ! -name index.html ! -name 404.html ! -name '_not-found.html' | sed 's|^\./||; s|\.html$||')
EXCL=""; for r in $ROUTES; do EXCL="$EXCL --exclude $r"; done
aws s3 sync . $BUCKET/ --exclude "*.html" $EXCL --only-show-errors
for f in $(find . -name '*.html' | sed 's|^\./||'); do aws s3 cp "$f" "$BUCKET/$f" --content-type text/html --cache-control no-cache --only-show-errors; done
for r in $ROUTES; do aws s3 cp "$r.html" "$BUCKET/$r" --content-type text/html --cache-control no-cache --only-show-errors; done
aws s3 sync . $BUCKET/ --delete $EXCL --only-show-errors
for d in $DISTRIBUTIONS; do aws cloudfront create-invalidation --distribution-id $d --paths "/*" --query Invalidation.Id --output text; done

echo "Done ($MODE). In a minute, search hotels or flights on https://www.lyrtrip.com — you should see the $MODE notice."
