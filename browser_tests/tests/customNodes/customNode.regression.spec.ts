/* oxlint-disable playwright/no-skipped-test -- tiers conditionally skip when the target backend lacks the required packs (installed custom nodes, assertion nodes, or devtools); this is the framework's designed environment gating, not a disabled test */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Page } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import { loadManifest } from '@e2e/fixtures/customNode/manifest'
import { expectedNodesPresent } from '@e2e/fixtures/customNode/objectInfoValidator'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { assetPath } from '@e2e/fixtures/utils/paths'

const target = new LocalDesktopTarget()
const OBJECT_INFO_SANITY_FLOOR = 50

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

for (const entry of loadManifest()) {
  const workflowRelative = `browser_tests/${entry.workflow}`

  test.describe(`custom node: ${entry.pack}`, () => {
    test('T0 load: expected nodes register and render in both renderers', async ({
      comfyPage
    }) => {
      test.setTimeout(entry.timeoutMs)
      const objectInfo = await target.getObjectInfo(comfyPage.page)
      expect(
        Object.keys(objectInfo).length,
        'object_info sanity floor'
      ).toBeGreaterThan(OBJECT_INFO_SANITY_FLOOR)
      const { missing } = expectedNodesPresent(objectInfo, entry.expectedNodes)
      test.skip(
        missing.length > 0,
        `${entry.pack} not installed on this backend (missing: ${missing.join(', ')})`
      )

      for (const vueNodesEnabled of [false, true]) {
        const consoleErrors = collectConsoleErrors(comfyPage.page)
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.nodeOps.clearGraph()

        const addedIds: string[] = []
        for (const classType of entry.expectedNodes) {
          const node = await comfyPage.nodeOps.addNode(classType)
          addedIds.push(String(node.id))
        }
        await comfyPage.nextFrame()

        expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(
          entry.expectedNodes.length
        )
        // Vue Nodes 2.0 mounts each node as a [data-node-id] element; assert
        // the pack's own nodes rendered, not just any node count.
        if (vueNodesEnabled)
          for (const id of addedIds)
            await expect(comfyPage.vueNodes.getNodeLocator(id)).toBeVisible()

        consoleErrors.stop()
        expect(
          consoleErrors.errors,
          `console errors with VueNodes=${vueNodesEnabled}`
        ).toEqual([])
      }
    })

    test('T1 run: workflow executes without error', async ({ comfyPage }) => {
      test.setTimeout(entry.timeoutMs + 15_000)
      const objectInfo = await target.getObjectInfo(comfyPage.page)
      const { missing } = expectedNodesPresent(objectInfo, entry.expectedNodes)
      test.skip(
        !entry.tiers.includes('run') ||
          missing.length > 0 ||
          entry.requiresGpu ||
          entry.requiresModels.length > 0 ||
          !entry.workflow ||
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
      test.setTimeout(entry.timeoutMs + 15_000)
      const objectInfo = await target.getObjectInfo(comfyPage.page)
      const { missing } = expectedNodesPresent(objectInfo, entry.expectedNodes)
      test.skip(
        !entry.tiers.includes('io') ||
          missing.length > 0 ||
          entry.requiresGpu ||
          entry.requiresModels.length > 0 ||
          !('Assert Executed' in objectInfo) ||
          !entry.workflow ||
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
  test.setTimeout(30_000)
  const objectInfo = await target.getObjectInfo(comfyPage.page)
  expect(
    Object.keys(objectInfo).length,
    'object_info sanity floor'
  ).toBeGreaterThan(OBJECT_INFO_SANITY_FLOOR)
  test.skip(
    !('DevToolsErrorRaiseNode' in objectInfo),
    'ComfyUI_devtools not installed on this backend'
  )

  await comfyPage.workflow.loadGraphData(
    readWorkflow(assetPath('nodes/execution_error.json'))
  )
  const result = await target.runWorkflow(comfyPage.page, {
    expectedNodeIds: [],
    timeoutMs: 15000
  })

  expect(result.outcome).toBe('EXECUTION_ERROR')
  expect(result.error?.exceptionType).toBeTruthy()
  // Proves the event tap captures node ids from the live `executing` stream
  // (its detail is a bare string): the failing node starts before it raises.
  expect(result.executedNodes.length).toBeGreaterThan(0)
})
