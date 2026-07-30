import {defineConfig} from 'vitest/config'

export default defineConfig({
  // tsconfig sets jsx: 'preserve' for pkg-utils; vitest (vite 8 / oxc) must
  // compile the JSX itself
  oxc: {
    jsx: {runtime: 'automatic'},
  },
  test: {
    environment: 'node',
  },
})
