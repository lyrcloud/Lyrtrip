#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <domain-name> [hosted-zone-id]" >&2
  exit 1
fi

DOMAIN_NAME="$1"
HOSTED_ZONE_ID="${2:-}"
STACK_NAME="${STACK_NAME:-lyrtrip-site}"
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-Lyrtrip}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-${STACK_NAME}-artifacts-${ACCOUNT_ID}-${REGION}}"
PACKAGED_TEMPLATE="/tmp/${STACK_NAME}-packaged.yml"

if [[ -z "$HOSTED_ZONE_ID" ]]; then
  HOSTED_ZONE_ID="$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='${DOMAIN_NAME}.' || Name=='${DOMAIN_NAME}'].Id | [0]" \
    --output text)"

  if [[ -z "$HOSTED_ZONE_ID" || "$HOSTED_ZONE_ID" == "None" ]]; then
    echo "Could not find a Route 53 hosted zone for ${DOMAIN_NAME}. Pass the hosted zone ID explicitly." >&2
    exit 1
  fi

  HOSTED_ZONE_ID="${HOSTED_ZONE_ID##*/}"
fi

npm install
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
  --parameter-overrides DomainName="$DOMAIN_NAME" HostedZoneId="$HOSTED_ZONE_ID" FunctionName="$FUNCTION_NAME"

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
