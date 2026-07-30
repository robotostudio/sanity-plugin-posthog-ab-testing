import { notFound } from 'next/navigation';
import { DemoPage } from '@/components/demo-page';
import { fetchPageBySlug } from '@/sanity/lib/fetch';

/**
 * Homepage = the A/B-tested demo page. Normally the proxy rewrites '/' to the
 * variant route (as the '_home' sentinel) before this renders; this direct
 * render is the fallback when flag evaluation fails or PostHog is down, and
 * serves the control page.
 */
export default async function Home() {
  const page = await fetchPageBySlug('home');
  if (!page) notFound();
  return <DemoPage page={page} />;
}
