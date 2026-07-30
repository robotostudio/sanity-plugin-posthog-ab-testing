/**
 * The A/B test GROQ contract. Field names are fixed by the Studio plugin
 * (sanity-plugin-posthog-ab-testing). If you configured a custom schemaType,
 * change "posthogAbTest" below — nowhere else.
 */
export const AB_TEST_BY_SLUG_QUERY = `
  *[_type == "posthogAbTest" && enabled == true
    // && language == $language  // OPTIONAL: uncomment when using languageField,
                                 // and pass $language wherever this query runs
    && $slug in variants[].page->slug.current][0]{
    _id,
    name,
    posthogFlagKey,
    "variantMap": variants[]{
      "key": variantKey,
      "slug": page->slug.current
    }
  }
`;
