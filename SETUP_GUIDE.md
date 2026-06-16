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
NEXT_PUBLIC_COGNITO_DOMAIN=
NEXT_PUBLIC_WECHAT_APP_ID=
```

For deployed Lambda, also export `MONGODB_URI`, `MONGODB_DB_NAME`, `COGNITO_USER_POOL_ID`, `COGNITO_USER_POOL_CLIENT_ID`, `WECHAT_APP_ID`, `WECHAT_APP_SECRET`, and `WECHAT_AUTH_SHARED_SECRET` before running `infra/deploy.sh`.

## Cognito

Create a Cognito User Pool and app client. The browser auth helper uses `USER_PASSWORD_AUTH` for email/password and the Authorization Code + PKCE flow for Google/Facebook, so enable both `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_USER_SRP_AUTH`/`ALLOW_REFRESH_TOKEN_AUTH` plus the OAuth code grant on the app client. Do not configure a client secret for a browser app client.

## Social sign-in

### Google

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID (type "Web application").
2. Add `https://<your-cognito-domain>/oauth2/idpresponse` as an authorized redirect URI.
3. In the Cognito console, under **Sign-in experience → Federated identity provider sign-in**, add a **Google** identity provider with that client ID/secret and map attributes `email`, `name`, `picture` to the corresponding user pool attributes.
4. Add **Google** to the app client's allowed identity providers, and add `https://<your-app-domain>/auth/callback` to the app client's allowed callback URLs.

### Facebook

1. In [Meta for Developers](https://developers.facebook.com/apps), create an app with the **Facebook Login** product.
2. Add `https://<your-cognito-domain>/oauth2/idpresponse` as a valid OAuth redirect URI.
3. In the Cognito console, add a **Facebook** identity provider with the app ID/secret, scopes `email,public_profile`, and map `email`, `name`, `picture`.
4. Add **Facebook** to the app client's allowed identity providers and callback URLs as above.

### Cognito Hosted UI domain

Both flows above route through the Hosted UI's `/oauth2/authorize` and `/oauth2/token` endpoints (no Hosted UI login screen is shown — the app links straight to each provider). Create a domain under **App integration → Domain** and set it as `NEXT_PUBLIC_COGNITO_DOMAIN`.

### WeChat

Cognito has no native WeChat identity provider, so Lyrtrip bridges it in with a small Lambda + a Cognito `CUSTOM_AUTH` challenge:

1. Register a website app on the [WeChat Open Platform](https://open.weixin.qq.com/) and get an **AppID**/**AppSecret**. Set the authorized callback domain to your app's domain.
2. Set `NEXT_PUBLIC_WECHAT_APP_ID` (public) and, for the Lambda, `WECHAT_APP_ID`/`WECHAT_APP_SECRET` (server-side only).
3. Generate a random `WECHAT_AUTH_SHARED_SECRET` (e.g. `openssl rand -hex 32`) — this is a server-only secret shared between the API Lambda and the auth-challenge Lambda; it never reaches the browser or WeChat.
4. Deploy (`infra/deploy.sh`), which creates `AuthChallengeFunction` (`infra/lambda/auth-challenge.mjs`) and grants the API Lambda permission to call `AdminCreateUser`/`AdminInitiateAuth`/etc. on your user pool.
5. Because the User Pool isn't owned by this CloudFormation stack, attach the three triggers once via CLI (merge with any other `--lambda-config` keys you already have):

   ```bash
   aws cognito-idp update-user-pool --user-pool-id <POOL_ID> \
     --lambda-config DefineAuthChallenge=<AuthChallengeFunctionArn>,CreateAuthChallenge=<AuthChallengeFunctionArn>,VerifyAuthChallengeResponse=<AuthChallengeFunctionArn>
   ```

   `<AuthChallengeFunctionArn>` is printed in the stack outputs as `AuthChallengeFunctionArn`.

How it works: the frontend redirects to WeChat's QR login, WeChat redirects back to `/auth/wechat/callback` with a code, and the frontend posts that code to `POST /api/auth/wechat`. The Lambda exchanges it for a WeChat profile, upserts a Cognito user keyed by `wechat_<openid>`, then silently completes a one-shot `CUSTOM_AUTH` challenge (using the shared secret as proof it already verified the user) to mint real User Pool tokens.

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
  WECHAT_APP_ID=<wechat-app-id> \
  WECHAT_APP_SECRET=<wechat-app-secret> \
  WECHAT_AUTH_SHARED_SECRET=<random-secret> \
  ./infra/deploy.sh www.lyrtrip.com
```

After the first deploy, run the one-time `aws cognito-idp update-user-pool --lambda-config ...` command from the [WeChat](#wechat) section above to finish wiring WeChat sign-in.

## Important Files

- `src/lib/auth.ts` - Cognito + social/federated authentication helper functions
- `src/lib/api.ts` - Browser API helper for Lambda routes
- `src/context/AuthContext.tsx` - App-wide auth state (`useAuth()`)
- `src/components/AuthForm.tsx`, `src/components/SocialButton.tsx` - Sign-in/sign-up UI
- `src/app/login`, `src/app/auth/callback`, `src/app/auth/wechat/callback` - Auth pages
- `src/app/dashboard` - User dashboard
- `infra/lambda/search.mjs` - Lambda handler for `/api/search`, `/api/tours`, and `/api/auth/wechat`
- `infra/lambda/auth-challenge.mjs` - Cognito `CUSTOM_AUTH` triggers for the WeChat bridge
- `infra/template.yml` - S3, CloudFront, Lambda, and Function URL infrastructure
- `.env.local.example` - Environment variable template
