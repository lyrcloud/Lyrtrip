# Lyrtrip

A music trip planning application built with [Next.js](https://nextjs.org), [TypeScript](https://www.typescriptlang.org/), and [Supabase](https://supabase.com).

## Tech Stack

- **Frontend**: Next.js 16 with App Router and TypeScript
- **Styling**: Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL)
- **Package Manager**: npm

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project
- A Google Maps API key with the Maps JavaScript API and Places API enabled

### Setup

1. Clone the repository and install dependencies:

```bash
npm install
```

1. Create a `.env.local` file based on `.env.local.example`:

```bash
cp .env.local.example .env.local
```

1. Add your Supabase credentials to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Your Google Maps browser API key

2. Run the development server:

```bash
npm run dev
```

1. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # Reusable React components
├── lib/              # Utility functions and helpers
│   ├── supabase.ts   # Supabase client configuration
│   └── auth.ts       # Authentication utilities
├── types/            # TypeScript type definitions
│   └── database.ts   # Database type definitions
└── styles/           # Global styles
```

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

## AWS Deployment

The production setup exports the Next.js frontend to static files for S3 and routes `/api/search` through Lambda behind CloudFront.

### Cloud Deployment

Use the **Deploy Lyrtrip to AWS** GitHub Actions workflow for a fully cloud-based deploy. Configure these repository secrets first:

- `AWS_ROLE_TO_ASSUME` - IAM role ARN trusted by GitHub OIDC for this repository
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

To create the GitHub OIDC deploy role, open AWS CloudFormation in `us-east-1`, create a stack from `infra/github-oidc-role.yml`, and copy the `RoleArn` output into the repository secret `AWS_ROLE_TO_ASSUME`.

Then run the workflow from GitHub Actions with `domain_name` set to `lyrtrip.com`.

### Local Deployment

```bash
chmod +x infra/deploy.sh
AWS_REGION=us-east-1 STACK_NAME=lyrtrip-site LAMBDA_FUNCTION_NAME=Lyrtrip ./infra/deploy.sh lyrtrip.com
```

## Development Guidelines

- Use TypeScript strictly (no `any` types without justification)
- Prefer functional components with hooks
- Use server components when possible for better performance
- Add proper error handling and loading states
- Write JSDoc comments for complex functions
- Handle database operations through Supabase client

## Database Setup

Supabase tables needed for Lyrtrip:

- `users` - User profiles
- `trips` - Music trips
- `venues` - Concert venues and locations
- `playlists` - Trip playlists
- `songs` - Songs in playlists

See the `database.ts` type definitions for the expected schema.

## Deployment

The app is ready to deploy to Vercel, Netlify, or any platform supporting Next.js.

Remember to add environment variables to your hosting platform:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
