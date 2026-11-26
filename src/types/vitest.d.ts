import 'vitest'

declare module 'vitest' {
  interface TestTags {
    tags: 'concurrent-safe' | 'shared-state'
  }
}
