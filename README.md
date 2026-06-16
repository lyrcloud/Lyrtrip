# Lyrtrip

A music trip planning application built with [Next.js](https://nextjs.org), [TypeScript](https://www.typescriptlang.org/), AWS S3/CloudFront/Lambda, Amazon Cognito, and MongoDB Atlas.

## Tech Stack

- **Frontend**: Next.js 16 with App Router and TypeScript
- **Styling**: Tailwind CSS
- **Hosting**: S3 and CloudFront
- **API**: AWS Lambda behind CloudFront at `/api/*`
- **Auth**: Amazon Cognito User Pools
- **Database**: MongoDB Atlas
- **Package Manager**: npm

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A MongoDB Atlas cluster
- An Amazon Cognito User Pool with an app client that supports `USER_PASSWORD_AUTH`
- A Google Maps API key with the Maps JavaScript API and Places API enabled

### Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file based on `.env.local.example`:

```bash
cp .env.local.example .env.local
```

3. Add credentials to `.env.local`:

- `NEXT_PUBLIC_COGNITO_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID`
- `COGNITO_USER_POOL_ID`
- `COGNITO_USER_POOL_CLIENT_ID`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_COGNITO_DOMAIN` (Cognito Hosted UI domain, for Google/Facebook sign-in)
- `NEXT_PUBLIC_WECHAT_APP_ID` (WeChat Open Platform app ID, for WeChat sign-in)

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for how to configure Google, Facebook, and WeChat sign-in end to end.

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```txt
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # Reusable React components
├── lib/              # Auth and API helpers
└── types/            # TypeScript type definitions

infra/
├── lambda/           # Lambda API handler and package metadata
├── deploy.sh         # S3/CloudFront/Lambda deployment script
└── template.yml      # CloudFormation/SAM template
```

## AWS Deployment

The production setup exports the Next.js frontend to static files for S3 and routes `/api/*` through Lambda behind CloudFront.

Set these environment variables before deployment:

- `AWS_REGION`
- `STACK_NAME`
- `LAMBDA_FUNCTION_NAME`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `COGNITO_USER_POOL_ID`
- `COGNITO_USER_POOL_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

For Cloudflare or external DNS, also set `ACM_CERTIFICATE_ARN` to an ACM certificate in `us-east-1`.

```bash
chmod +x infra/deploy.sh
ENABLE_ROUTE53=false \
  ACM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/abcdef01-2345-6789-abcd-ef0123456789 \
  AWS_REGION=us-east-1 \
  STACK_NAME=lyrtrip-site \
  LAMBDA_FUNCTION_NAME=Lyrtrip \
  ./infra/deploy.sh www.lyrtrip.com
```

Then add a DNS record for the CloudFront distribution domain.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build and export the static site
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Vitest

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
