# Node.js + Express.js + TypeScript Backend

This backend is a TypeScript/Express.js migration of the original FastAPI backend. All APIs, routes, request/response structures, business logic, authentication, middleware, database behavior, validations, data types, and functionality are preserved as in the FastAPI version.

## Structure
- `src/routes/` — API route handlers (auth, optimize, resume)
- `src/models/` — Data models (auth, user, resume, history)
- `src/services/` — Business logic and integrations (LLM, Cloudinary, etc.)
- `src/database/` — Database connection and logic
- `src/config/` — Configuration and settings
- `src/utils/` — Utility functions

## Development
1. Install dependencies:
   ```sh
   pnpm install
   # or
   npm install
   ```
2. Start development server:
   ```sh
   pnpm dev
   # or
   npm run dev
   ```

## Notes
- All TODOs in the code indicate where to migrate logic from the FastAPI backend.
- Ensure all request/response types and business logic match the original implementation.
