#!/usr/bin/env bash
# Deploy www.lyrtrip.com: the search API Lambda (from HEAD) and the static frontend.
#
#   bash infra/deploy-site.sh
#
# Set ANTHROPIC_API_KEY in .env.local for Lyrbot, the help assistant (optional: without it Lyrbot
# points visitors to WhatsApp and email).
# Needs DUFFEL_API_KEY in .env.local. While it is a duffel_test_ key, flight checkouts are paid
# with the Stripe TEST key from .env.local (STRIPE_SECRET_KEY=sk_test_...) so no real card is
# charged for a test ticket; the site's own Stripe key on the Lambda is left alone. With a
# duffel_live_ key, flights are paid with the Lambda's main STRIPE_SECRET_KEY, which must be
# sk_live_ (checkout refuses otherwise).
#
# Steps: rollback version → deploy API code from HEAD → merge settings (Duffel in, leftover
# TRAVELPORT_* out) → API routes → build and publish the frontend.
set -euo pipefail

FUNCTION=lyrtrip-search
API_ID=73j9469lxd
BUCKET=s3://lyrtrip-website-hosting
DISTRIBUTIONS="E2MAYSXZB0XTQ1 E2T1R9OO63W8NI"
R="--region us-east-1"

cd "$(git rev-parse --show-toplevel)"
[[ -z "$(git status --porcelain infra/lambda src)" ]] || { echo "Uncommitted changes in infra/lambda or src; commit first" >&2; exit 1; }
node scripts/extract-i18n.mjs --check
set -a; . ./.env.local; set +a
[[ -n "${DUFFEL_API_KEY:-}" ]] || { echo "Missing DUFFEL_API_KEY in .env.local" >&2; exit 1; }
if [[ "$DUFFEL_API_KEY" == duffel_test_* ]]; then
  [[ "${STRIPE_SECRET_KEY:-}" == sk_test_* ]] || { echo "Duffel test mode needs a Stripe TEST key (sk_test_...) in .env.local" >&2; exit 1; }
  export DUFFEL_STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
else
  export DUFFEL_STRIPE_SECRET_KEY=""
fi

echo "1/5 rollback point"
aws lambda publish-version --function-name $FUNCTION $R --description "before deploy of $(git rev-parse --short HEAD)" --query Version --output text

echo "2/5 deploy API code from $(git rev-parse --short HEAD)"
T=$(mktemp -d)
for f in search.mjs rewards.mjs package.json package-lock.json i18n-strings.json; do git show "HEAD:infra/lambda/$f" > "$T/$f"; done
(cd "$T" && npm ci --omit=dev --silent && zip -qr "$T.zip" .)
aws lambda update-function-code --function-name $FUNCTION $R --zip-file "fileb://$T.zip" --query LastUpdateStatus --output text
aws lambda wait function-updated-v2 --function-name $FUNCTION $R

echo "3/5 settings (Duffel, Anthropic, Easyship, Uber Direct and Guest Rides in, TRAVELPORT_* out, existing keys kept)"
ENV_FILE=$(mktemp); chmod 600 "$ENV_FILE"
aws lambda get-function-configuration --function-name $FUNCTION $R --query 'Environment.Variables' --output json |
  node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const cur = JSON.parse(s || "{}") || {};
      const dropped = Object.keys(cur).filter(k => k.startsWith("TRAVELPORT_"));
      for (const k of dropped) delete cur[k];
      cur.DUFFEL_API_KEY = process.env.DUFFEL_API_KEY;
      // Hotel requests: emails from the verified lyrtrip.com domain, admin sign-in via Cognito ID tokens
      cur.SES_FROM_EMAIL = cur.SES_FROM_EMAIL || "bookings@lyrtrip.com";
      for (const k of ["COGNITO_USER_POOL_ID", "COGNITO_USER_POOL_CLIENT_ID"]) if (process.env[k]) cur[k] = process.env[k];
      // Lyrbot (the help assistant) answers with Claude; without a key it offers WhatsApp and email instead
      if (process.env.ANTHROPIC_API_KEY) cur.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      // Shipping tab: courier rates and labels from Easyship
      if (process.env.EASYSHIP_API_KEY) cur.EASYSHIP_API_KEY = process.env.EASYSHIP_API_KEY;
      // Dash courier delivery: Uber Direct
      for (const k of ["UBER_DIRECT_CUSTOMER_ID", "UBER_DIRECT_CLIENT_ID", "UBER_DIRECT_CLIENT_SECRET"]) if (process.env[k]) cur[k] = process.env[k];
      // Second courier provider: DoorDash Drive, used only when DOORDASH_ENABLED=true (never with sandbox keys)
      for (const k of ["DOORDASH_ENABLED", "DOORDASH_DEVELOPER_ID", "DOORDASH_KEY_ID", "DOORDASH_SIGNING_SECRET"]) if (process.env[k]) cur[k] = process.env[k];
      // Job profiles: photos and CVs in a private S3 bucket (created once by hand; see the commit notes)
      if (process.env.JOB_PROFILE_BUCKET) cur.JOB_PROFILE_BUCKET = process.env.JOB_PROFILE_BUCKET;
      // Car tab ride booking (Guest Rides): off unless RIDES_ENABLED=true; the base URL can point at the sandbox or a mock
      for (const k of ["RIDES_ENABLED", "UBER_GUEST_RIDES_BASE_URL", "UBER_GUEST_RIDES_TOKEN", "UBER_GUEST_RIDES_CLIENT_ID", "UBER_GUEST_RIDES_CLIENT_SECRET", "UBER_GUEST_RIDES_PRIVATE_KEY", "UBER_GUEST_RIDES_KEY_ID"]) if (process.env[k]) cur[k] = process.env[k];
      if (process.env.DUFFEL_STRIPE_SECRET_KEY) cur.DUFFEL_STRIPE_SECRET_KEY = process.env.DUFFEL_STRIPE_SECRET_KEY;
      else delete cur.DUFFEL_STRIPE_SECRET_KEY;   // live Duffel pays with the main STRIPE_SECRET_KEY
      require("fs").writeFileSync(process.argv[1], JSON.stringify({ Variables: cur }));
      console.log("dropped:", dropped.join(", ") || "(none)");
    });' "$ENV_FILE"
aws lambda update-function-configuration --function-name $FUNCTION $R --timeout 120 \
  --environment "file://$ENV_FILE" --query LastUpdateStatus --output text
rm -f "$ENV_FILE"
aws lambda wait function-updated-v2 --function-name $FUNCTION $R

echo "4/5 admin permissions, API routes and CORS"
# The admin console (/admin) manages accounts in the Lyrtrip user pool only; mobile sign-in also
# creates phone accounts there and texts codes through the Twilio account Lyrshop keeps in Secrets Manager.
[[ -n "${COGNITO_USER_POOL_ID:-}" ]] || { echo "Missing COGNITO_USER_POOL_ID in .env.local" >&2; exit 1; }
POOL_ARN=$(aws cognito-idp describe-user-pool --user-pool-id "$COGNITO_USER_POOL_ID" $R --query UserPool.Arn --output text)
ROLE_ARN=$(aws lambda get-function-configuration --function-name $FUNCTION $R --query Role --output text)
aws iam put-role-policy --role-name "${ROLE_ARN##*/}" --policy-name lyrtrip-admin-cognito --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Effect\": \"Allow\",
    \"Action\": [\"cognito-idp:ListUsers\", \"cognito-idp:AdminGetUser\", \"cognito-idp:AdminCreateUser\",
                 \"cognito-idp:AdminSetUserPassword\", \"cognito-idp:AdminUpdateUserAttributes\", \"cognito-idp:AdminDeleteUser\",
                 \"cognito-idp:AdminEnableUser\", \"cognito-idp:AdminDisableUser\"],
    \"Resource\": \"$POOL_ARN\"
  }, {
    \"Effect\": \"Allow\",
    \"Action\": \"secretsmanager:GetSecretValue\",
    \"Resource\": \"arn:aws:secretsmanager:us-east-1:$(aws sts get-caller-identity --query Account --output text):secret:lyrshop/twilio-*\"
  }]
}"
echo "admin policy on ${ROLE_ARN##*/}"
INTEGRATION=$(aws apigatewayv2 get-routes --api-id $API_ID $R --query "Items[?RouteKey=='POST /api/search'].Target" --output text)
for ROUTE in "POST /api/flight/{proxy+}" "POST /api/hotel/{proxy+}" "GET /api/tours" "POST /api/tours" "GET /api/tours/{id}" "POST /api/admin" "POST /api/rewards" "POST /api/ship/{proxy+}" "POST /api/delivery/{proxy+}" "POST /api/ride/{proxy+}" "POST /api/jobs" "POST /api/study" "POST /api/events" "POST /api/packages" "POST /api/helicopter" "POST /api/freight" "POST /api/legal" "POST /api/donations" "POST /api/client-error" "POST /api/assistant/chat" "GET /api/rates" "POST /api/i18n" "POST /api/auth/phone/{proxy+}"; do
  if aws apigatewayv2 get-routes --api-id $API_ID $R --query "Items[?RouteKey=='$ROUTE'].RouteId" --output text | grep -q .; then
    echo "exists: $ROUTE"
  else
    aws apigatewayv2 create-route --api-id $API_ID $R --route-key "$ROUTE" --target "$INTEGRATION" --query RouteKey --output text
  fi
done
# Tours send the Cognito access token, so preflight must allow GET and the authorization header.
# localhost:3000 lets a local build of the site talk to this API.
aws apigatewayv2 update-api --api-id $API_ID $R --cors-configuration \
  '{"AllowOrigins":["https://www.lyrtrip.com","https://lyrtrip.com","http://localhost:3000"],"AllowMethods":["GET","POST","OPTIONS"],"AllowHeaders":["authorization","content-type"],"MaxAge":86400}' \
  --query CorsConfiguration.AllowMethods --output text
ROUTE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID $R --query "Items[?RouteKey=='POST /api/travelport/{proxy+}'].RouteId" --output text)
if [[ -n "$ROUTE_ID" && "$ROUTE_ID" != None ]]; then
  aws apigatewayv2 delete-route --api-id $API_ID $R --route-id "$ROUTE_ID" && echo "removed: POST /api/travelport/{proxy+}"
else
  echo "no Travelport route"
fi

echo "5/5 frontend"
rm -rf out && npm run build >/dev/null
cd out
ROUTES=$(find . -name '*.html' ! -name index.html ! -name 404.html ! -name '_not-found.html' | sed 's|^\./||; s|\.html$||')
EXCL=""; for r in $ROUTES; do EXCL="$EXCL --exclude $r"; done
aws s3 sync . $BUCKET/ --exclude "*.html" $EXCL --only-show-errors
for f in $(find . -name '*.html' | sed 's|^\./||'); do aws s3 cp "$f" "$BUCKET/$f" --content-type text/html --cache-control no-cache --only-show-errors; done
for r in $ROUTES; do aws s3 cp "$r.html" "$BUCKET/$r" --content-type text/html --cache-control no-cache --only-show-errors; done
# Keep earlier builds' hashed JS/CSS: tabs still running an old build load them after this deploy
aws s3 sync . $BUCKET/ --delete $EXCL --exclude "_next/static/*" --only-show-errors
for d in $DISTRIBUTIONS; do aws cloudfront create-invalidation --distribution-id $d --paths "/*" --query Invalidation.Id --output text; done

echo "Done. In a minute, check https://www.lyrtrip.com"
