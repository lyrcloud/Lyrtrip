# Lyrtrip - AI Pair Programming Instructions

## Project Overview
Lyrtrip is a music trip planning application built with Next.js 16, TypeScript, and Supabase. This guide helps maintain consistency and best practices throughout the development process.

## Tech Stack
- **Frontend**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL)
- **Package Manager**: npm

## Project Structure
```
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # Reusable React components
├── lib/              # Utility functions and helpers
│   ├── supabase.ts   # Supabase client configuration
│   └── auth.ts       # Authentication utilities
├── types/            # TypeScript type definitions
└── styles/           # Global styles
```

## Development Workflow

### When Adding Features
1. Create TypeScript components with proper typing
2. Use Supabase client for database operations
3. Follow Next.js App Router patterns for routes
4. Add unit tests for utilities and complex logic
5. Keep components focused and reusable

### Code Standards
- Use TypeScript strictly (no `any` types without justification)
- Prefer functional components with hooks
- Use server components when possible for better performance
- Add proper error handling and loading states
- Write JSDoc comments for complex functions

### Database Operations
- Use Supabase client from `lib/supabase.ts`
- Create type definitions for database tables
- Handle errors appropriately with user-friendly messages
- Use transactions for multi-step operations

### Authentication
- Use Supabase Auth for user management
- Store user session in secure context
- Protect routes with proper middleware
- Handle auth state changes gracefully

## Deployment
The app is ready to deploy to Vercel, Netlify, or any platform supporting Next.js 16.

Key environment variables needed:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Running the Application
```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Additional Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/)
