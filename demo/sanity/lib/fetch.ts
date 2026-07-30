import { createClient } from 'next-sanity';

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'xeuwlpc2',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2026-07-01',
  useCdn: false,
});

/**
 * Minimal sanityFetch helper matching next-sanity's `{ data }` return shape,
 * which is what the variant route (Prompt 3) expects by default.
 */
export async function sanityFetch<QueryResponse = unknown>({
  query,
  params = {},
}: {
  query: string;
  params?: Record<string, unknown>;
}): Promise<{ data: QueryResponse }> {
  const data = await client.fetch<QueryResponse>(query, params);
  return { data };
}

export type Page = {
  _id: string;
  title: string | null;
  slug: string | null;
  buttonColor: 'white' | 'black' | null;
  buttonLabel: string | null;
};

const PAGE_BY_SLUG_QUERY = `
  *[_type == "page" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    buttonColor,
    buttonLabel
  }
`;

/** Load one renderable page document by its slug. */
export async function fetchPageBySlug(slug: string): Promise<Page | null> {
  return client.fetch<Page | null>(PAGE_BY_SLUG_QUERY, { slug });
}
