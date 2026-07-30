import type { NextConfig } from "next";

/**
 * /a is the deterministic white "A" view: it force-feeds the control flag to
 * the test route (base64url {"demo-button-color":"control"}), because the
 * control "page" is /home itself — there's no separate A document. The black
 * "B" page is a real Sanity page with slug 'b', so /b needs no rewrite.
 * beforeFiles so the /[...slug] catch-all doesn't swallow /a first. PostHog
 * flag keys (control/blue) are frozen; only the visual naming is A/B.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/a",
          destination: "/test/eyJkZW1vLWJ1dHRvbi1jb2xvciI6ImNvbnRyb2wifQ/home",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
