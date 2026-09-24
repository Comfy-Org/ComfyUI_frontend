import type { Page } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyApp } from '@/scripts/app'
import { blankWorkflowGraph } from '@/scripts/blankWorkflowGraph'

type LoadGraphDataHost = Pick<ComfyApp, 'loadGraphData'>
type LoadGraphDataArgs = Parameters<ComfyApp['loadGraphData']>

/**
 * Replaces the first startup graph load on this page.
 */
export async function installStartupGraph(
  page: Page,
  graph: ComfyWorkflowJSON = blankWorkflowGraph
): Promise<void> {
  await page.addInitScript((startupGraph: ComfyWorkflowJSON) => {
    let patched = false
    let appRef: LoadGraphDataHost | undefined
    Object.defineProperty(window, 'app', {
      configurable: true,
      get: () => appRef,
      set: (value: LoadGraphDataHost | undefined) => {
        appRef = value
        if (patched || typeof value?.loadGraphData !== 'function') return
        patched = true
        const original = value.loadGraphData.bind(value)
        value.loadGraphData = (...args: LoadGraphDataArgs) => {
          value.loadGraphData = original
          const [graphData, ...rest] = args
          return original(graphData ?? startupGraph, ...rest)
        }
        Object.defineProperty(window, 'app', {
          configurable: true,
          writable: true,
          value
        })
      }
    })
  }, graph)
}
