/* oxlint-disable playwright/no-skipped-test -- tiers conditionally skip when the target backend lacks the required packs; environment gating, not a disabled test */
// Every-node coverage: the suite's core contract (mounts, survives
// save/reload, executes when self-sufficient) applied to ALL nodes a pack
// registers - not just the curated expectedNodes sentinels. Node lists come
// from the live backend, so a pack update is covered the moment it installs.
import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  batchAutoRunnable,
  planAutoRuns
} from '@e2e/fixtures/customNode/autoRun'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import { loadManifest } from '@e2e/fixtures/customNode/manifest'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import { normalizeNodeDefs } from '@e2e/fixtures/customNode/typePairing'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  customNodeSuiteSettings,
  dismissTemplatesDialog
} from '@e2e/fixtures/utils/customNodeSuite'
import { errorSurfaces } from '@e2e/fixtures/utils/errorSurfaces'

const target = new LocalDesktopTarget()

// Empirically calibrated (browser_tests/tools/batchCalibration.spec.ts):
// 24 was the largest chunk size with deterministic results across repeats
// and the best per-node cost (6.6ms/node; smaller chunks pay per-chunk
// overhead, larger ones pay fit-view and DOM density).
const BATCH_SIZE = 24
const AUTO_RUN_BATCH = 10
const GRID_SPACING = { x: 420, y: 360 }

// Nodes whose EXECUTION is unsafe on a bare sandboxed backend even though
// their inputs classify as auto-runnable. Every entry names the mechanism.
// The canonical case: a node that downloads a model at execution time hangs
// a network-restricted backend in a non-interruptible call, jamming the
// prompt queue for everything after it.
const AUTO_RUN_EXCLUDE: Record<string, Record<string, string>> = {
  ComfyUI_essentials: {
    'RemBGSession+':
      'initializes a rembg session that downloads its ONNX model at execution; hangs (non-interruptibly) on a backend without network/model access'
  }
}

// Pack-attributed console noise with no visible error surface. Every entry
// names the mechanism; anything not matching stays a hard failure.
const CONSOLE_ERROR_ALLOWLIST: Record<
  string,
  Array<{ pattern: RegExp; reason: string }>
> = {
  'ComfyUI-KJNodes': [
    {
      // Image/video loader previews fetch their combo value at creation;
      // on a backend with an empty input dir the value is undefined and the
      // preview 404s (and retries with a fresh rand). Console-only noise,
      // no visible error; upstream-report candidate.
      pattern:
        /Failed to load resource.*\/api\/view\?type=input&filename=undefined/,
      reason: 'loader preview fetches undefined filename on empty input dir'
    }
  ]
}

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

// One in-page round-trip per chunk: batch-add on a grid, fit the viewport.
// Returns ids aligned with `types` (null = createNode failed).
function addChunk(page: Page, types: string[]): Promise<Array<string | null>> {
  return page.evaluate(
    ([chunk, spacingX, spacingY]) => {
      window.app!.graph.clear()
      const cols = Math.ceil(Math.sqrt(chunk.length))
      const ids: Array<string | null> = []
      for (const [index, type] of chunk.entries()) {
        const node = window.LiteGraph!.createNode(type)
        if (!node) {
          ids.push(null)
          continue
        }
        node.pos = [
          (index % cols) * (spacingX as number),
          Math.floor(index / cols) * (spacingY as number)
        ]
        window.app!.graph.add(node)
        ids.push(String(node.id))
      }
      const canvas = window.app!.canvas
      const rect = canvas.canvas.getBoundingClientRect()
      const width = cols * (spacingX as number)
      const height = Math.ceil(chunk.length / cols) * (spacingY as number)
      const scale = Math.min(
        (rect.width / Math.max(width, 1)) * 0.9,
        (rect.height / Math.max(height, 1)) * 0.9,
        1
      )
      canvas.ds.scale = scale
      canvas.ds.offset = [60 / scale, 60 / scale]
      canvas.setDirty(true, true)
      return ids
    },
    [types, GRID_SPACING.x, GRID_SPACING.y] as const
  )
}

async function packNodeKeys(
  page: Page,
  pack: string
): Promise<{ keys: string[]; defs: Record<string, RawNodeDef> }> {
  const defs = (await page.evaluate(() =>
    window.app!.api.getNodeDefs()
  )) as unknown as Record<string, RawNodeDef>
  const keys = normalizeNodeDefs(defs)
    .filter((node) => node.pack === pack)
    .map((node) => node.type)
    .sort()
  return { keys, defs }
}

for (const entry of loadManifest()) {
  test.describe(`all nodes: ${entry.pack}`, () => {
    test('every registered node mounts in both renderers', async ({
      comfyPage
    }) => {
      test.setTimeout(240_000)
      const { keys } = await packNodeKeys(comfyPage.page, entry.pack)
      test.skip(
        keys.length === 0,
        `${entry.pack} not installed on this backend`
      )
      const ledger = entry.vueIncompatibleNodes ?? {}
      for (const ledgered of Object.keys(ledger))
        expect(
          keys,
          `stale ledger entry: ${ledgered} is not registered by ${entry.pack}`
        ).toContain(ledgered)

      for (const vueNodesEnabled of [false, true]) {
        const consoleErrors = collectConsoleErrors(comfyPage.page)
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        const failures: string[] = []
        for (let offset = 0; offset < keys.length; offset += BATCH_SIZE) {
          const chunk = keys.slice(offset, offset + BATCH_SIZE)
          const ids = await addChunk(comfyPage.page, chunk)
          await comfyPage.nextFrame()
          const count = await comfyPage.nodeOps.getGraphNodesCount()
          if (count !== chunk.length)
            failures.push(
              `chunk@${offset}: graph has ${count} of ${chunk.length} nodes`
            )
          for (const [index, id] of ids.entries()) {
            const key = chunk[index]
            if (id === null) {
              failures.push(`${key}: createNode returned null`)
              continue
            }
            if (!vueNodesEnabled) continue
            if (key in ledger) continue
            const visible = await comfyPage.page
              .locator(`[data-node-id="${id}"]`)
              .isVisible({ timeout: 2_000 })
              .catch(() => false)
            if (!visible) failures.push(`${key}: no Vue mount`)
          }
        }
        if (vueNodesEnabled && Object.keys(ledger).length > 0)
          console.log(
            `${entry.pack}: ${Object.keys(ledger).length} node(s) ledgered Vue-incompatible; Vue mount not asserted for them`
          )
        consoleErrors.stop()
        expect(
          failures,
          `VueNodes=${vueNodesEnabled}: ${JSON.stringify(failures, null, 1)}`
        ).toEqual([])
        const allowlist = CONSOLE_ERROR_ALLOWLIST[entry.pack] ?? []
        const allowed = consoleErrors.errors.filter((error) =>
          allowlist.some((rule) => rule.pattern.test(error))
        )
        if (allowed.length > 0)
          console.log(
            `${entry.pack}: ${allowed.length} console error(s) matched the pack's allowlist (${allowlist.map((rule) => rule.reason).join('; ')})`
          )
        expect(
          consoleErrors.errors.filter(
            (error) => !allowlist.some((rule) => rule.pattern.test(error))
          ),
          `console errors with VueNodes=${vueNodesEnabled}`
        ).toEqual([])
        await expectNoVisibleErrors(
          comfyPage.page,
          `after all-nodes VueNodes=${vueNodesEnabled} pass`
        )
      }
    })

    test('every registered node survives save/reload', async ({
      comfyPage
    }) => {
      test.setTimeout(240_000)
      const { keys } = await packNodeKeys(comfyPage.page, entry.pack)
      test.skip(
        keys.length === 0,
        `${entry.pack} not installed on this backend`
      )
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)

      const mismatches: string[] = []
      for (let offset = 0; offset < keys.length; offset += BATCH_SIZE) {
        const chunk = keys.slice(offset, offset + BATCH_SIZE)
        const chunkMismatches = await comfyPage.page.evaluate((types) => {
          window.app!.graph.clear()
          const before = new Map<
            string,
            { type: string; widgetValues: number }
          >()
          for (const type of types) {
            const node = window.LiteGraph!.createNode(type)
            if (!node) continue
            window.app!.graph.add(node)
            before.set(String(node.id), {
              type,
              widgetValues: (node.widgets ?? []).length
            })
          }
          const serialized = window.app!.graph.serialize()
          window.app!.graph.configure(serialized)
          const problems: string[] = []
          for (const [id, expected] of before) {
            const restored = window.app!.graph.getNodeById(Number(id))
            if (!restored) {
              problems.push(`${expected.type}: lost on reload`)
              continue
            }
            if (restored.type !== expected.type)
              problems.push(
                `${expected.type}: type became ${String(restored.type)}`
              )
            const widgets = (restored.widgets ?? []).length
            if (widgets !== expected.widgetValues)
              problems.push(
                `${expected.type}: widgets ${expected.widgetValues} -> ${widgets}`
              )
          }
          window.app!.graph.clear()
          return problems
        }, chunk)
        mismatches.push(...chunkMismatches)
      }
      expect(mismatches, JSON.stringify(mismatches, null, 1)).toEqual([])
      await expectNoVisibleErrors(comfyPage.page, 'after save/reload sweep')
    })

    test('every auto-runnable node executes without error', async ({
      comfyPage
    }) => {
      test.setTimeout(900_000)
      const { keys, defs } = await packNodeKeys(comfyPage.page, entry.pack)
      test.skip(
        keys.length === 0,
        `${entry.pack} not installed on this backend`
      )
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)

      // A hung execution from an earlier test would make every run below
      // false-timeout; fail fast with the real cause instead.
      const queueBusy = await comfyPage.page.evaluate(async () => {
        const queue = (await window.app!.api.getQueue()) as {
          Running?: unknown[]
        }
        return (queue.Running ?? []).length
      })
      expect(
        queueBusy,
        'backend queue already has a running prompt (earlier hung execution?) - restart the test backend'
      ).toBe(0)

      const excluded = AUTO_RUN_EXCLUDE[entry.pack] ?? {}
      for (const [key, reason] of Object.entries(excluded))
        console.log(`${entry.pack}: ${key} excluded from auto-run (${reason})`)
      const verdicts = planAutoRuns(
        defs,
        keys.filter((key) => !(key in excluded))
      )
      const counts = new Map<string, number>()
      for (const verdict of verdicts)
        counts.set(verdict.verdict, (counts.get(verdict.verdict) ?? 0) + 1)
      console.log(
        `${entry.pack} auto-run plan: ${[...counts.entries()]
          .map(([verdict, count]) => `${verdict}=${count}`)
          .join(' ')}`
      )

      const batches = batchAutoRunnable(verdicts, AUTO_RUN_BATCH)
      const failures: string[] = []
      // Defaults that fail backend validation (file paths that don't exist on
      // a bare backend, empty dir scans) mean "cannot run alone" - recorded
      // like NEEDS_MODELS, not failed. A validation regression for nodes that
      // DID run clean shows up as a diff in this logged list.
      const rejectedOnDefaults: string[] = []
      let ran = 0
      for (const batch of batches) {
        const outcome = await runBatch(comfyPage.page, batch)
        if (outcome === 'PASS') {
          ran += batch.length
          continue
        }
        // A jammed queue makes every further run a false timeout - stop and
        // name the suspects instead of bisecting through poisoned results.
        if (outcome.startsWith('HUNG_BACKEND')) {
          failures.push(
            `[${batch.map((verdict) => verdict.key).join(', ')}]: ${outcome} - add the offender to AUTO_RUN_EXCLUDE with its mechanism`
          )
          break
        }
        // Isolate: rerun each node alone so one bad node names itself
        // instead of implicating its nine batch-mates.
        for (const verdict of batch) {
          const single = await runBatch(comfyPage.page, [verdict])
          if (single === 'PASS') ran += 1
          else if (single === 'VALIDATION_FAIL')
            rejectedOnDefaults.push(verdict.key)
          else if (single.startsWith('HUNG_BACKEND')) {
            failures.push(
              `${verdict.key}: ${single} - add to AUTO_RUN_EXCLUDE with its mechanism`
            )
            break
          } else failures.push(`${verdict.key}: ${single}`)
        }
      }
      if (rejectedOnDefaults.length > 0)
        console.log(
          `${entry.pack}: ${rejectedOnDefaults.length} node(s) rejected at validation on default values (need curated fixtures): ${rejectedOnDefaults.join(', ')}`
        )
      expect(failures, JSON.stringify(failures, null, 1)).toEqual([])
      console.log(`${entry.pack} auto-ran ${ran} node(s) clean`)
    })
  })
}

async function runBatch(
  page: Page,
  batch: Array<{ key: string; needsPreviewSink?: boolean }>
): Promise<string> {
  const ids = await page.evaluate(
    ([nodes, spacingY]) => {
      window.app!.graph.clear()
      const ids: string[] = []
      for (const [index, spec] of nodes.entries()) {
        const node = window.LiteGraph!.createNode(spec.key)
        if (!node) continue
        node.pos = [0, index * (spacingY as number)]
        window.app!.graph.add(node)
        ids.push(String(node.id))
        if (spec.needsPreviewSink) {
          const sink = window.LiteGraph!.createNode('PreviewAny')!
          sink.pos = [460, index * (spacingY as number)]
          window.app!.graph.add(sink)
          node.connect(0, sink, 0)
        }
      }
      return ids
    },
    [batch, GRID_SPACING.y] as const
  )
  // Auto-runnable nodes are widget-only and CPU-trivial; anything that has
  // not finished in 20s is hung, and validation rejects return instantly.
  const result = await target.runWorkflow(page, {
    expectedNodeIds: ids,
    timeoutMs: 20_000
  })
  if (result.outcome === 'TIMEOUT') {
    // Leave no execution behind: an abandoned run jams the single prompt
    // queue and every later run false-timeouts behind it. Interrupt, then
    // verify the queue actually drained - a non-interruptible hang (e.g. a
    // node blocked in a network download) can only be cleared by a backend
    // restart, so name it instead of letting it poison the rest.
    const drained = await page.evaluate(async () => {
      await window.app!.api.interrupt()
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        const queue = (await window.app!.api.getQueue()) as {
          Running?: unknown[]
        }
        if ((queue.Running ?? []).length === 0) return true
      }
      return false
    })
    if (!drained)
      return 'HUNG_BACKEND (non-interruptible execution; backend restart required)'
  }
  return result.outcome === 'PASS'
    ? 'PASS'
    : `${result.outcome}${result.error?.nodeType ? ` (${result.error.nodeType}: ${result.error.exceptionType ?? ''})` : ''}`
}
