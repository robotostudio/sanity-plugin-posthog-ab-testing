// Inline plugin list on purpose. @sanity/semantic-release-preset is outside our
// control and stale (rob2475 Decision 5).
//
// @semantic-release/npm and @semantic-release/github are referenced here but
// deliberately NOT declared in devDependencies — they ship inside
// semantic-release, and an older resolved copy silently kills OIDC with
// ENONPMTOKEN.
/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', {preset: 'conventionalcommits'}],
    ['@semantic-release/release-notes-generator', {preset: 'conventionalcommits'}],
    '@semantic-release/changelog',
    '@semantic-release/npm',
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
        message: 'chore(release): ${nextRelease.version}\n\n${nextRelease.notes}',
      },
    ],
  ],
}
