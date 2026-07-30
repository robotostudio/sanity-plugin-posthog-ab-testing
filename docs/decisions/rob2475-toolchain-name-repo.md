# ROB-2475 Decision — package name, toolchain, repo standup

## Decision 1: Toolchain — `@sanity/plugin-kit@10.0.2` (pinned exact) + `@sanity/pkg-utils@^11.0.17`. Not tsdown.

**The fork was apparent, not real.** Reading both research docs together:

- ROB-2470 observed Sanity's **internal monorepo posture**: `@sanity/personalization-plugin@3.0.11` builds with `tsdown` + `@sanity/tsdown-config@^0.21.2`, `pkg-utils` gone (rob2470 lines 256–268).
- ROB-2471's verifier established that `verify-package` is **not a registry gate** — it is a self-imposed prepublish lint with per-check kill switches. plugin-kit@10.0.2 has exactly five commands (init, inject, link-watch, verify-package, version), the throwing `validatePackageName` is dead code, and every check is disableable via `sanityPlugin.verifyPackage: {<check>: false}` in package.json (rob2471 lines 83–84, 106 — the doc itself uses this for `{oxfmt: false, oxlint: false}`). Nothing on npm's side rejects a tsdown build; Sanity publishes tsdown-built plugins daily.

So the real question is not "which gate do we obey" but "which build tool do we bet a public package on." Answer: **pkg-utils**, because:

1. **Sanity runs a two-track world and we are on the external track.** plugin-kit@10.0.2 (published 2026-07-28, actively maintained from the monorepo, peer `@sanity/pkg-utils ^11.0.17`) is the current, supported path for third-party authors. tsdown-config is the *internal* path.
2. **`@sanity/tsdown-config` is 0.x, source unread, output uncharacterized.** ROB-2470's own open question: "What @sanity/tsdown-config@^0.21.2 actually emits — chunking strategy, .d.ts generation, whether it injects per-export types conditions... Package source not read" (rob2470 line 340). We would absorb its churn alone, with no docs.
3. **Full verify-package stays enabled as a free conformance guardrail.** Choosing tsdown means disabling `validatePkgUtilsDependency` + `validateScripts` today and fighting every new check plugin-kit adds (it shipped 5 majors in 3 weeks).
4. **The scaffold is reproduced and its two defects are known and one-line-fixable** (oxfmt pin, stale forced peers — rob2471 lines 391–402, 430–442). The tsdown path has no reproduced scaffold at all.

**We still adopt the v3.0.11 package POSTURE wholesale** — ESM-only, `"type": "module"`, `"files": ["dist"]`, `@sanity/tsconfig/strictest`, react ^19.2 peers, Studio v5/v6 only (locked) — just built by pkg-utils instead of tsdown.

**Rejected:** tsdown + `@sanity/tsdown-config` (0.x internal tooling, unaudited emit, forces disabling checks). **Revisit trigger:** `@sanity/tsdown-config` reaches 1.0 *or* plugin-kit itself starts scaffolding tsdown — then migrate in a minor.

## Decision 2: Package name — `sanity-plugin-posthog-ab-testing`, unscoped

- Free on npm (verified live 2026-07-30); `sanity-plugin-ab-testing` is taken by an active direct competitor (bilanovic90, 0.1.5, 2026-06-08) and `sanity-plugin-posthog` by an unrelated dormant dashboard plugin — differentiation is forced (rob2471 lines 25–32).
- Passes plugin-kit's naming validators (`sanity-plugin-` prefix, doesn't end in "plugin").
- **Unscoped**, deliberately: scoping is a free choice (`@robotostudio` is claimed and published-to via `@robotostudio/senku`; the "Exchange strips scope" claim was corrected — the slug is an independent editorial field), but scoping buys zero directory branding while adding the `publishConfig.access: "public"` silent-first-release footgun. Roboto branding goes in the Exchange author profile, README, and repo URL.
- **Rejected:** `sanity-plugin-posthog-experiments` (runner-up; "ab testing" is the higher-intent cross-audience search term). **Not doing:** placeholder/alias squat publishes — against npm ToU (squatting policy; accounts may be removed without notice).
- Keywords: `["sanity","sanity-plugin","posthog","ab-testing","experiments","personalization"]`. README carries an "unofficial, not affiliated with PostHog or Sanity" disclaimer (name contains two third-party marks).

## Decision 3: Repo — `github.com/robotostudio/sanity-plugin-posthog-ab-testing`, public, MIT

Standalone under the Roboto org. The `sanity-io/plugins` monorepo is Sanity-internal-only per its CONTRIBUTING.md. Directory name of the local placeholder already matches — no rename needed.

## Decision 4: Scaffold — exact command and pinned corrections

```bash
npx @sanity/plugin-kit@10.0.2 init sanity-plugin-posthog-ab-testing --no-install
```

(`npm create sanity-plugin` does not exist. Pin 10.0.2 — 5 majors in 3 weeks.)

Then hand-correct package.json before first install:

| Field | Value | Why |
| -- | -- | -- |
| `devDependencies.oxfmt` | `^0.60.0` | scaffolder writes ^0.61.0 vs plugin-kit's own `peerOptional ^0.60.0` → ERESOLVE. **Never `--legacy-peer-deps`.** |
| `peerDependencies` | `react ^19.2, react-dom ^19.2, sanity "^5 \|\| ^6.0.0-0", styled-components ^6.1` | scaffolder forces stale react ^18 / styled-components ^5.2; Sanity's own catalog:peer is the source of truth |
| `engines.node` | literal string `">=20.19 <22 \|\| >=22.12"` | verify-package validates by **string equality** against plugin-kit's `requiredNodeEngine` |
| `packageManager` | `npm@11.17.0` | plus committed `package-lock.json`; CI uses `npm clean-install` |
| Also | `publishConfig.exports`, `browserslist`, a `dependencies` block, keywords above | per ticket / pkg-utils conventions |
| Ship **no** `sanity.json`, **no** `v2-incompatible.js` | | Studio v2 legacy; the shim's dialog no longer exists |

**Do not** run `plugin-kit inject --preset semver-workflow` for CI: the template is stale (NPM_TOKEN secret, leftover `--dry-run` + `@TODO`, no provenance). Hand-write the workflows instead (Decision 5). Note: `npm audit` will report high-severity advisories inside the sanity dep chain — gate CI on `npm audit signatures`, never `npm audit`.

## Decision 5: Release pipeline — semantic-release ^25 + npm OIDC trusted publishing, zero npm secrets

Copy `winteragency/sanity-plugin-link-field`'s **workflows only** (its package.json is on the old toolchain: plugin-kit ^6, pkg-utils ^10). With all ROB-2471 verifier corrections folded in:

- devDeps: `semantic-release ^25`, `@semantic-release/changelog`, `@semantic-release/git`, **`conventional-changelog-conventionalcommits`** (required at runtime by the preset; the exemplar's list dropped it), `@commitlint/cli ^21`, `@commitlint/config-conventional ^21`, `lefthook ^2`. **Do NOT declare `@semantic-release/npm` or `/github` yourself** — they ship inside semantic-release; an older resolved copy silently kills OIDC (ENONPMTOKEN).
- `release.config.cjs`: inline plugin list, `conventionalcommits` preset, `branches: ['main']`. Skip `@sanity/semantic-release-preset` (outside our control, stale).
- `.github/workflows/release.yml` — **filename is load-bearing** (bound by `npm trust`; renaming breaks publishing). Release job: `permissions: contents: write, issues: write, pull-requests: write, id-token: write`; `fetch-depth: 0`; env contains ONLY `GITHUB_TOKEN`. Provenance is automatic under trusted publishing.
- **No corepack** (removed from Node ≥26 tarballs — time-bomb when `lts/*` rolls past 24). Use `npm i -g npm@^11.17.0` to get an OIDC-capable npm on PATH.
- Releases are manually gated: `workflow_dispatch` with `release: true` (link-field pattern; sensible for a plugin consumed by studio builds).
- `lint-pr.yml` with `amannn/action-semantic-pull-request` (conventional titles feed semantic-release). Optional cheap extras: zizmor workflow audit, pkg-pr-new preview publishes behind a `trigger: preview` label.
- Test matrix minimum leg: **22.14.0**, not 22.12.0 — `semantic-release@25` engines are `^22.14.0 || >= 24.10.0`, so 22.12 emits EBADENGINE. Consumer `engines` stays the plugin-kit string (Decision 4); this only affects CI.

## Repo-standup steps, in order (do not run yet)

1. **[Jono — GitHub org credentials]** Create `robotostudio/sanity-plugin-posthog-ab-testing`: public, MIT, main branch, no template.
2. Scaffold: `npx @sanity/plugin-kit@10.0.2 init sanity-plugin-posthog-ab-testing --no-install`.
3. Apply the Decision-4 package.json corrections; delete any `sanity.json` / v2 shim artifacts; add README disclaimer + keywords.
4. `npm install` (npm 11.17.x locally); commit `package-lock.json`.
5. Add `release.config.cjs`, `commitlint.config.cjs`, lefthook config, `.github/workflows/release.yml` + `lint-pr.yml` (Decision 5 shapes).
6. Verify locally: `npm run build` (pkg-utils), `npx @sanity/plugin-kit@10.0.2 verify-package`, `npm pack --dry-run` (expect dist-only ESM tarball).
7. Push to main; enable branch protection + required PR title check.
8. **[Jono — npm credentials]** Confirm **account-level 2FA** on the publishing npm account (mandatory for `npm trust`; GATs with bypass-2FA are unsupported) and `npm login` locally with **npm ≥ 11.15.0** (not 11.10.0 — Sanity's echoed floor is stale).
9. **[Jono — npm credentials]** Bootstrap publish from laptop: `npm publish` of a **genuinely functional** 0.0.1 (real built plugin — an empty placeholder violates npm's squatting policy; trust cannot attach to a nonexistent package).
10. **[Jono — npm credentials]** `npm trust github sanity-plugin-posthog-ab-testing --file=release.yml --repository=robotostudio/sanity-plugin-posthog-ab-testing --allow-publish` — the permission flag is required or the command fails; the registry holds exactly one trust config per package.
11. Dry-run the pipeline: land a `feat:` commit, dispatch release.yml with `release: true`, then verify on the registry that `_npmUser` is `GitHub Actions / npm-oidc-no-reply@github.com` with a `trustedPublisher` block and SLSA v1 attestations.

## For later tickets to depend on

- Build output: ESM-only `dist/`, single entry `./src/index.ts` for now, `@sanity/tsconfig/strictest`.
- `@sanity/ui` / `@sanity/icons` as **direct deps, not peers** (current Sanity-official posture). No `@sanity/studio-secrets`, no `react-icons`.
- Exchange listing is manual submission and a separate ticket (ROB-2477) — publishing to npm alone never lists us.
