import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { findStartupBoundaryViolations } from './startupBoundary'

const workspaceRoot = path.resolve(import.meta.dirname, '..')
const forbiddenEditorModules = [
  'src/core/graph/subgraph/migration/proxyWidgetMigration.ts',
  'src/core/graph/subgraph/promotionUtils.ts',
  'src/lib/litegraph/public/css/litegraph.css',
  'src/lib/litegraph/src/litegraph.ts',
  'src/platform/workflow/management/stores/workflowStore.ts',
  'src/renderer/core/canvas/canvasStore.ts',
  'src/scripts/app.ts'
]

describe('shared startup boundary', () => {
  it('does not statically import Editor-owned modules', () => {
    const violations = findStartupBoundaryViolations({
      workspaceRoot,
      roots: ['src/main.ts', 'src/App.vue'],
      isForbidden: (filename) => forbiddenEditorModules.includes(filename)
    })

    expect(violations).toEqual([])
  })
})
