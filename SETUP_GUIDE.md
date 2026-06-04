# Lyrtrip Setup Guide

Lyrtrip is configured for static AWS hosting with a Lambda API, Cognito authentication, and MongoDB Atlas persistence.

## What Is Set Up

- Next.js 16 with App Router and TypeScript
- Tailwind CSS
- Cognito email/password auth helpers
- MongoDB-backed Lambda API routes
- CloudFormation/SAM deployment for S3, CloudFront, and Lambda
- TypeScript record definitions
- Example auth and tour form components

## Environment Variables

Create `.env.local` from `.env.local.example` and fill in:

```bash
NEXT_PUBLIC_COGNITO_REGION=
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=
COGNITO_USER_POOL_ID=
COGNITO_USER_POOL_CLIENT_ID=
MONGODB_URI=
MONGODB_DB_NAME=lyrtrip
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

For deployed Lambda, also export `MONGODB_URI`, `MONGODB_DB_NAME`, `COGNITO_USER_POOL_ID`, and `COGNITO_USER_POOL_CLIENT_ID` before running `infra/deploy.sh`.

## Cognito

Create a Cognito User Pool and app client. The browser auth helper uses `USER_PASSWORD_AUTH`, so enable that auth flow on the app client. Do not configure a client secret for a browser app client.

## MongoDB Atlas

Create a MongoDB Atlas cluster and database named `lyrtrip` unless you set another `MONGODB_DB_NAME`. The Lambda currently writes tours to the `tours` collection.

For Lambda reliability, keep MongoDB client creation outside the request handler. The Lambda handler does this so warm invocations reuse the same MongoDB client.

## Deployment

```bash
npm install
npm install --prefix infra/lambda --omit=dev
npm run build
```

For AWS deployment:

```bash
chmod +x infra/deploy.sh
ENABLE_ROUTE53=false \
  ACM_CERTIFICATE_ARN=<certificate-arn-in-us-east-1> \
  AWS_REGION=us-east-1 \
  STACK_NAME=lyrtrip-site \
  LAMBDA_FUNCTION_NAME=Lyrtrip \
  MONGODB_URI=<mongodb-atlas-uri> \
  MONGODB_DB_NAME=lyrtrip \
  COGNITO_USER_POOL_ID=<user-pool-id> \
  COGNITO_USER_POOL_CLIENT_ID=<app-client-id> \
  ./infra/deploy.sh www.lyrtrip.com
```

## Important Files

- `src/lib/auth.ts` - Cognito authentication helper functions
- `src/lib/api.ts` - Browser API helper for Lambda routes
- `infra/lambda/search.mjs` - Lambda handler for `/api/search` and `/api/tours`
- `infra/template.yml` - S3, CloudFront, Lambda, and Function URL infrastructure
- `.env.local.example` - Environment variable template
