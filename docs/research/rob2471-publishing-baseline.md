

# ANGLE: listing-naming

RECOMMENDATION: RECOMMENDED PACKAGE NAME: `sanity-plugin-posthog-ab-testing` (unscoped).

Reasoning:
1. AVAILABLE — verified free on the npm registry at 2026-07-30 ({"error":"Not found"}).
2. PASSES plugin-kit's hard validator — starts with `sanity-plugin-`, so `validatePackageName` in @sanity/plugin-kit@10.0.2 will not throw, and `verify-package` will not flag it. It also does not end in "plugin", so it clears the init-time `Name shouldn't include "plugin" multiple times` check.
3. UNSCOPED matches the overwhelming directory convention (a sampled community page of 43 listings was 100% unscoped), avoids Sanity's documented scoped-package footgun (`publishConfig: {access: "public"}`), and avoids needing to register/verify an npm org — whose availability I could NOT confirm anyway.
4. Scoping buys us nothing here: the Exchange strips the scope from the listing slug (@operationnation/sanity-plugin-schema-markup lists as /plugins/sanity-plugin-schema-markup), so `@roboto/*` would surrender the branding it was meant to gain while adding friction. Put Roboto branding in the Exchange author profile, README, and repo — not the package name.
5. NAME DIFFERENTIATION IS FORCED, not optional: `sanity-plugin-ab-testing` is taken by an actively-maintained direct competitor (Marko Bilanović, released 2026-06-08, same "content variants in the CMS" pitch). "posthog" is precisely the differentiator that states our unique angle, and it captures both high-intent search terms ("posthog" + "ab testing") in one name.
6. `sanity-plugin-posthog` (the obvious short name) is taken by a dormant but unrelated analytics-dashboard plugin, so the compound name is also the collision-avoidance choice.

Runner-up: `sanity-plugin-posthog-experiments` (also free) — "Experiments" is PostHog's own product noun, so it reads more native to PostHog users. I prefer "ab-testing" because it is the more searched, more self-explanatory term for people who arrive from the Sanity side rather than the PostHog side. Consider publishing `sanity-plugin-posthog-experiments` as a thin alias/deprecated-pointer package to squat the obvious alternative and capture that search traffic.

ACTION ITEMS:
- Claim `sanity-plugin-posthog-ab-testing` on npm now (publish a 0.0.0 placeholder) before the competitor expands into the PostHog niche.
- Set keywords to ["sanity","sanity-plugin","posthog","ab-testing","experiments","personalization"] — keep the first two exactly, as every listed plugin carries them.
- Scaffold with `npx @sanity/plugin-kit@latest init` (v10.0.2, actively released 2 days ago) so package.json shape, exports and verify-package all conform by construction.
- Treat Exchange listing as a SEPARATE ticket: it is manual submission via community.sanity.tools, NOT automatic keyword scraping. Publishing to npm alone will never get us onto sanity.io/plugins.
- Do NOT attempt to contribute into the sanity-io/plugins monorepo — CONTRIBUTING.md scopes it to Sanity's own internal teams. Standalone public repo under the Roboto GitHub org is correct.
- README should carry an explicit "unofficial / not affiliated with PostHog or Sanity" disclaimer, since the name contains both third-party marks.

- [verified-primary] sanity-plugin-ab-testing is ALREADY TAKEN on npm — by a direct competitor to what we are building
  Verified live via registry.npmjs.org. latest=0.1.5, published 2026-06-08T20:28:00.316Z, package created 2026-04-15T14:59:08.160Z, maintainer 'bilanovic90' (Marko Bilanović), repo github.com/markobilanovic/sanity-plugin-ab-testing, keywords ['sanity','sanity-plugin']. Description verbatim: "Define A/B tests in Sanity by creating content variants directly in the CMS." This is an actively-maintained, same-problem-space plugin — the name is unavailable AND competing for the same search terms.

- [verified-primary] sanity-plugin-posthog is TAKEN, but by an unrelated analytics-dashboard plugin
  latest=1.0.2, published 2025-06-16T11:01:45.129Z, maintainer 'theothershreyas', repo github.com/shreydd/posthog-sanity-plugin. Description verbatim: "Get posthog analytics right into the sanity studio" — it surfaces PostHog analytics inside Studio, it is not A/B testing. Appears dormant (no release in ~13 months as of 2026-07-30).

- [verified-primary] THREE of the five candidate names are FREE on npm right now
  Checked live 2026-07-30, all returned {"error":"Not found"}: sanity-plugin-posthog-ab-testing (FREE), sanity-plugin-posthog-experiments (FREE), sanity-plugin-personalization-posthog (FREE). Also verified free as fallbacks: sanity-plugin-posthog-ab, sanity-plugin-experiments, sanity-plugin-page-ab-testing, sanity-plugin-posthog-personalization, sanity-plugin-ab-test.

- [verified-primary] @sanity/plugin-kit HARD-ENFORCES the naming rule in code: unscoped names MUST start with 'sanity-plugin-', OR the name must be scoped
  Decompiled from @sanity/plugin-kit@10.0.2 dist/package-8cUY5BVf.js. Two separate enforcement points. validatePackageName (throws, used by build): `if (manifest.name[0] !== "@" && !manifest.name.startsWith("sanity-plugin-")) throw Error("Invalid package.json: \"name\" should be prefixed with \"sanity-plugin-\" (or scoped - @your-company/plugin-name)")`. And the verify-package variant returns the same message as a lint error. CRITICAL: scoped packages are EXPLICITLY blessed by the tooling — '(or scoped - @your-company/plugin-name)' is Sanity's own wording.

- [verified-primary] plugin-kit's init scaffolder auto-prefixes 'sanity-plugin-' and rejects names ending in 'plugin'
  From the same bundle, promptForPackageName: prompt text is verbatim `"Plugin name (sanity-plugin-...)"`. Filter: `let prefixless = name.trim().replace(/^sanity-plugin-/, ""); return name[0] === "@" ? name : `sanity-plugin-${prefixless}`;` — i.e. it force-prefixes anything unscoped and passes scoped names through untouched. Validator: `name[0] !== "@" && name.endsWith("plugin") ? `Name shouldn't include "plugin" multiple times (${name})` : !0`. So 'sanity-plugin-posthog-plugin' would be rejected; our candidates all pass.

- [verified-primary] The keywords plugin-kit scaffolds are exactly ['sanity','sanity-plugin'] — and this is convention, not a listing gate
  From plugin-kit's package.json generator: `keywords: prev.keywords ?? ["sanity", "sanity-plugin"]`. Confirmed as the de-facto standard across every package inspected: @sanity/personalization-plugin@3.0.11, sanity-plugin-ab-testing, sanity-plugin-posthog, and @operationnation/sanity-plugin-schema-markup ALL carry keywords ['sanity','sanity-plugin']. IMPORTANT: I found no evidence these keywords cause automatic Exchange listing — see the submission finding.

- [verified-secondary] Listing on sanity.io/plugins is MANUAL SUBMISSION, not automatic npm keyword scraping
  The Exchange is itself powered by a Sanity Studio. Per Sanity docs (sanity.io/docs/studio/developing-plugins): you log in at community.sanity.tools with an existing Sanity account, select the 'Make your first contribution' guide, choose your contribution category, and follow the in-studio descriptions to fill in the content. So publishing to npm with the right keywords does NOT get you listed — you must separately author an Exchange entry. Budget a discrete task for this.

- [verified-primary] The third-party plugin directory is very much STILL OPEN and dominated by community plugins — the monorepo consolidation did NOT close it
  sanity.io/exchange/type=plugins reports live: "All Tools & Plugins (304)", "Official (43)", "Community (261)". Community entries outnumber official ~6:1. Directly contradicts any assumption that the sanity-io/plugins monorepo absorbed community plugins.

- [verified-primary] The sanity-io/plugins monorepo is for SANITY-INTERNAL teams only — it is NOT a route for our plugin
  CONTRIBUTING.md states verbatim: "All new official Studio plugins should be added to this monorepo" and "The plugins monorepo is the canonical home for all Studio plugins, whether built by the Studio App Team or any other team at Sanity." The scope boundary is 'any other team at Sanity', not the community. It also operates 'you build it, you own it' and requires an owner team in CODEOWNERS before merge. Confirms our plan (standalone public repo under the Roboto org + Exchange submission) is the correct and only path.

- [verified-primary] The monorepo consolidation swallowed the TOOLING too — @sanity/plugin-kit now ships from sanity-io/plugins
  @sanity/plugin-kit@10.0.2 (published 2026-07-28, i.e. 2 days ago) has repository.url git+ssh://git@github.com/sanity-io/plugins.git with directory 'packages/@sanity/plugin-kit'. @sanity/personalization-plugin@3.0.11 likewise points at directory 'plugins/@sanity/personalization-plugin'. Note the two different top-level dirs: 'packages/' for tooling, 'plugins/' for plugins. plugin-kit is on a v10 major and actively released, so scaffolding with `npx @sanity/plugin-kit@latest init` is current, not legacy.

- [verified-primary] SCOPED third-party plugins ARE listed in the directory — verified with two real examples
  Counter to the assumption that only unscoped names appear. (1) @operationnation/sanity-plugin-schema-markup — listed at sanity.io/plugins/sanity-plugin-schema-markup, install command shown verbatim as `npm i @operationnation/sanity-plugin-schema-markup`, author is community (Operation Nation / Shuvo Anirban Roy), npm latest 2.0.0. (2) @focus-reactive/sanity-plugin-inline-svg-input — listed at sanity.io/plugins/sanity-plugin-inline-svg-input, npm latest 1.3.1 (2026-05-05). So scoping is NOT an exclusion criterion.

- [verified-primary] The Exchange URL slug is always UNSCOPED even when the npm package is scoped — a real discoverability tax on scoping
  @operationnation/sanity-plugin-schema-markup lists at the slug sanity-plugin-schema-markup; @focus-reactive/sanity-plugin-inline-svg-input lists at sanity-plugin-inline-svg-input. The scope is stripped from the directory URL. Consequence: if we ship @roboto/posthog-ab-testing, the vendor identity vanishes from the listing URL, and the slug is decided by Sanity's dataset rather than by us — meaning a scoped package gets no branding benefit in the directory while still paying the npm-scope costs.

- [verified-primary] Unscoped sanity-plugin-* is overwhelmingly the dominant convention in the actual directory
  Sampled a full community listing page (43 entries): every single package name was unscoped — sanity-plugin-media, sanity-plugin-mux-input, sanity-plugin-markdown, sanity-plugin-color-input, sanity-plugin-seofields, etc. Zero scoped packages on that page. Scoped third-party plugins exist but are a clear minority.

- [verified-secondary] Scoped packages carry a concrete publishing footgun Sanity documents explicitly
  Sanity's developing-plugins docs note scoped packages (names starting with @) are "private by default" and require adding `"publishConfig": { "access": "public" }` to package.json. A missing line here is a silent first-release failure. Unscoped names avoid this entirely and avoid needing an npm org at all.

- [verified-primary] No @roboto or @robotostudio npm scope currently has any published package
  registry search API `?text=scope:roboto` and `scope:robotostudio` both return total=0. Note this proves only that no PUBLIC package exists under those scopes — it does NOT prove the org names are unclaimed. npmjs.com/org/<name> returned 403 (Cloudflare bot block), so org existence could not be confirmed. If we go scoped we would likely need to register the org first.

UNVERIFIED: ["Whether the npm orgs @roboto / @robotostudio are actually CLAIMED. The registry search shows 0 public packages under each, but npmjs.com/org/<name> returns 403 (Cloudflare bot protection) and org existence is not exposed unauthenticated. Needs a manual check while logged into npm before any scoped plan is viable.", "The Exchange submission form's exact required fields, and whether there is a human APPROVAL/moderation step with an SLA. community.sanity.tools requires a Sanity login, so I could not inspect the in-studio submission flow or any review queue live. Docs describe the submission flow but are silent on approval criteria, timelines, or vetting.", "Whether the Exchange auto-syncs npm metadata (version, description, keywords, README) after the initial submission, or whether every field is manually authored and must be manually re-updated on each release. This affects ongoing maintenance cost and I found no primary source either way.", "Exact scoped-vs-unscoped ratio across all 261 community plugins. I sampled one full listing page (43 entries, all unscoped) plus targeted searches that surfaced 2 scoped examples. The ratio is directionally clear (unscoped dominant) but not precisely quantified.", "Whether the 'sanity'/'sanity-plugin' npm keywords have ANY functional role in Exchange listing or search ranking. Every package inspected carries them, and plugin-kit scaffolds them, but I found no primary source stating they are read by the Exchange. Treat them as required-by-convention, not as a proven mechanism.", "PostHog's trademark/naming policy for third-party packages using 'posthog' in the package name. Not checked. sanity-plugin-posthog already exists unchallenged (13+ months), which is weak evidence it is tolerated, but this was not verified against PostHog's actual brand guidelines.", "Whether the Exchange enforces any uniqueness constraint on the derived slug \u2014 relevant because a scoped name's slug is auto-stripped and could in principle collide with an existing unscoped listing."]

## VERIFIER verdict=major-corrections
- WAS: 'No @roboto or @robotostudio npm scope currently has any published package' — registry search ?text=scope:roboto and scope:robotostudio both return total=0; 'If we go scoped we would likely need to re
  NOW: FALSE. The @robotostudio scope is already claimed AND published-to, by Roboto Studio itself. @robotostudio/senku exists: latest 0.2.0, published 2026-05-28T09:04:33.695Z, package created 2026-05-21T12:24:39.440Z, maintainer 'voidstudio', repository git+https://github.com/robotostudio/senku.git, description 'Estimate dev hours per Linear ticket from git history + AI. A stateless library plus an interactive CLI; runs on Node and on Trigger.dev.' A second Roboto scope also exists: @roboto-studio/utils, 0.1.0, published 2025-09-12T09:05:03.891Z, maintainer 'hrithikroboto', description 'Utility fun
  EV: curl https://registry.npmjs.org/@robotostudio%2fsenku ; curl https://registry.npmjs.org/@roboto-studio%2futils ; curl https://registry.npmjs.org/sanity-plugin-chat-gpt ; curl 'https://registry.npmjs.org/-/v1/search?text=robotostudio&size=10' (total 5) vs curl 'https://registry.npmjs.org/-/v1/search?text=scope:robotostudio' (total 0)
- WAS: 'Unscoped sanity-plugin-* is overwhelmingly the dominant convention in the actual directory' — 'Sampled a full community listing page (43 entries): every single package name was unscoped — sanity-plug
  NOW: FALSE — this measured Exchange URL SLUGS, not npm package names, and the two are unrelated. I fetched the same page (https://www.sanity.io/exchange/type=plugins/by=community/page=2) and resolved each card to its actual npm package. At least five listings on that exact page are SCOPED npm packages: /plugins/vision -> @sanity/vision; /plugins/code-input -> @sanity/code-input; /plugins/color-input -> @sanity/color-input; /plugins/ai-assist -> @sanity/assist; /plugins/pagebridge -> @pagebridge/sanity (a third-party, non-Sanity scope). 'Zero scoped packages on that page' is wrong by at least five. 
  EV: curl -A <UA> 'https://www.sanity.io/exchange/type=plugins/by=community/page=2' then fetching each /plugins/<slug> page and regexing npmjs.com/package/<name> from its JSON-LD sameAs block
- WAS: 'The Exchange URL slug is always UNSCOPED even when the npm package is scoped — a real discoverability tax on scoping'; 'The scope is stripped from the directory URL'; 'the slug is decided by Sanity's
  NOW: The mechanism and the conclusion are both wrong. The slug is NOT the npm name with the scope stripped; it is an independent editorial field authored at submission time. Counterexamples: @sanity/assist lists at /plugins/ai-assist (not /plugins/assist); @pagebridge/sanity lists at /plugins/pagebridge (neither scope nor package name); @sanity/vision lists at /plugins/vision. And unscoped packages get truncated identically — sanity-plugin-imagekit lists at /plugins/imagekit, sanity-plugin-references at /plugins/references — so there is no scoping-specific 'tax'; the directory strips the sanity-plu
  EV: https://www.sanity.io/plugins/ai-assist -> npmjs.com/package/@sanity/assist ; /plugins/pagebridge -> @pagebridge/sanity ; /plugins/vision -> @sanity/vision ; /plugins/imagekit -> sanity-plugin-imagekit ; /plugins/color-input -> @sanity/color-input vs /plugins/sanity-plugin-color-input -> sanity-plugin-color-input
- WAS: '@sanity/plugin-kit HARD-ENFORCES the naming rule in code' — 'Two separate enforcement points. validatePackageName (throws, used by build)'.
  NOW: Misattributed and overstated on three counts. (1) There is NO `build` command in plugin-kit@10.0.2. dist/index.js declares exactly five commands: init, inject, link-watch, verify-package, version — help text verbatim: 'init            Create a new Sanity plugin / inject          Inject config into an existing Sanity plugin / verify-package  Check that a Sanity plugin package follows plugin-kit conventions / link-watch      Recompiles plugin automatically on changes and runs yalc push --publish / version         Show the version'. (2) The THROWING validatePackageName is dead code in v10: it fir
  EV: @sanity/plugin-kit@10.0.2 tarball: dist/index.js (cmds_default + meow help), dist/index.d.ts, dist/verify-package-wurW9wW2.js lines ~49-64 and disableCheckText/createValidator, dist/package-8cUY5BVf.js lines 158-162 (expectedScripts), 673-703 (getPackage/validatePackage/validatePackageName), dist/inject-CBH4g4tr.js line 57, dist/link-watch-yx9QxBJi.js line 25
- WAS: ACTION ITEMS: 'Claim sanity-plugin-posthog-ab-testing on npm now (publish a 0.0.0 placeholder) before the competitor expands into the PostHog niche' and 'Consider publishing sanity-plugin-posthog-expe
  NOW: Both action items are against npm's Terms of Use and should be struck. npm's dispute policy states verbatim: 'It is against npm's Terms of Use to publish a package, register a username or an organization name simply for the purposes of reserving it for future use. Accounts violating the name squatting policy may be removed or renamed without notice.' And on the standard applied to packages specifically: 'Package names are considered squatted if the package has no genuine function.' A 0.0.0 placeholder and a 'thin alias/deprecated-pointer package' both have no genuine function by that definitio
  EV: https://docs.npmjs.com/policies/disputes (Squatting section) ; https://docs.npmjs.com/policies/open-source-terms
- WAS: 'The keywords plugin-kit scaffolds are exactly [sanity, sanity-plugin]' — 'Confirmed as the de-facto standard across every package inspected'; and the action item 'Set keywords to [...] — keep the fir
  NOW: The generator line is correct verbatim (`keywords: prev.keywords ?? ["sanity", "sanity-plugin"]`), but 'every package inspected' / 'every listed plugin carries them' is overstated. @sanity/plugin-kit@10.0.2 itself — the tool that scaffolds the convention — carries keywords ['bootstrap','development','plugin','sanity','sanity-io','typescript'], i.e. it does NOT carry 'sanity-plugin'. @focus-reactive/sanity-plugin-inline-svg-input carries nine keywords, not two. Also note the generator uses `prev.keywords ?? [...]`, a nullish coalesce — it never overwrites or merges into an existing keywords arr
  EV: registry metadata for @sanity/plugin-kit@10.0.2 and @focus-reactive/sanity-plugin-inline-svg-input ; dist/package-8cUY5BVf.js keywords generator ; grep -c 'sanity-plugin-' and grep -o 'keyword' over the fetched https://www.sanity.io/docs/studio/developing-plugins HTML (both 0 hits)
- WAS: 'Listing on sanity.io/plugins is MANUAL SUBMISSION' — 'you log in at community.sanity.tools with an existing Sanity account, select the "Make your first contribution" guide, choose your contribution c
  NOW: The claim's substance holds and I found independent first-party proof for it, but the step list is incomplete and the moderation question is now partly answerable. (a) The docs list THREE steps verbatim, and the first one is omitted: '1. Select "Help." 2. Select the "Make your first contribution" guide, and read through it. 3. Select the category of contribution you'd like to make, and follow the in-studio descriptions to fill in the contents.' (b) Strong corroboration that npm keywords do not auto-list: Roboto Studio's own sanity-plugin-chat-gpt has carried keywords ['sanity','sanity-plugin']
  EV: https://www.sanity.io/docs/studio/developing-plugins (3-step list) ; curl -o /dev/null -w %{http_code} https://www.sanity.io/plugins/sanity-plugin-chat-gpt -> 404 ; registry.npmjs.org/sanity-plugin-smart-asset-manager time.created vs JSON-LD dateCreated on https://www.sanity.io/plugins/sanity-plugin-smart-asset-manager
- WAS: Unverified item: 'Whether the Exchange auto-syncs npm metadata (version, description, keywords, README) after the initial submission... I found no primary source either way.'
  NOW: Partial resolution, and it points toward the README being synced rather than manually frozen. The @operationnation/sanity-plugin-schema-markup listing carries JSON-LD dateCreated / dateModified / datePublished all equal to 2023-12-22T00:12:33Z, yet the README rendered on that page contains a section headed 'Customize Schema Markup (New Update!!! v2.0.0)' — content that only exists in v2.0.0, published to npm 2025-02-21T12:34:00.594Z, fourteen months after the listing's last recorded modification. So README body content is being pulled from source rather than hand-authored and frozen at submiss
  EV: https://www.sanity.io/plugins/sanity-plugin-schema-markup (JSON-LD dateModified 2023-12-22T00:12:33Z; rendered README contains 'Customize Schema Markup (New Update!!! v2.0.0)') vs registry.npmjs.org/@operationnation/sanity-plugin-schema-markup time['2.0.0'] = 2025-02-21T12:34:00.594Z


# ANGLE: release-ci

RECOMMENDATION: RECOMMENDATION FOR A NEW STANDALONE ROBOTO PLUGIN REPO

Package manager: **npm**, with a committed package-lock.json and `"packageManager": "npm@11.17.0"`. Rationale: (a) every standalone Sanity plugin that still ships uses npm + lockfile + `npm clean-install`; (b) semantic-release, `npm audit signatures` and OIDC trusted publishing are all npm-native; (c) the ERESOLVE you hit is a single stale peer range in the scaffolder, not an npm-vs-pnpm problem — I reproduced it and fixed it with a one-line pin. Use pnpm ONLY if you go monorepo (that is the sole reason Sanity uses it: workspaces + `catalog:peer` + `dedupePeers`). Do NOT use `--legacy-peer-deps`: it silently disables peer resolution repo-wide and would have hidden a real, fixable version mismatch.

Fix the scaffold ERESOLVE properly, right after `plugin-kit init`:
1. `"oxfmt": "^0.60.0"` in devDependencies (plugin-kit@10.0.2 declares `peerOptional oxfmt@^0.60.0`; the scaffolder writes ^0.61.0 — self-conflict). Alternatively drop oxfmt/oxlint entirely and set `sanityPlugin.verifyPackage: {oxfmt: false, oxlint: false}`, or use prettier+eslint like link-field does.
2. Fix the peerDependencies the scaffolder gets wrong (it forces react ^18 / styled-components ^5.2). Ship instead, matching Sanity's own catalog:peer:
   "peerDependencies": {"react": "^19.2", "react-dom": "^19.2", "sanity": "^5 || ^6.0.0-0", "styled-components": "^6.1"}
3. `"engines": {"node": ">=22.12", "npm": ">=11.17.0"}`.
4. Commit package-lock.json; CI uses `npm clean-install` everywhere.

Release model: **semantic-release** (not changesets). Changesets is right for the monorepo's ~30 packages; for one package the conventional-commit → auto-version → auto-CHANGELOG loop is less ceremony and is what every standalone plugin does.

Auth: **trusted publishing (OIDC), zero npm secrets in the repo.**
Setup, once:
  a. Bootstrap the name on npm from your laptop: `npm publish --access public` for 0.0.1 (or `npx setup-npm-trusted-publish @roboto/sanity-plugin-<name>` with a token, as Sanity does). Trust cannot be attached to a package that does not exist.
  b. Locally, with npm >= 11.10.0:
     npm trust github @roboto/sanity-plugin-<name> --file=release.yml --repository=robotostudio/sanity-plugin-<name>
     (the binding is repository + exact workflow FILENAME; renaming release.yml breaks publishing.)
  c. In the workflow: `permissions: id-token: write`, GitHub-hosted runner, npm >= 11.17.0 on PATH.
Provenance then happens automatically — link-field sets no NPM_CONFIG_PROVENANCE and still gets SLSA v1 attestations. Only set `NPM_CONFIG_PROVENANCE: true` if you fall back to a token.

---- .github/workflows/release.yml (filename is load-bearing — it is what you register with `npm trust`) ----
name: CI & Release

on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      test:
        description: Run tests
        required: true
        default: true
        type: boolean
      release:
        description: Release new version
        required: true
        default: false
        type: boolean

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    name: Lint & Build
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - run: corepack enable
      - uses: actions/setup-node@v7
        with:
          cache: npm
          node-version: lts/*
          registry-url: https://registry.npmjs.org
      - run: corepack prepare npm@11.17.0 --activate
      - run: npm clean-install
      - run: npm run lint --if-present
        if: github.event.inputs.test != 'false'
      - run: npm run check:format --if-present
        if: github.event.inputs.test != 'false'
      - run: npm run prepublishOnly --if-present

  test:
    needs: build
    if: github.event.inputs.test != 'false'
    runs-on: ${{ matrix.os }}
    name: Node.js ${{ matrix.node }} / ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
        node: [lts/*]
        include:
          - os: ubuntu-latest
            node: 22.12.0   # minimum supported by Sanity Studio v6
          - os: ubuntu-latest
            node: current
    steps:
      - name: Set git to use LF
        if: matrix.os == 'windows-latest'
        run: |
          git config --global core.autocrlf false
          git config --global core.eol lf
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - run: corepack enable
      - uses: actions/setup-node@v7
        with:
          cache: npm
          node-version: ${{ matrix.node }}
      - run: npm clean-install
      - run: npm test --if-present

  release:
    needs: [build, test]
    if: always() && github.event.inputs.release == 'true' && needs.build.result != 'failure' && needs.test.result != 'failure' && needs.test.result != 'cancelled'
    runs-on: ubuntu-latest
    name: Semantic release
    permissions:
      contents: write      # push the version commit + git tag, create the GitHub Release
      issues: write        # comment on released issues
      pull-requests: write # comment on released PRs
      id-token: write      # OIDC -> npm trusted publishing + provenance
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0   # semantic-release needs full history
      - run: corepack enable
      - uses: actions/setup-node@v7
        with:
          cache: npm
          node-version: lts/*
          registry-url: https://registry.npmjs.org
      - run: corepack prepare npm@11.17.0 --activate
      - run: npm clean-install
      - run: npm audit signatures
      - run: npx semantic-release
        if: always()   # never leave tags pushed without a publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # NO NPM_TOKEN. Auth is OIDC via id-token: write.

---- .github/workflows/lint-pr.yml (enforces conventional PR titles, which semantic-release depends on) ----
name: Lint PR
on:
  pull_request_target:
    types: [opened, edited, synchronize]
permissions:
  pull-requests: write
jobs:
  main:
    name: Validate PR title
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

---- release.config.cjs ----
// @ts-check
const preset = 'conventionalcommits'
/** @type {import('semantic-release').Options} */
module.exports = {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', {preset}],
    ['@semantic-release/release-notes-generator', {preset}],
    ['@semantic-release/changelog', {changelogTitle: '# 📓 Changelog'}],
    ['@semantic-release/npm', {tarballDir: '.semantic-release'}],
    ['@semantic-release/git', {
      assets: ['CHANGELOG.md', 'package-lock.json', 'package.json'],
      message: 'chore(release): ${nextRelease.version} [skip ci]',
    }],
    ['@semantic-release/github', {addReleases: 'bottom', assets: '.semantic-release/*.tgz', releasedLabels: false}],
  ],
}
(Skip `extends: '@sanity/semantic-release-preset'` — it is a Sanity-org preset whose repo is outside your control and was last touched 2026-04-08. Inline the plugin list.)

---- commitlint.config.cjs ----
module.exports = {extends: ['@commitlint/config-conventional']}
devDeps: @commitlint/cli ^21, @commitlint/config-conventional ^21, semantic-release ^25, @semantic-release/{changelog,git,github,npm}, lefthook ^2 (link-field replaced husky with lefthook).

Two cheap extras worth copying from the monorepo: (1) zizmor workflow auditing (`zizmorcore/zizmor-action` SHA-pinned, `min-severity: high`) — it will catch the `pull_request_target` in lint-pr.yml and force you to justify it; (2) `pkg-pr-new` PR preview publishes gated behind a `trigger: preview` label, so the studio team can install a plugin build straight from a PR without a real release.

Releases are deliberately manual: `workflow_dispatch` with `release: true`. Sanity's standalone repos all do this rather than releasing on every push to main — sensible for a plugin whose consumers are studio builds.

- [verified-primary] sanity-io/plugins monorepo releases with Changesets, not semantic-release, via a shared reusable workflow in sanity-io/.github
  /private/tmp/claude-502/-Users-jono-dev-babel/2fbe4965-2b65-41df-920f-543ac08080de/scratchpad/ci-survey2/plugins/.github/workflows/release.yml is 429 bytes total and is entirely a call-out:

name: Release
on:
  push:
    branches:
      - main
concurrency: ${{ github.workflow }}-${{ github.ref }}
permissions:
  contents: read # for checkout
jobs:
  release:
    uses: sanity-io/.github/.github/workflows/changesets.yml@main
    permissions:
      contents: read # for checkout
      id-token: write # to enable use of OIDC for npm provenance
    with:
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    secrets: inherit

Root package.json: "release": "changeset publish", deps include @changesets/cli ^2.31.1 and @changesets/changelog-github ^0.7.0. .changeset/config.json sets access: public, baseBranch: main, privatePackages: false, changelog: ["@changesets/changelog-github", {"repo": "sanity-io/plugins"}]. Clone HEAD 58907794e9924b68210901f8a7d6b0dcf48a2439 (2026-07-30).

- [verified-primary] The reusable changesets workflow publishes with npm TRUSTED PUBLISHING (OIDC) — no NPM_TOKEN is used for publishing
  sanity-io/.github/.github/workflows/changesets.yml, verbatim steps:

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          cache: pnpm
          check-latest: true
          node-version: lts/*
        # temporary until setup-node action comes with npm version that contains oidc setup by default
      - name: Update npm to use trusted publishing (OIDC)
        run: npm install -g npm@latest
      - name: Authenticate with private npm
        if: ${{ env.NPM_TOKEN != '' }}
        run: echo "//registry.npmjs.org/:_authToken=${{ env.NPM_TOKEN }}" > ~/.npmrc
      - run: pnpm install
      - name: Remove npm auth
        if: ${{ env.NPM_TOKEN != '' }}
        run: rm -f ~/.npmrc
      - name: Create Release Pull Request or Publish to npm
        id: changesets
        uses: changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d # v1.9.0
        with:
          publish: pnpm release
          title: ${{ inputs.versionPrTitle }}
          commit: ${{ inputs.versionCommitMessage }}
          setupGitUser: false
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
          NPM_CONFIG_PROVENANCE: ${{ github.event.repository.visibility == 'public' && 'true' || 'false' }}

Note the NPM_TOKEN secret is documented as "NPM token for private @sanity packages" and the .npmrc is explicitly DELETED before the publish step. Job-level permissions: contents: read, id-token: write.

- [verified-primary] npm registry metadata proves @sanity/personalization-plugin@3.0.11 was published by GitHub OIDC trusted publishing, from .github/workflows/release.yml
  GET https://registry.npmjs.org/@sanity/personalization-plugin , versions['3.0.11']._npmUser:
{'name': 'GitHub Actions', 'email': 'npm-oidc-no-reply@github.com', 'trustedPublisher': {'id': 'github', 'oidcConfigId': 'oidc:09fc022a-7c0b-4391-8dd0-1493be3a8f23'}}

Decoded SLSA v1 attestation predicate.buildDefinition.externalParameters.workflow = {ref: refs/heads/main, repository: https://github.com/sanity-io/plugins, path: .github/workflows/release.yml}; runDetails.metadata.invocationId = https://github.com/sanity-io/plugins/actions/runs/29991717601; resolvedDependencies gitCommit cac02bfdfce425e53ca6f2a0bc9886105beba4d6. Two attestations present: https://github.com/npm/attestation/tree/main/specs/publish/v0.1 and https://slsa.dev/provenance/v1.

- [verified-primary] Sanity has a dedicated workflow for onboarding a package to trusted publishing; first publish still needs a token, then trust is configured with the `npm trust` CLI (npm >= 11.10.0)
  /private/tmp/.../ci-survey2/plugins/.github/workflows/setup-trusted-publish.yml, verbatim:

name: Setup a new npm package with Trusted Publishing
on:
  workflow_dispatch:
    inputs:
      package:
        description: 'The package name, for example @sanity/foo-bar'
        required: true
permissions:
  contents: read
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: ./.github/actions/setup
      - run: echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_PUBLISH_TOKEN }}" > ~/.npmrc
      - name: Setup npm trusted publish
        env:
          PACKAGE_NAME: ${{ inputs.package }}
        run: pnpm setup-npm-trusted-publish "$PACKAGE_NAME"
      - name: Configure trusted publishing
        env:
          PACKAGE_NAME: ${{ inputs.package }}
        run: |
          echo "📦 Package $PACKAGE_NAME has been created on npm."
          echo ""
          echo "Next, configure trusted publishing by running locally (requires npm >= 11.10.0):"
          echo ""
          echo "  npm trust github $PACKAGE_NAME --file=release.yml --repository=sanity-io/plugins"

Root package.json depends on setup-npm-trusted-publish ^1.3.1. So: the trust binding is (repository, workflow filename), and the package must exist on npm before trust can be attached — bootstrap publish is token-based.

- [verified-primary] The standalone-plugin world Sanity used to run is now ARCHIVED — sanity-io/plugin-kit, sanity-io/sanity-plugin-media and SimeonGriggs/sanity-plugin-utils are all read-only, moved into the monorepo
  gh api repos/<r> --jq '{archived,pushed_at}': sanity-io/plugin-kit {archived: true, pushed_at 2026-06-17}; sanity-io/sanity-plugin-media {archived: true, 2026-06-17}; SimeonGriggs/sanity-plugin-utils {archived: true, 2026-06-08}; sanity-io/plugins {archived: false, pushed_at 2026-07-30T06:20:28Z}. plugin-kit README is one line: "# [This package has moved](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit)". @sanity/plugin-kit latest on npm is 10.0.2, published from the monorepo (attestations present).

- [verified-primary] The scaffolder still ships a semantic-release + npm + NPM_PUBLISH_TOKEN template, and it is stale relative to how Sanity itself now releases
  packages/@sanity/plugin-kit/assets/inject/semver-workflow/.github/workflows/main.yml (the `semver-workflow` preset) still generates a semantic-release job with:

      - run: npm clean-install
      - run: npm audit signatures
        # @TODO remove --dry-run after verifying everything is good to go
      - run: npx semantic-release --dry-run
        if: always()
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}

It sets `id-token: write` but NOT `NPM_CONFIG_PROVENANCE`, still uses an NPM_TOKEN secret, and literally ships a `--dry-run` with a leftover @TODO. .releaserc.json template is `{"extends": "@sanity/semantic-release-preset", "branches": ["main"]}` (@sanity/semantic-release-preset latest 6.0.0, last modified 2026-04-08). Do NOT copy this template verbatim.

- [verified-primary] ROOT CAUSE of the ERESOLVE in the scaffold: @sanity/plugin-kit@10.0.2 declares peerOptional oxfmt@^0.60.0 but its own generated package.json writes oxfmt ^0.61.0. Nothing to do with react/sanity peers, and --legacy-peer-deps is the wrong fix.
  Reproduced live today. `npx @sanity/plugin-kit@latest init . --name sanity-plugin-ab-repro --no-install` produced devDependencies including oxfmt ^0.61.0 and @sanity/plugin-kit ^10.0.2. `npm install` then fails:

npm error code ERESOLVE
npm error While resolving: @sanity/plugin-kit@10.0.2
npm error Found: oxfmt@0.61.0
npm error   dev oxfmt@"^0.61.0" from the root project
npm error Could not resolve dependency:
npm error peerOptional oxfmt@"^0.60.0" from @sanity/plugin-kit@10.0.2
npm error Conflicting peer dependency: oxfmt@0.60.0

`npm view @sanity/plugin-kit@10.0.2 peerDependencies` = {"@sanity/pkg-utils":"^11.0.17","oxfmt":"^0.60.0","oxlint":"^1.75.0"} with oxfmt/oxlint marked optional. oxfmt latest = 0.61.0, so the scaffolder always resolves outside its own peer range. Changing the single line to "oxfmt": "^0.60.0" makes `npm install` succeed clean ("added 1095 packages in 21s"). Repro dir: /private/tmp/claude-502/-Users-jono-dev-babel/2fbe4965-2b65-41df-920f-543ac08080de/scratchpad/ci-survey2/scaffold

- [verified-primary] pnpm installs the identical broken scaffold without failing — package-manager choice does resolve the ERESOLVE class of problem
  Same scaffold directory, `npx pnpm@11 install --no-frozen-lockfile` succeeded: "[WARN] Issues with peer dependencies found. Run \"pnpm peers check\" to list them." then installed all 11 devDependencies. Only follow-up was ERR_PNPM_IGNORED_BUILDS for esbuild@0.28.1 (pnpm's build-script allowlist; the monorepo handles this in pnpm-workspace.yaml with `allowBuilds: esbuild: false`). pnpm treats unmet peers as warnings; npm treats them as hard errors.

- [verified-primary] The Sanity monorepo itself is pnpm-only, with catalogs used specifically to keep peerDependencies coherent
  Root package.json: "packageManager": "pnpm@11.13.1". pnpm-workspace.yaml declares a dedicated `catalogs.peer` block: react ^19.2, react-dom ^19.2, sanity '^5 || ^6.0.0-0', styled-components ^6.1, with the comment "Ranges used in `peerDependencies` (referenced as `catalog:peer`)". Also `dedupePeers: true`, `dedupeDirectDeps: true`, `catalogMode: prefer`, `linkWorkspacePackages: deep`, and a `minimumReleaseAgeExclude` allowlist (pnpm v11 defaults minimumReleaseAge to 1440 minutes). @sanity/personalization-plugin's package.json uses "react": "catalog:peer", "react-dom": "catalog:peer", "sanity": "catalog:peer".

- [verified-primary] Best current STANDALONE third-party exemplar is winteragency/sanity-plugin-link-field — semantic-release + npm + trusted publishing with NO npm token in CI at all
  Released 1.7.0 on 2026-07-28; registry _npmUser = {'name':'GitHub Actions','email':'npm-oidc-no-reply@github.com','trustedPublisher':{'id':'github','oidcConfigId':'oidc:c6c36acd-...'}}, attestations present. Its release job env is ONLY `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` — no NPM_TOKEN, no NPM_CONFIG_PROVENANCE — yet provenance attestations are produced, because trusted publishing emits provenance automatically. It forces a modern npm on PATH:
      - run: corepack enable
      - uses: actions/setup-node@v6.4.0
        with: {cache: npm, node-version: lts/*, registry-url: https://registry.npmjs.org}
      - run: corepack prepare npm@11.17.0 --activate
      - run: npm clean-install
      - run: npm audit signatures
      - run: npx semantic-release
and pins it in package.json: "packageManager": "npm@11.17.0", "engines": {"node": ">=22.12", "npm": ">=11.17.0"}. Release config is release.config.cjs (conventionalcommits preset) with commit-analyzer, release-notes-generator, changelog, exec(prettier CHANGELOG), @semantic-release/npm (tarballDir '.semantic-release'), semantic-release-license, @semantic-release/git (assets CHANGELOG.md/LICENSE/package-lock.json/package.json, message 'chore(release): ${nextRelease.version} [skip ci]'), @semantic-release/github. commitlint.config.cjs = extends ['@commitlint/config-conventional'], @commitlint/cli ^21.1.0, semantic-release ^25.0.5, lefthook ^2.1.9 for hooks.

- [verified-primary] Trusted publishing is NOT yet universal among third-party plugins — two of three surveyed still use classic tokens
  sanity-plugin-simpler-color-input@4.0.0 (2026-01-08): _npmUser = {'name':'alyssakirstine'}, attestations present — token publish with explicit `NPM_CONFIG_PROVENANCE: true` + `NPM_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}` in the release job. sanity-plugin-remote-files@0.3.2 (2026-07-09): _npmUser = {'name':'flayks'}, attestations FALSE — its release.yml passes GITHUB_TOKEN/NPM_TOKEN/NODE_AUTH_TOKEN and sets id-token: write but never enables provenance, so no attestation is produced. Setting `id-token: write` alone does not give you provenance on a token publish; you need NPM_CONFIG_PROVENANCE=true (or trusted publishing).

- [verified-primary] What runs on PR vs on main, in the monorepo
  ci.yml triggers on `pull_request` and `push: branches: [main]`, concurrency group ${{ github.workflow }}-${{ github.head_ref || github.run_id }} cancel-in-progress: true, top-level `permissions: contents: read`. Jobs: build (pnpm turbo run build --filter='!./dev/*'), lint (pnpm lint --format github), knip (pnpm knip --reporter github-actions), test_shards (4-way vitest shard matrix; on PR adds --coverage --reporter=blob and uploads blob-report artifacts), a `test` gate job asserting shard result, and report_coverage (PR-only, pull-requests: write, davelosert/vitest-coverage-report-action pinned by SHA). No OS matrix and no Node matrix at all — a single composite action .github/actions/setup does pnpm/action-setup@v6 + actions/setup-node@v7 (cache: pnpm, node-version: lts/*) + `pnpm install`. main-only: release.yml (changesets), pnpm-if-needed.yml (`pnpm dedupe` → auto PR), lint-fix-if-needed.yml, format-if-needed.yml, typegen.yml. PR-only extras: pkg-pr-new.yml (preview publishes, gated on a 'trigger: preview' label), changeset-pr-npmdiff-comment.yml, changesets-from-conventional-commits.yml (gated to renovate[bot]/squiggler-app[bot]). zizmor.yml audits the workflows themselves (zizmorcore/zizmor-action pinned by SHA, min-severity: high) on both PR and main.

- [verified-primary] Node engine ranges currently in force
  @sanity/personalization-plugin@3.0.11 and the plugin-kit scaffold both emit "engines": {"node": ">=20.19 <22 || >=22.12"} (plugin-kit src/constants.ts: `export const requiredNodeEngine = '>=20.19 <22 || >=22.12'`). sanity-plugin-link-field is stricter: ">=22.12" with .nvmrc 24.18.0, and its test matrix is [macos-latest, ubuntu-latest, windows-latest] x lts/*, plus ubuntu x 22.12.0 ("Minimum supported Node.js version (Sanity Studio v6)") and ubuntu x current. sanity@6.7.0 peers: react ^19.2.2, react-dom ^19.2.2, styled-components ^6.1.15.

- [verified-primary] plugin-kit's forced peer ranges are also stale and will bite you separately from the oxfmt bug
  packages/@sanity/plugin-kit/src/configs/forced-package-versions.ts:

export const forcedPeerPackageVersions = {
  'react': '^18',
  'react-dom': '^18',
  '@types/react': '^18',
  '@types/react-dom': '^18',
  'sanity': '^5 || ^6.0.0-0',
  'styled-components': '^5.2',
}

So a freshly scaffolded plugin declares peerDependencies {react: ^18, sanity: '^5 || ^6.0.0-0'} while sanity@6 requires react ^19.2.2 and styled-components ^6.1.15. That is not what causes the install failure (I verified a root package.json with peer react ^18 + dev react ^19 + sanity ^6.7.0 installs fine under npm), but it publishes a peer contract that is wrong for Studio v6 consumers. The monorepo's own catalog:peer uses react ^19.2 / styled-components ^6.1 — use those.

UNVERIFIED: ["I could not verify from a primary source whether `pnpm publish` supports npm OIDC trusted publishing directly. Every trusted-publishing example I read shells out to npm (sanity-io/.github does `npm install -g npm@latest` then `changeset publish`, which invokes `npm publish`; link-field does `corepack prepare npm@11.17.0` then `npx semantic-release`, whose @semantic-release/npm also invokes `npm publish`). Assume you need a modern npm binary on PATH for the publish step regardless of which package manager installs your deps.", "The exact minimum npm version for OIDC *publishing* (as opposed to the `npm trust` CLI) is not stated in any repo I read. The only version assertion I have verbatim is Sanity's own 'requires npm >= 11.10.0' for `npm trust`. link-field pins npm@11.17.0. npm latest today is 12.0.2. Pin >= 11.17.0 to be safe.", "I did not verify the npmjs.com web UI flow for adding a trusted publisher (org/repo/workflow/environment fields), only the CLI form `npm trust github <pkg> --file=<workflow>.yml --repository=<org>/<repo>`.", "Whether npm's trusted-publishing config supports a GitHub Actions `environment:` constraint was not verified live.", "I did not find an open issue/PR in sanity-io/plugins acknowledging the oxfmt peer-range bug; I only reproduced the failure. It may be fixed in a plugin-kit release after 10.0.2.", "The three third-party repos I surveyed were chosen via `gh api search/repositories q='topic:sanity-plugin pushed:>2026-05-01 archived:false'`, which returned only 6 results \u2014 the actively-maintained standalone third-party population is genuinely small, so this is close to a census rather than a sample, but repos without the sanity-plugin topic were missed."]

## VERIFIER verdict=major-corrections
- WAS: "Next, configure trusted publishing by running locally (requires npm >= 11.10.0)" — the report treats Sanity's echoed string as the authoritative minimum npm version for `npm trust`, and its unverifie
  NOW: npm's own documentation requires npm@11.15.0 or above for `npm trust`, not 11.10.0. The command file first appears in the 11.10.0 tarball, but npm documents 11.15.0 as the supported floor. Sanity's echo string is stale/wrong and should not be copied into Roboto's runbook.
  EV: npm@12.0.2 tarball, package/docs/content/commands/npm-trust.md, ### Prerequisites: "* **npm version**: `npm@11.15.0` or above is required. Use `npm install -g npm@^11.15.0` to update if needed." Cross-check: `ls n11.9.0/package/lib/commands/ | grep trust` -> NONE; `n11.10.0` -> trust; `n12.0.2` -> trust. Local npm 11.6.2: `npm trust --help` -> `Unknown command: "trust"`.
- WAS: Recommendation step (b): run `npm trust github @roboto/sanity-plugin-<name> --file=release.yml --repository=robotostudio/sanity-plugin-<name>` to configure trusted publishing.
  NOW: That exact command will FAIL. `npm trust github` requires at least one permission flag. The correct command is `npm trust github <pkg> --file=release.yml --repository=<org>/<repo> --allow-publish`. Sanity's setup-trusted-publish.yml echoes the same incomplete command, so the report inherited the bug from a `run: echo` string rather than from npm's CLI contract.
  EV: npm@12.0.2 package/docs/content/commands/npm-trust.md, ### Permissions: "At least one of these flags is required when creating a trust configuration." — flags are `--allow-publish` ("Allows the trusted publisher to run `npm publish` for the package") and `--allow-stage-publish`. Synopsis: `npm trust github [package] --file [--repo|--repository] [--env|--environment] [--allow-publish] [--allow-stag
- WAS: Recommended release.config.cjs uses `const preset = 'conventionalcommits'` for commit-analyzer and release-notes-generator; devDeps listed are "@commitlint/cli ^21, @commitlint/config-conventional ^21
  NOW: The devDependency list is missing `conventional-changelog-conventionalcommits`, which is REQUIRED at runtime by `preset: 'conventionalcommits'`. Without it `npx semantic-release` throws while loading the parser config. link-field — the exemplar the report copied from — carries it at ^9.3.1, and the report dropped it.
  EV: @semantic-release/commit-analyzer@13.0.1 package.json dependencies = {conventional-changelog-angular ^8.0.0, conventional-changelog-writer ^8.0.0, conventional-commits-filter ^5.0.0, conventional-commits-parser ^6.0.0, debug, import-from-esm, lodash-es, micromatch} — conventionalcommits is NOT bundled. lib/load-parser-config.js: `const presetPackage = \`conventional-changelog-${preset.toLowerCase(
- WAS: Recommendation lists `@semantic-release/{changelog,git,github,npm}` as devDependencies to install.
  NOW: Do not add `@semantic-release/npm` (or `@semantic-release/github`, `commit-analyzer`, `release-notes-generator`) as explicit devDeps. They ship inside semantic-release, and trusted publishing only exists in @semantic-release/npm 13.x. Declaring your own range risks resolving an older copy and silently killing OIDC auth (falling back to ENONPMTOKEN, i.e. a hard failure with no token in CI). link-field deliberately declares only changelog, exec and git.
  EV: registry.npmjs.org/semantic-release@25.0.8 dependencies['@semantic-release/npm'] = "^13.1.1". link-field package-lock.json resolves node_modules/@semantic-release/npm = 13.1.5. link-field package.json devDependencies contains @semantic-release/changelog ^6.0.3, @semantic-release/exec ^7.1.0, @semantic-release/git ^10.0.1 — and no @semantic-release/npm or /github. @semantic-release/npm 13.0.0 was f
- WAS: Unverified item: "I could not verify from a primary source whether `pnpm publish` supports npm OIDC trusted publishing directly... Assume you need a modern npm binary on PATH for the publish step rega
  NOW: Now verified from source, and the mechanism is more specific than the report's guess. @semantic-release/npm@13.1.5 exchanges the GitHub OIDC token ITSELF (via @actions/core getIDToken + POST registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/<name>) but uses it only to satisfy the *verify* step — it then returns early WITHOUT writing any auth to the npmrc, and `publish.js` shells out to bare `npm publish --userconfig <empty npmrc>`. So the npm binary on PATH must independently perform the OIDC handshake; the semantic-release token is discarded. Earliest npm shipping OIDC publish support i
  EV: @semantic-release/npm@13.1.5 lib/verify-auth.js: `if (await oidcContextEstablished(registry, pkg, context)) { return; }` — before `await setNpmrcAuth(...)`. lib/publish.js: `execa("npm", ["publish", basePath, "--userconfig", npmrc, "--tag", distTag, "--registry", registry], ...)` with zero provenance/OIDC handling (grep for 'provenance|oidc|trusted' in publish.js returns nothing). lib/trusted-publ
- WAS: Unverified item: "Whether npm's trusted-publishing config supports a GitHub Actions `environment:` constraint was not verified live." And: "the trust binding is (repository, workflow filename)".
  NOW: Both now resolved, and the binding description is imprecise. `--environment` / `--env` ("CI environment name") IS a supported claim for `npm trust github`. And only `--file` is required — `--repository` is optional and falls back to `repository.url` in package.json. Additionally the registry supports only ONE trust configuration per package; replacing it requires `npm trust list` then `npm trust revoke --id <id>`.
  EV: npm@12.0.2 docs/content/commands/npm-trust.md, `npm trust github` flag table: `--file` | String (required); `--repository`, `--repo` | String; `--environment`, `--env` | String | "CI environment name". Provider Options section: "If a provider is repository-based and the option is not provided, npm will use the `repository.url` field from your `package.json`, if available." And: "Currently, the reg
- WAS: The trusted-publishing setup runbook is presented as: (a) bootstrap-publish the name, (b) run `npm trust`, (c) set id-token: write in the workflow.
  NOW: Two hard prerequisites are missing and both can block setup on day one: account-level 2FA MUST be enabled on the npm account running `npm trust`, and Granular Access Tokens with the 'bypass 2FA' option are NOT supported for trust commands. Legacy basic-auth credentials also fail.
  EV: npm@12.0.2 docs/content/commands/npm-trust.md, ### Prerequisites: "* **2FA enabled on account**: Two-factor authentication must be enabled at the account level. Even if it's not currently enabled, you must enable it to use trust commands. * **Supported authentication methods**: Granular Access Tokens (GAT) with the bypass 2FA option are not supported. Legacy basic auth (username and password) cred
- WAS: Unverified item: "gh api search/repositories q='topic:sanity-plugin pushed:>2026-05-01 archived:false' returned only 6 results — the actively-maintained standalone third-party population is genuinely 
  NOW: Off by an order of magnitude. Dropping the `topic:` filter returns 68 actively-pushed, non-archived repos matching `sanity-plugin in:name`. The 3-repo survey is a small convenience sample, not a census, and it missed the highest-starred active third-party plugin in the population. Any generalisation like 'two of three still use classic tokens' should not be read as an ecosystem-wide rate.
  EV: gh api 'search/repositories?q=topic:sanity-plugin+pushed:>2026-05-01+archived:false' -> total_count 6. gh api 'search/repositories?q=sanity-plugin+in:name+pushed:>2026-05-01+archived:false' -> total_count 68. Top unsurveyed by stars: Q42/sanity-plugin-page-tree (45, pushed 2026-07-29), andybywire/sanity-plugin-taxonomy-manager (27, 2026-07-23), focusreactive/sanity-plugin-inline-svg-input (21), bo
- WAS: "The standalone-plugin world Sanity used to run is now ARCHIVED — sanity-io/plugin-kit, sanity-io/sanity-plugin-media and SimeonGriggs/sanity-plugin-utils are all read-only, moved into the monorepo"
  NOW: Directionally right but literally incomplete: sanity-io still owns 7 non-archived plugin-named repos, including sanity-io/sanity-plugin-google-translate pushed 2026-07-28 whose .github/workflows/main.yml still runs semantic-release with `NPM_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}`, actions/checkout@v4 and actions/setup-node@v4. The npm releases genuinely come from the monorepo (so the repo is vestigial), but it is another stale template sitting in plain sight under the sanity-io org that a reader could copy in good faith.
  EV: gh api 'search/repositories?q=org:sanity-io+sanity-plugin+in:name+archived:false' -> total_count 7, incl. sanity-io/sanity-plugin-google-translate (pushed 2026-07-28T08:47:03Z, archived:false) and sanity-io/sanity-amplitude-plugin (2026-07-25). Its release job env verbatim: `GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}` / `NPM_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}`. Meanwhile sanity-plugin
- WAS: Recommended workflow uses `- run: corepack enable` then `- run: corepack prepare npm@11.17.0 --activate` in the build and release jobs, copied from link-field.
  NOW: This is a time-bomb, not a durable pattern. Corepack was removed from Node release tarballs; Node 24 (current lts/*) still ships it, Node 26 does not. The moment `lts/*` rolls forward past Node 24 the build and release jobs break. Sanity's own reusable workflow avoids this entirely with `npm install -g npm@latest`; prefer `npm i -g npm@11.17.0` (or a floor like ^11.17.0). Note the same `corepack enable` in the test job happens to survive because it runs BEFORE setup-node, on the runner's preinstalled Node.
  EV: `curl nodejs.org/dist/v24.18.1/node-v24.18.1-linux-x64.tar.xz | tar -tJf - | grep -i corepack` -> node-v24.18.1-linux-x64/bin/corepack (+ lib/node_modules/corepack/). Same for v26.5.1 -> grep -c = 0. nodejs/node PR #59835 "build: remove corepack from release tarballs" merged_at 2025-09-12T06:40:34Z into main. nodejs.org/dist/index.json: v24.18.1 lts="Krypton" (current LTS), v26.5.1 lts=false. Loca
- WAS: Recommendation sets `"engines": {"node": ">=22.12", "npm": ">=11.17.0"}` and pins a test-matrix leg at `node: 22.12.0  # minimum supported by Sanity Studio v6`, with semantic-release ^25 as a devDepen
  NOW: semantic-release@25 declares `engines: {node: "^22.14.0 || >= 24.10.0"}`, which excludes 22.12.0 and 22.13.x. The 22.12.0 matrix leg will emit EBADENGINE warnings on `npm clean-install` (and would hard-fail under engine-strict). Either bump that leg to 22.14.0 or accept the warning knowingly — the report presents 22.12 as if it were consistent across the toolchain.
  EV: registry.npmjs.org/semantic-release, versions['25.0.8'].engines = {"node": "^22.14.0 || >= 24.10.0"} (latest 25.0.8, published 2026-07-18). link-field pins "semantic-release": "^25.0.5" while its own matrix includes ubuntu-latest x node 22.12.0.
- WAS: "Best current STANDALONE third-party exemplar is winteragency/sanity-plugin-link-field" — presented as the template to copy, with its @semantic-release/git assets listed as "CHANGELOG.md/LICENSE/packa
  NOW: Three inaccuracies in the exemplar write-up. (1) The git assets list also includes `pnpm-lock.yaml` and `yarn.lock`. (2) link-field's release.config.cjs has NO `branches` key at all — the recommendation's `branches: ['main']` is an addition, not a copy. (3) More importantly, link-field is NOT on the current toolchain: it pins `@sanity/plugin-kit: ^6.0.0` and `@sanity/pkg-utils: ^10.7.2` (current: 10.0.2 and ^11.0.17) and ships peerDependencies `{react: ^18 || ^19, sanity: ^3 || ^4 || ^5 || ^6, styled-components: ^5.2 || ^6, @sanity/ui: ^3}` — i.e. it is a good CI/release exemplar but a poor pa
  EV: tp-sanity-plugin-link-field/release.config.cjs: assets: ['CHANGELOG.md','LICENSE','package-lock.json','package.json','pnpm-lock.yaml','yarn.lock']; the exported `options` object contains only `plugins`. package.json devDependencies: "@sanity/pkg-utils": "^10.7.2", "@sanity/plugin-kit": "^6.0.0". package.json peerDependencies as quoted. Clone HEAD e72a05b835e477821291b4dac35f4629a5f1c128 (2026-07-2
- WAS: "Releases are deliberately manual: `workflow_dispatch` with `release: true`. Sanity's standalone repos all do this rather than releasing on every push to main — sensible for a plugin whose consumers a
  NOW: Overstated. Sanity's ONLY live release path — the monorepo — releases on every push to main (`on: push: branches: [main]`), not via workflow_dispatch. Among the three surveyed third-party repos, 2 use the dispatch gate (link-field, simpler-color-input) and 1 releases on push to main (flayks/sanity-plugin-remote-files). The dispatch gate comes from the plugin-kit `semver-workflow` template — the same template the report elsewhere tells you not to copy.
  EV: plugins/.github/workflows/release.yml: `on:\n  push:\n    branches:\n      - main`. tp-sanity-plugin-remote-files/.github/workflows/release.yml: `on:\n  push:\n    branches:\n      - main\n  workflow_dispatch:` with the release job unconditional. plugin-kit assets/inject/semver-workflow/.github/workflows/main.yml release job: `if: always() && github.event.inputs.release == 'true' && ...`.
- WAS: Recommendation proposes publishing as `@roboto/sanity-plugin-<name>`, with no availability check for the scope or the unscoped alternatives.
  NOW: Name availability was never checked and three obvious unscoped candidates are already TAKEN by third parties: sanity-plugin-ab-testing (0.1.5, maintainer bilanovic90, created 2026-04-15), sanity-plugin-posthog (1.0.2, theothershreyas), sanity-plugin-personalization (0.1.8, kichijoji12). Free: sanity-plugin-ab-test, sanity-plugin-posthog-ab-testing. On the scope: no packages exist under @roboto or @robotostudio, but scope OWNERSHIP cannot be determined from the public registry (bare-scope GET returns 405) — that needs an authenticated `npm org ls` / npmjs.com check before the plan depends on it
  EV: HTTP status via curl on registry.npmjs.org: sanity-plugin-ab-testing 200, sanity-plugin-posthog 200, sanity-plugin-personalization 200, sanity-plugin-ab-test 404, sanity-plugin-posthog-ab-testing 404, @roboto/sanity-plugin-ab-testing 404, bare @roboto and @robotostudio 405. registry search `text=scope:roboto` -> total 0; `text=scope:robotostudio` -> total 0. Packument maintainers as quoted.
- WAS: "What runs on PR vs on main, in the monorepo" — enumerated as ci.yml, release.yml, pnpm-if-needed.yml, lint-fix-if-needed.yml, format-if-needed.yml, typegen.yml, pkg-pr-new.yml, changeset-pr-npmdiff-c
  NOW: The inventory is incomplete and the shard command is misquoted. Missing from the list: e2e.yml (18,165 bytes — the largest workflow in the repo, and it runs on BOTH pull_request and push-to-main, so 'no OS matrix and no Node matrix at all' describes ci.yml only, not the monorepo's PR surface), plus deploy-test-studio.yml (main, path-filtered), e2e-periodic-cleanup.yml, lock.yml, renovate.yml, issue-triage.yml, stale-issues.yml, remove-needs-info-on-response.yml, update-skills-if-needed.yml. The PR test command is `pnpm test --shard=I/T --passWithNoTests --coverage --reporter=default --reporter
  EV: `ls -la plugins/.github/workflows/` shows 21 files incl. e2e.yml (18165 bytes). e2e.yml `on:` block = `pull_request:` + `push: branches: [main]`. ci.yml test_shards 'Test (PR)' step: `run: pnpm test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }} --passWithNoTests --coverage --reporter=default --reporter=blob`. zizmor.yml line 12: `permissions: {}`.
- WAS: "Changing the single line to \"oxfmt\": \"^0.60.0\" makes `npm install` succeed clean (\"added 1095 packages in 21s\")"
  NOW: The install succeeds — that part reproduces — but 'clean' is wrong. The resulting tree reports high-severity npm audit advisories inside the sanity dependency chain (adm-zip <0.6.0 via @module-federation/dts-plugin -> @sanity/workbench-cli -> @sanity/cli) and `npm ls --depth=0` lists 6 extraneous packages (@emnapi/core, @emnapi/runtime, @emnapi/wasi-threads, @napi-rs/wasm-runtime, @tybys/wasm-util). Worth knowing before anyone wires `npm audit` (as opposed to `npm audit signatures`) into CI as a gate.
  EV: Live run in scratchpad/verify2-release-ci/scaffold-fix: `npm ls --depth=0` output listing oxfmt@0.60.0 alongside six 'extraneous' entries; `npm audit` head: "adm-zip <0.6.0 / Severity: high / adm-zip: Crafted ZIP file triggers 4GB memory allocation - GHSA-xcpc-8h2w-3j85 ... Will install sanity@5.14.1, which is a breaking change".
- WAS: Task-directed check: whether the sanity.io/plugins directory is still open to community submissions.
  NOW: Could not be verified live and should not be asserted either way. www.sanity.io/plugins renders as the 'Exchange' and its embedded data shows Official (110) vs Community (1431) contributions, and https://www.sanity.io/exchange/create returns HTTP 200 — but the server-rendered HTML at that URL is only the generic Exchange shell with no submission form, so the flow is either client-rendered or login-gated. Treat 'the directory is open to submissions' as unconfirmed pending an authenticated check.
  EV: curl -A Mozilla https://www.sanity.io/plugins -> HTTP 200, 755186 bytes, embedded JSON includes contribution.tool documents with _createdAt values as recent as 2026-07-07 (Remote files) and 2026-06-22, and taxonomy counts "Official ( 110 )" / "Community ( 1431 )". curl https://www.sanity.io/exchange/create -> HTTP 200 but stripped text contains only nav/footer plus the Exchange filter shell; https
