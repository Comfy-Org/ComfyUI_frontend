/* oxlint-disable playwright/no-skipped-test -- tiers conditionally skip when the target backend lacks the required packs (installed custom nodes, assertion nodes, or devtools); this is the framework's designed environment gating, not a disabled test */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ConsoleMessage, Page } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import { loadManifest } from '@e2e/fixtures/customNode/manifest'
import { expectedNodesPresent } from '@e2e/fixtures/customNode/objectInfoValidator'

const target = new LocalDesktopTarget()

function readWorkflow(relativePath: string): ComfyWorkflowJSON {
  return JSON.parse(
    readFileSync(resolve(relativePath), 'utf-8')
  ) as ComfyWorkflowJSON
}

async function nodeIdsByType(
  page: Page,
  classTypes: string[]
): Promise<string[]> {
  return await page.evaluate((types) => {
    const nodes = window.app!.graph.nodes ?? []
    return nodes
      .filter((node) => {
        const n = node as { comfyClass?: string; type?: string }
        return types.includes(n.comfyClass ?? n.type ?? '')
      })
      .map((node) => String(node.id))
  }, classTypes)
}

function collectConsoleErrors(page: Page): {
  errors: string[]
  stop: () => void
} {
  const errors: string[] = []
  const listener = (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text())
  }
  page.on('console', listener)
  return { errors, stop: () => page.off('console', listener) }
}

for (const entry of loadManifest()) {
  const workflowRelative = `browser_tests/${entry.workflow}`

  test.describe(`custom node: ${entry.pack}`, () => {
    test('T0 load: expected nodes register and render in both renderers', async ({
      comfyPage
    }) => {
      test.setTimeout(entry.timeoutMs)
      const objectInfo = await target.getObjectInfo(comfyPage.page)
      const { missing } = expectedNodesPresent(objectInfo, entry.expectedNodes)
      test.skip(
        missing.length > 0,
        `${entry.pack} not installed on this backend (missing: ${missing.join(', ')})`
      )

      for (const vueNodesEnabled of [false, true]) {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        const consoleErrors = collectConsoleErrors(comfyPage.page)
        for (const classType of entry.expectedNodes)
          await comfyPage.nodeOps.addNode(classType)
        await comfyPage.nextFrame()

        expect(
          await comfyPage.nodeOps.getGraphNodesCount()
        ).toBeGreaterThanOrEqual(entry.expectedNodes.length)
        // Vue Nodes 2.0 mounts each node as a [data-node-id] DOM element; assert
        // it actually rendered, not just that it exists in the LiteGraph model.
        if (vueNodesEnabled) {
          await comfyPage.vueNodes.waitForNodes(entry.expectedNodes.length)
          expect(
            await comfyPage.vueNodes.getNodeCount()
          ).toBeGreaterThanOrEqual(entry.expectedNodes.length)
        }
        consoleErrors.stop()
        expect(
          consoleErrors.errors,
          `console errors with VueNodes=${vueNodesEnabled}`
        ).toEqual([])
      }
    })

    test('T1 run: workflow executes without error', async ({ comfyPage }) => {
      const objectInfo = await target.getObjectInfo(comfyPage.page)
      const { missing } = expectedNodesPresent(objectInfo, entry.expectedNodes)
      test.skip(
        !entry.tiers.includes('run') ||
          missing.length > 0 ||
          entry.requiresGpu ||
          !existsSync(resolve(workflowRelative)),
        `run tier unavailable for ${entry.pack}`
      )

      await comfyPage.workflow.loadGraphData(readWorkflow(workflowRelative))
      const result = await target.runWorkflow(comfyPage.page, {
        expectedNodeIds: await nodeIdsByType(
          comfyPage.page,
          entry.expectedNodes
        ),
        timeoutMs: entry.timeoutMs
      })

      expect(result.outcome, JSON.stringify(result.error ?? {})).toBe('PASS')
    })

    test('T2a io: assertion nodes pass', async ({ comfyPage }) => {
      const objectInfo = await target.getObjectInfo(comfyPage.page)
      const { missing } = expectedNodesPresent(objectInfo, entry.expectedNodes)
      test.skip(
        !entry.tiers.includes('io') ||
          missing.length > 0 ||
          !('Assert Executed' in objectInfo) ||
          !existsSync(resolve(workflowRelative)),
        `io tier needs ${entry.pack} + ComfyUI-test-framework assertion nodes + workflow`
      )

      await comfyPage.workflow.loadGraphData(readWorkflow(workflowRelative))
      const result = await target.runWorkflow(comfyPage.page, {
        expectedNodeIds: await nodeIdsByType(comfyPage.page, [
          ...entry.expectedNodes,
          'Assert Executed'
        ]),
        timeoutMs: entry.timeoutMs
      })

      expect(result.outcome, JSON.stringify(result.error ?? {})).toBe('PASS')
    })
  })
}

test('harness self-check: captures a real execution error', async ({
  comfyPage
}) => {
  const objectInfo = await target.getObjectInfo(comfyPage.page)
  test.skip(
    !('DevToolsErrorRaiseNode' in objectInfo),
    'ComfyUI_devtools not installed on this backend'
  )

  await comfyPage.workflow.loadGraphData(
    readWorkflow('browser_tests/assets/nodes/execution_error.json')
  )
  const result = await target.runWorkflow(comfyPage.page, {
    expectedNodeIds: [],
    timeoutMs: 15000
  })

  expect(result.outcome).toBe('EXECUTION_ERROR')
  expect(result.error?.exceptionType).toBeTruthy()
})
