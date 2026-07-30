import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ABTestTracker } from '@/components/ab-test-tracker';
import { CONTROL_VARIANT_KEY } from '@/lib/ab-testing';
import { AB_TEST_BY_SLUG_QUERY } from '@/sanity/queries/ab-test';
// TODO(host) filled: this project's Sanity fetch helper.
import { sanityFetch } from '@/sanity/lib/fetch';
// TODO(host) filled: this project's "load one page by slug" helper.
import { fetchPageBySlug } from '@/sanity/lib/fetch';
import { DemoPage } from '@/components/demo-page';

type ABTestParams = { variant: string; slug: string[] };

type ABTestResult = {
  posthogFlagKey: string | null;
  variantMap: { key: string | null; slug: string | null }[] | null;
} | null;

/** Decode the base64url-encoded flags parameter from the proxy rewrite. */
function decodeFlags(encoded: string): Record<string, string> {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
  } catch {
    return {};
  }
}

/**
 * Convert the URL slug path to the format stored in Sanity's slug.current.
 * The homepage travels as '_home'; other pages store slugs without a leading
 * slash. TODO(host) filled: this demo's homepage document is the 'home' slug
 * (the experiment's control page), so '/' serves the A/B test directly.
 */
function toSanitySlug(slugPath: string): string {
  return slugPath === '_home' ? 'home' : slugPath;
}

/**
 * Resolve which page to display for this A/B test variant.
 * Wrapped with React.cache() to deduplicate across generateMetadata + render.
 */
const resolveVariantPage = cache(async (params: ABTestParams) => {
  const slugPath = params.slug.join('/');
  const flags = decodeFlags(params.variant);
  const pageSlug = toSanitySlug(slugPath);

  // next-sanity-style sanityFetch resolves to `{ data }`.
  const { data } = await sanityFetch({
    query: AB_TEST_BY_SLUG_QUERY,
    params: { slug: pageSlug },
  });
  const abTest = data as ABTestResult;

  // No active test for this slug — render the requested page normally
  if (!abTest?.variantMap || !abTest.posthogFlagKey) {
    const page = await fetchPageBySlug(pageSlug);
    return { page, slugPath, flagKey: null, variant: null };
  }

  // CONTROL-PAGE RULE: only apply A/B logic when the visitor requested the
  // control page. If they navigated directly to a non-control variant page,
  // render that page normally — never redirect them to their assigned variant.
  const controlEntry = abTest.variantMap.find((v) => v.key === CONTROL_VARIANT_KEY);
  const isControlPage = controlEntry?.slug === pageSlug;

  if (!isControlPage) {
    const page = await fetchPageBySlug(pageSlug);
    return { page, slugPath, flagKey: null, variant: null };
  }

  const flagValue = flags[abTest.posthogFlagKey];
  const variantEntry = abTest.variantMap.find((v) => v.key === flagValue);

  const resolvedSlug = variantEntry?.slug ?? controlEntry?.slug;
  const resolvedVariant = variantEntry && flagValue ? flagValue : CONTROL_VARIANT_KEY;

  if (!resolvedSlug) {
    const page = await fetchPageBySlug(pageSlug);
    return { page, slugPath, flagKey: null, variant: null };
  }

  const page = await fetchPageBySlug(resolvedSlug);
  return { page, slugPath, flagKey: abTest.posthogFlagKey, variant: resolvedVariant };
});

export async function generateMetadata(props: { params: Promise<ABTestParams> }) {
  const params = await props.params;
  const { page, slugPath } = await resolveVariantPage(params);
  if (!page) return {};
  const canonicalSlug = slugPath === '_home' ? '/' : slugPath;
  // TODO(host) filled: minimal metadata — title from the page, canonical from
  // canonicalSlug (the ORIGINAL requested URL), never the variant's own slug.
  return {
    title: page.title ?? undefined,
    alternates: { canonical: canonicalSlug === '/' ? '/' : `/${canonicalSlug}` },
  };
}

export default async function ABTestPage(props: { params: Promise<ABTestParams> }) {
  const params = await props.params;
  const { page, flagKey, variant } = await resolveVariantPage(params);

  if (!page) notFound();

  return (
    <>
      {flagKey && variant && <ABTestTracker flagKey={flagKey} variant={variant} />}
      {/* TODO(host) filled: DemoPage is the exact component tree the normal
          page route (app/[...slug]/page.tsx) uses. */}
      <DemoPage page={page} />
    </>
  );
}
