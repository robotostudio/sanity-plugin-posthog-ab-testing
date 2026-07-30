import base from '@sanity/plugin-kit/oxfmt'

export default {
  ...base,
  // docs/ holds the frozen ROB-2468 decision/research documents; README.md
  // carries carefully hand-formatted prompt blocks — never reformat either.
  ignorePatterns: [...(base.ignorePatterns ?? []), 'docs/**', 'README.md'],
}
