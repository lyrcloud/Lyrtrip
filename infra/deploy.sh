#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <domain-name> [hosted-zone-id]" >&2
  echo "Set ENABLE_ROUTE53=true to manage DNS in Route 53, or set ACM_CERTIFICATE_ARN for Cloudflare/external DNS." >&2
  exit 1
fi

DOMAIN_NAME="$1"
HOSTED_ZONE_ID="${2:-}"
ENABLE_ROUTE53="${ENABLE_ROUTE53:-false}"
ACM_CERTIFICATE_ARN="${ACM_CERTIFICATE_ARN:-}"
STACK_NAME="${STACK_NAME:-lyrtrip-site}"
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-Lyrtrip}"
MONGODB_URI="${MONGODB_URI:-}"
MONGODB_DB_NAME="${MONGODB_DB_NAME:-lyrtrip}"
COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-}"
COGNITO_USER_POOL_CLIENT_ID="${COGNITO_USER_POOL_CLIENT_ID:-}"
WECHAT_APP_ID="${WECHAT_APP_ID:-}"
WECHAT_APP_SECRET="${WECHAT_APP_SECRET:-}"
WECHAT_AUTH_SHARED_SECRET="${WECHAT_AUTH_SHARED_SECRET:-}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-${STACK_NAME}-artifacts-${ACCOUNT_ID}-${REGION}}"
PACKAGED_TEMPLATE="/tmp/${STACK_NAME}-packaged.yml"

if [[ "$ENABLE_ROUTE53" == "true" ]]; then
  if [[ -z "$HOSTED_ZONE_ID" ]]; then
    POSSIBLE_ZONE_NAMES=("$DOMAIN_NAME" "${DOMAIN_NAME#*.}")
    for ZONE_NAME in "${POSSIBLE_ZONE_NAMES[@]}"; do
      if [[ -z "$ZONE_NAME" ]]; then
        continue
      fi

      HOSTED_ZONE_ID="$(aws route53 list-hosted-zones \
        --query "HostedZones[?Name=='${ZONE_NAME}.' || Name=='${ZONE_NAME}'].Id | [0]" \
        --output text)"

      if [[ -n "$HOSTED_ZONE_ID" && "$HOSTED_ZONE_ID" != "None" ]]; then
        HOSTED_ZONE_ID="${HOSTED_ZONE_ID##*/}"
        break
      fi
    done

    if [[ -z "$HOSTED_ZONE_ID" || "$HOSTED_ZONE_ID" == "None" ]]; then
      echo "Could not find a Route 53 hosted zone for ${DOMAIN_NAME}. Pass the hosted zone ID explicitly." >&2
      exit 1
    fi
  fi
fi

if [[ "$ENABLE_ROUTE53" != "true" && -z "$ACM_CERTIFICATE_ARN" ]]; then
  echo "When DNS is managed outside Route 53, set ACM_CERTIFICATE_ARN to an existing ACM certificate ARN in us-east-1." >&2
  exit 1
fi

npm install
npm install --prefix infra/lambda --omit=dev
npm run build

if ! aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" >/dev/null 2>&1; then
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket \
      --bucket "$ARTIFACT_BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
fi

aws cloudformation package \
  --region "$REGION" \
  --template-file infra/template.yml \
  --s3-bucket "$ARTIFACT_BUCKET" \
  --output-template-file "$PACKAGED_TEMPLATE"

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$PACKAGED_TEMPLATE" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    DomainName="$DOMAIN_NAME" \
    HostedZoneId="$HOSTED_ZONE_ID" \
    EnableRoute53="$ENABLE_ROUTE53" \
    AcmCertificateArn="$ACM_CERTIFICATE_ARN" \
    FunctionName="$FUNCTION_NAME" \
    MongoDbUri="$MONGODB_URI" \
    MongoDbName="$MONGODB_DB_NAME" \
    CognitoUserPoolId="$COGNITO_USER_POOL_ID" \
    CognitoUserPoolClientId="$COGNITO_USER_POOL_CLIENT_ID" \
    WeChatAppId="$WECHAT_APP_ID" \
    WeChatAppSecret="$WECHAT_APP_SECRET" \
    WeChatAuthSharedSecret="$WECHAT_AUTH_SHARED_SECRET"

BUCKET_NAME="$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)"

DISTRIBUTION_ID="$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)"

aws s3 sync out/ "s3://${BUCKET_NAME}/" --delete
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"

aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs" \
  --output table
