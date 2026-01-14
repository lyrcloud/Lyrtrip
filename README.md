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

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
