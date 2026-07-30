import { PostHog } from 'posthog-node';

/**
 * Create a PostHog server-side client.
 *
 * Returns a new instance each call — server functions in Next.js are
 * short-lived, so events must be sent immediately (flushAt: 1,
 * flushInterval: 0). Always call `await client.shutdown()` when done.
 */
export default function PostHogClient() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  return new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
}
