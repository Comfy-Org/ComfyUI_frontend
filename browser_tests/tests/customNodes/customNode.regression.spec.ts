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
  dismissTemplatesDialog,
  drainBackendToIdle
} from '@e2e/fixtures/utils/customNodeSuite'
import {
  referencedRunMedia,
  uploadRunMedia
} from '@e2e/fixtures/customNode/cloudMedia'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import {
  isForeignExecutionNoise,
  unallowlistedErrors
} from '@e2e/fixtures/customNode/consoleErrorLedger'
import {
  customNodesEnv,
  loadManifest,
  rendererPassesFor
} from '@e2e/fixtures/customNode/manifest'
import { missingExpectedNodes } from '@e2e/fixtures/customNode/objectInfoValidator'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  errorSurfaces,
  expectNoVisibleErrors
} from '@e2e/fixtures/utils/errorSurfaces'
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

// Leave the shared backend idle so the next test starts clean (drainBackendToIdle).
test.afterEach(async ({ comfyPage }) => {
  // The drain is a no-op when the queue is already idle, so it costs
  // ~nothing in the common path; the 10s ceiling only bounds a genuinely
  // busy backend. A backend still busy past it is wedged, and the auto-run
  // tier's 150s guard surfaces that with the restart diagnostic.
  await drainBackendToIdle(comfyPage.page, 10_000)
})

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

  test.describe(`custom node: ${entry.pack} @custom-nodes`, () => {
    test('T0 load: expected nodes register, render in both renderers, and frontend extensions load', async ({
      comfyPage
    }) => {
      test.setTimeout(entry.timeoutMs)
      const objectInfo = await target.getObjectInfo(comfyPage.page)
      expect(
        Object.keys(objectInfo).length,
        'object_info sanity floor'
      ).toBeGreaterThan(OBJECT_INFO_SANITY_FLOOR)
      const missing = missingExpectedNodes(objectInfo, entry.expectedNodes)
      test.skip(
        missing.length > 0,
        `${entry.pack} not installed on this backend (missing: ${missing.join(', ')})`
      )
      await expectNoVisibleErrors(comfyPage.page, 'at startup')

      // Backend registration alone does not prove the pack's FRONTEND JS
      // loaded: a wrong web dir or a loadExtensions regression leaves nodes
      // in object_info while every JS-driven behavior silently vanishes
      // (and this suite would then be testing vanilla nodes). Assert the
      // pack's boot-registered extensions actually arrived in the browser.
      if (entry.expectedExtensions.length > 0) {
        const registered = await comfyPage.page.evaluate(() =>
          window.app!.extensions.map((extension) => extension.name)
        )
        for (const name of entry.expectedExtensions)
          expect(
            registered,
            `${entry.pack}: frontend extension "${name}" not registered - pack JS did not load`
          ).toContain(name)
      }

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
        // T0 loads and renders nodes but queues no prompt; a prompt-execution
        // error here is a prior tier's async stray (isForeignExecutionNoise).
        expect(
          consoleErrors.errors.filter(
            (error) => !isForeignExecutionNoise(error)
          ),
          `console errors with VueNodes=${vueNodesEnabled}`
        ).toEqual([])
        await expectNoVisibleErrors(
          comfyPage.page,
          `after VueNodes=${vueNodesEnabled} pass`
        )
      }
    })

    // Registration-gated, not runtime-skipped: a row not enrolled in the run
    // tier generates no T1 at all, so the gates' zero-skip check keeps
    // meaning "every enrolled tier ran" even while generated cloud rows are
    // load+connectivity only. The runtime skip below covers only conditions
    // of the ENVIRONMENT an enrolled row meets (pack not installed on this
    // backend, GPU/models the runner lacks, workflow file absent locally).
    if (entry.tiers.includes('run'))
      test('T1 run: workflow executes without error', async ({ comfyPage }) => {
        test.setTimeout(entry.timeoutMs + 15_000)
        const objectInfo = await target.getObjectInfo(comfyPage.page)
        const missing = missingExpectedNodes(objectInfo, entry.expectedNodes)
        test.skip(
          missing.length > 0 ||
            ('requiresGpu' in entry &&
              (entry.requiresGpu || entry.requiresModels.length > 0)) ||
            !existsSync(resolve(workflowRelative)),
          `run tier unavailable for ${entry.pack}`
        )
        await expectNoVisibleErrors(comfyPage.page, 'at startup')

        // Pack scripts can throw during workflow load or execution without
        // any visible error surface; collect console + uncaught page errors
        // across the whole run, filtered through the shared pack ledger.
        const consoleErrors = collectConsoleErrors(comfyPage.page)
        const workflow = readWorkflow(workflowRelative)
        if (customNodesEnv() === 'cloud')
          await uploadRunMedia(comfyPage.page, referencedRunMedia(workflow))
        await comfyPage.workflow.loadGraphData(workflow)
        // A drifted fixture that dropped an expected node would silently
        // shrink the executed-set assertion (an empty id list PASSes on
        // execution_success alone): require every expected type to actually
        // be present in the loaded workflow before running it.
        const expectedNodeIds: string[] = []
        for (const type of entry.expectedNodes) {
          const ids = await nodeIdsByType(comfyPage.page, [type])
          expect(
            ids.length,
            `expectedNodes drift: ${type} is not in the curated workflow ${entry.workflow}`
          ).toBeGreaterThan(0)
          expectedNodeIds.push(...ids)
        }
        const result = await target.runWorkflow(comfyPage.page, {
          expectedNodeIds,
          timeoutMs: entry.timeoutMs
        })

        // A run that executed and errored carries an ExecutionError; a run the
        // backend rejected before executing (VALIDATION_FAIL) carries only the
        // captured node_errors text in clientError - surface whichever exists so
        // a red names the cause instead of printing an empty object.
        expect(
          result.outcome,
          result.clientError ?? JSON.stringify(result.error ?? {})
        ).toBe('PASS')
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
        consoleErrors.stop()
        expect(
          unallowlistedErrors(entry.pack, consoleErrors.errors),
          'console errors during curated run'
        ).toEqual([])
      })
  })
}

test('harness self-check: captures a real execution error @custom-nodes', async ({
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

test('collector self-check: captures uncaught page exceptions @custom-nodes', async ({
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

test('attribution self-check: a foreign-prompt terminal event cannot fail this run @custom-nodes', async ({
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
    const w = window as unknown as {
      __cnEvents?: object[]
      __cnSelfCheckTimer?: ReturnType<typeof setInterval>
    }
    w.__cnSelfCheckTimer = setInterval(() => {
      const sink = w.__cnEvents
      if (!sink || sink.length === 0) return
      sink.push({
        type: 'execution_error',
        prompt_id: 'cn-foreign-self-check',
        exception_type: 'ForeignError',
        node_id: '424242'
      })
      clearInterval(w.__cnSelfCheckTimer)
    }, 25)
  })
  const result = await target.runWorkflow(comfyPage.page, {
    expectedNodeIds: await nodeIdsByType(comfyPage.page, [
      'PrimitiveInt',
      'PreviewAny'
    ]),
    timeoutMs: 15000
  })
  // Prove the stimulus actually landed before trusting the PASS: without
  // this, a run that finishes before the injector's next tick never injects
  // the foreign event, and PASS then holds for the wrong reason (it would
  // hold identically against a harness with the prompt-id filter removed).
  // Clearing a not-yet-fired timer stops a post-run push from faking it.
  const injectionLanded = await comfyPage.page.evaluate(() => {
    const w = window as unknown as {
      __cnEvents?: { prompt_id?: string }[]
      __cnSelfCheckTimer?: ReturnType<typeof setInterval>
    }
    clearInterval(w.__cnSelfCheckTimer)
    return (w.__cnEvents ?? []).some(
      (event) => event.prompt_id === 'cn-foreign-self-check'
    )
  })
  expect(
    injectionLanded,
    'positive control: the foreign terminal event was injected during the run'
  ).toBe(true)
  expect(result.outcome, JSON.stringify(result.error ?? {})).toBe('PASS')
  expect(result.error).toBeUndefined()
})
