import { describe, expect, it } from 'vitest'

import {
  lintDesignLines,
  parseAddedLines,
  parseLintExceptions,
  parseWebsiteComponentContract
} from './lint'

describe('design-system lint', () => {
  it('reports forbidden design-system patterns on added lines', () => {
    const lines =
      parseAddedLines(`diff --git a/src/views/NewView.vue b/src/views/NewView.vue
--- a/src/views/NewView.vue
+++ b/src/views/NewView.vue
@@ -2,0 +3,4 @@
+<div class="dark:bg-black w-[80%] !text-white">
+  <i class="icon-[lucide--x] text-sm" />
+  <button>Save</button>
+</div>`)

    expect(lintDesignLines(lines).map(({ ruleId }) => ruleId)).toEqual([
      'DS001',
      'DS002',
      'DS003',
      'DS005',
      'DS008'
    ])
  })

  it('does not treat JavaScript negation as a Tailwind important utility', () => {
    const lines = [
      {
        content: '<template v-if="!item.thumbnailUrl">',
        filePath: 'apps/website/src/components/Feature.vue',
        lineNumber: 1
      },
      {
        content: '!item.filters.includes(filter)',
        filePath: 'apps/website/src/components/Feature.vue',
        lineNumber: 2
      }
    ]

    expect(
      lintDesignLines(lines).filter(({ ruleId }) => ruleId === 'DS002')
    ).toEqual([])
  })

  it('tracks line numbers across additions and removals', () => {
    const lines =
      parseAddedLines(`diff --git a/apps/website/src/pages/View.astro b/apps/website/src/pages/View.astro
--- a/apps/website/src/pages/View.astro
+++ b/apps/website/src/pages/View.astro
@@ -10,2 +10,3 @@
 context
-removed
+first
+second`)

    expect(lines).toEqual([
      {
        content: 'first',
        filePath: 'apps/website/src/pages/View.astro',
        lineNumber: 11
      },
      {
        content: 'second',
        filePath: 'apps/website/src/pages/View.astro',
        lineNumber: 12
      }
    ])
  })

  it('applies documented exact and directory exceptions', () => {
    const exceptions = parseLintExceptions(`
| Path | Rule | Rationale | Owner | Review by |
| --- | --- | --- | --- | --- |
| src/views/LegacyView.vue | DS001 | Legacy shell | UI | 2026-12-01 |
| src/embedded/** | DS007 | Embedded boundary | UI | 2026-12-01 |
`)
    const lines = [
      {
        content: '<div class="dark:bg-black" />',
        filePath: 'src/views/LegacyView.vue',
        lineNumber: 1
      },
      {
        content: "import Button from 'primevue/button'",
        filePath: 'src/embedded/Panel.vue',
        lineNumber: 1
      }
    ]

    expect(lintDesignLines(lines, exceptions)).toEqual([])
  })

  it('rejects invented website controls, states, and action arrows', () => {
    const lines =
      parseAddedLines(`diff --git a/apps/website/src/components/Feature.astro b/apps/website/src/components/Feature.astro
--- /dev/null
+++ b/apps/website/src/components/Feature.astro
@@ -0,0 +1,3 @@
+<button class="hover:bg-primary-comfy-yellow">Filter</button>
+<span>View all →</span>
+<input type="search" />`)

    expect(lintDesignLines(lines).map(({ ruleId }) => ruleId)).toEqual([
      'DS009',
      'DS011',
      'DS013',
      'DS010',
      'DS009'
    ])
  })

  it('rejects visual overrides on governed website components', () => {
    const lines =
      parseAddedLines(`diff --git a/apps/website/src/components/Feature.astro b/apps/website/src/components/Feature.astro
--- a/apps/website/src/components/Feature.astro
+++ b/apps/website/src/components/Feature.astro
@@ -4,3 +4,4 @@
 <BrandButton
   variant="solid"
+  class="rounded-none"
 >`)

    expect(lines[0]?.componentTag).toBe('BrandButton')
    expect(lintDesignLines(lines).map(({ ruleId }) => ruleId)).toEqual([
      'DS012'
    ])
  })

  it('rejects Astro class-list overrides on governed components', () => {
    const lines = [
      {
        componentTag: 'Badge',
        content: "  class:list={[selected && 'bg-primary-comfy-yellow']}",
        filePath: 'apps/website/src/components/Feature.astro',
        lineNumber: 4
      }
    ]

    expect(lintDesignLines(lines).map(({ ruleId }) => ruleId)).toEqual([
      'DS012'
    ])
  })

  it('parses machine-readable website component contracts', () => {
    expect(
      parseWebsiteComponentContract(`---
component: BrandButton
implementation: apps/website/src/components/common/BrandButton.vue
class_policy: none
---`)
    ).toEqual({
      classPolicy: 'none',
      component: 'BrandButton',
      implementation: 'apps/website/src/components/common/BrandButton.vue'
    })
  })

  it('rejects an undocumented website composition', () => {
    const lines = [
      {
        content: '---',
        filePath: 'apps/website/src/components/new-feature/UnknownCard.astro',
        lineNumber: 1
      }
    ]

    expect(lintDesignLines(lines).map(({ ruleId }) => ruleId)).toEqual([
      'DS013'
    ])
  })
})
