/* oxlint-disable playwright/no-skipped-test -- tiers conditionally skip when the target backend lacks the required packs (installed custom nodes or devtools); this is the framework's designed environment gating, not a disabled test */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Page } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  customNodeSuiteSettings,
  dismissTemplatesDialog
} from '@e2e/fixtures/utils/customNodeSuite'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import {
  loadManifest,
  rendererPassesFor
} from '@e2e/fixtures/customNode/manifest'
import { expectedNodesPresent } from '@e2e/fixtures/customNode/objectInfoValidator'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { errorSurfaces } from '@e2e/fixtures/utils/errorSurfaces'
import { assetPath } from '@e2e/fixtures/utils/paths'

const target = new LocalDesktopTarget()
const OBJECT_INFO_SANITY_FLOOR = 50
// Display sinks used by the curated workflows; each is an output node whose
// `executed` event carries a ui payload, so "the workflow ran" can be
// upgraded to "data actually arrived at the sink". Console-style sinks
// (WAS `Text to Console`) emit NO ui payload and stay off this list, so a
// pack whose only sink prints to console gets execution-completed proof
// only.
const CURATED_SINK_TYPES = [
  'PreviewAny',
  'DisplayAny',
  'Display Any (rgthree)',
  'ShowText|pysssss'
]

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  await dismissTemplatesDialog(comfyPage)
})

async function expectNoVisibleErrors(
  page: Page,
  context: string
): Promise<void> {
  for (const [surface, locator] of Object.entries(errorSurfaces(page)))
    await expect(locator, `${context}: ${surface}`).toHaveCount(0)
}

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
      await expectNoVisibleErrors(comfyPage.page, 'at startup')

      // vueNodesCompatible: false = canvas-only assertions; still runs, no skip.
      const rendererPasses = rendererPassesFor(entry)
      if (entry.vueNodesCompatible === false)
        console.log(
          `${entry.pack} declares vueNodesCompatible=false; Vue Nodes pass not applicable`
        )
      for (const vueNodesEnabled of rendererPasses) {
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
        await expectNoVisibleErrors(
          comfyPage.page,
          `after VueNodes=${vueNodesEnabled} pass`
        )
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
      await expectNoVisibleErrors(comfyPage.page, 'at startup')

      await comfyPage.workflow.loadGraphData(readWorkflow(workflowRelative))
      const result = await target.runWorkflow(comfyPage.page, {
        expectedNodeIds: await nodeIdsByType(
          comfyPage.page,
          entry.expectedNodes
        ),
        timeoutMs: entry.timeoutMs
      })

      expect(result.outcome, JSON.stringify(result.error ?? {})).toBe('PASS')
      // PASS proves execution completed; the sinks prove data ARRIVED.
      // Every display sink in the curated workflow must have emitted a ui
      // payload through its executed event.
      const sinkIds = await nodeIdsByType(comfyPage.page, CURATED_SINK_TYPES)
      for (const sinkId of sinkIds)
        expect(
          result.outputsByNode[sinkId],
          `sink node ${sinkId} produced no ui payload`
        ).toBeTruthy()
      await expectNoVisibleErrors(comfyPage.page, 'after run')
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
  // Positive control for the zero-visible-errors invariant: a real execution
  // error MUST surface in the app's error overlay. If this fails, the
  // expectNoVisibleErrors selectors have rotted and every clean assertion in
  // this suite is meaningless.
  await expect(errorSurfaces(comfyPage.page).errorOverlay).toBeVisible()
})

test('collector self-check: captures uncaught page exceptions', async ({
  comfyPage
}) => {
  // Positive control for the console collector: an uncaught async throw
  // never reaches console.error, so this proves the pageerror listener
  // works. If this fails, every zero-console-errors assertion in the suite
  // is blind to the whole uncaught-exception class.
  const collected = collectConsoleErrors(comfyPage.page)
  await comfyPage.page.evaluate(() => {
    setTimeout(() => {
      throw new Error('cn-collector-self-check')
    }, 0)
  })
  await expect
    .poll(() =>
      collected.errors.some((error) =>
        error.includes('cn-collector-self-check')
      )
    )
    .toBe(true)
  collected.stop()
})

test('attribution self-check: a foreign-prompt terminal event cannot fail this run', async ({
  comfyPage
}) => {
  test.setTimeout(30_000)
  const objectInfo = await target.getObjectInfo(comfyPage.page)
  test.skip(
    !('PrimitiveInt' in objectInfo) || !('PreviewAny' in objectInfo),
    'core Primitive/PreviewAny nodes unavailable on this backend'
  )
  await comfyPage.workflow.loadGraphData(
    readWorkflow(assetPath('customNodes/core_primitive_preview_run.json'))
  )
  // Once the run's event tap starts filling, inject ONE terminal error under
  // a prompt id this page never queued. The positive prompt-id filter must
  // discard it; the pre-capture harness let the never-seen id through the
  // seen-set and misclassified the run as EXECUTION_ERROR. This is the
  // discriminating guard for the foreign-attribution bug class.
  await comfyPage.page.evaluate(() => {
    const timer = setInterval(() => {
      const sink = (window as unknown as { __cnEvents?: object[] }).__cnEvents
      if (!sink || sink.length === 0) return
      sink.push({
        type: 'execution_error',
        prompt_id: 'cn-foreign-self-check',
        exception_type: 'ForeignError',
        node_id: '424242'
      })
      clearInterval(timer)
    }, 25)
  })
  const result = await target.runWorkflow(comfyPage.page, {
    expectedNodeIds: await nodeIdsByType(comfyPage.page, [
      'PrimitiveInt',
      'PreviewAny'
    ]),
    timeoutMs: 15000
  })
  expect(result.outcome, JSON.stringify(result.error ?? {})).toBe('PASS')
  expect(result.error).toBeUndefined()
})
