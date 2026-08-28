/** @type {import('next').NextConfig} */

// The API is called with RELATIVE paths (see app/lib/api.ts) and this rewrite is
// what turns /api/... into a real backend request. That means the destination
// below is not a convenience - it is the only thing pointing the frontend at a
// backend, and it used to be hardcoded to http://127.0.0.1:8000. Deployed to
// Vercel that resolves to the serverless function's own loopback, where nothing
// is listening, so every single API call fails with the frontend rendering fine.
//
// BACKEND_ORIGIN (no NEXT_PUBLIC_ prefix on purpose: rewrites are evaluated on
// the server, so the value never reaches the browser bundle) has the local
// default, so `npm run dev` keeps working with no .env file at all.
const BACKEND_ORIGIN = (process.env.BACKEND_ORIGIN || 'http://127.0.0.1:8000')
  .replace(/\/+$/, '')

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
