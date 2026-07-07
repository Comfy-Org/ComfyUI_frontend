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

// Measured optimum (deterministic across repeats, best ms/node); see PR.
const BATCH_SIZE = 24
const AUTO_RUN_BATCH = 10
const GRID_SPACING = { x: 420, y: 360 }

// Nodes unsafe to execute on a bare backend; every entry names the mechanism.
const AUTO_RUN_EXCLUDE: Record<string, Record<string, string>> = {
  'rgthree-comfy': {
    'Power Primitive (rgthree)':
      'requires its pack JS to build the primitive value at queue time; raw defaults KeyError. Whether a page applies pack JS varies by serving setup, so excluded unconditionally - curated-workflow candidate',
    'Power Puter (rgthree)':
      'requires its pack JS to compile the expression at queue time; raw defaults KeyError. Excluded unconditionally - curated-workflow candidate'
  },
  'ComfyUI-KJNodes': {
    CreateMagicMask:
      'environment-variable execution: RuntimeError on the macOS CPU stack, clean on Linux CI',
    CreateVoronoiMask:
      'environment-variable execution: RuntimeError on the macOS CPU stack, clean on Linux CI',
    GenerateNoise:
      'environment-variable execution: rejected at validation locally, clean on Linux CI',
    Screencap_mss:
      'captures the screen; no X display on CI runners, real display locally',
    PointsEditor:
      'requires its pack JS to inject the points JSON at queue time; raw defaults JSONDecodeError. Excluded unconditionally - curated-workflow candidate',
    SplineEditor:
      'requires its pack JS to inject the spline JSON at queue time; raw defaults JSONDecodeError. Excluded unconditionally - curated-workflow candidate',
    StringToFloatList:
      'requires its pack JS to normalize the list string at queue time; raw defaults ValueError. Excluded unconditionally - curated-workflow candidate'
  },
  'ComfyUI-VideoHelperSuite': {
    VHS_LoadAudioUpload:
      'environment-variable execution: upload combo state differs between hosts (clean locally, Exception on CI)'
  },
  'was-node-suite-comfyui': {
    'Random Number':
      'environment-variable execution: TypeError locally, clean on Linux CI',
    ImageGrabPIL: 'grabs the screen via PIL; OSError on headless CI runners',
    'Image History Loader':
      'reads WAS run history; state-dependent (KeyError on a fresh CI backend)'
  },
  ComfyUI_essentials: {
    'RemBGSession+':
      'initializes a rembg session that downloads its ONNX model at execution; hangs (non-interruptibly) on a backend without network/model access',
    'TransitionMask+':
      'list-expanded execution emits no per-node executing event on some runs, so the executed-set signal flip-flops between PASS and PARTIAL; mount/save-reload/connectivity tiers still cover it',
    'TransparentBGSession+':
      'ML-session initializer like RemBGSession+; sets up/downloads a background-removal model at execution, unstable on a bare backend'
  }
}

// Pack-attributed console noise with no visible error surface.
const CONSOLE_ERROR_ALLOWLIST: Record<
  string,
  Array<{ pattern: RegExp; reason: string }>
> = {
  'ComfyUI-Impact-Pack': [
    {
      // Image widgets preview a hardcoded example.png fallback at creation;
      // 404s on a backend whose root does not serve it.
      pattern: /Failed to load resource.*404.*example\.png/,
      reason: 'image widget previews a hardcoded example.png fallback'
    }
  ],
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

// null id = createNode failed for that type.
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
            const restored = window.app!.graph.nodes.find(
              (node) => String(node.id) === id
            )
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

      // A leftover hung execution would false-timeout every run below.
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
      const hardFailures: string[] = []
      const cannotRun = new Map<string, string>()
      const ranClean = new Set<string>()
      for (const batch of batches) {
        const outcome = await runBatch(comfyPage.page, batch)
        if (outcome === 'PASS') {
          for (const verdict of batch) ranClean.add(verdict.key)
          continue
        }
        // A jammed queue false-timeouts everything after it - stop here.
        if (outcome.startsWith('HUNG_BACKEND')) {
          hardFailures.push(
            `[${batch.map((verdict) => verdict.key).join(', ')}]: ${outcome} - add the offender to AUTO_RUN_EXCLUDE with its mechanism`
          )
          break
        }
        // Rerun singles so the bad node names itself.
        for (const verdict of batch) {
          const single = await runBatch(comfyPage.page, [verdict])
          if (single === 'PASS') ranClean.add(verdict.key)
          else if (single.startsWith('HUNG_BACKEND')) {
            hardFailures.push(
              `${verdict.key}: ${single} - add to AUTO_RUN_EXCLUDE with its mechanism`
            )
            break
          } else cannotRun.set(verdict.key, single)
        }
      }
      // Two-way reconciliation: unlisted failure = regression; listed node
      // that runs clean (or is not auto-runnable) = stale entry.
      const baseline = new Set(entry.cannotRunAlone ?? [])
      const runnable = new Set(
        batches.flatMap((batch) => batch.map((verdict) => verdict.key))
      )
      for (const [key, detail] of cannotRun)
        if (!baseline.has(key))
          hardFailures.push(
            `${key}: ${detail} - not in cannotRunAlone; a regression, or a new baseline entry (attach the run log)`
          )
      for (const key of baseline) {
        if (ranClean.has(key))
          hardFailures.push(
            `${key}: ran clean but is listed in cannotRunAlone - remove the stale entry`
          )
        else if (!runnable.has(key))
          hardFailures.push(
            `${key}: listed in cannotRunAlone but is not auto-runnable on this backend - remove the stale entry`
          )
      }
      console.log(
        `${entry.pack} auto-ran ${ranClean.size} node(s) clean; ${cannotRun.size} cannot run alone (baseline ${baseline.size})`
      )
      expect(hardFailures, JSON.stringify(hardFailures, null, 1)).toEqual([])
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
  // Widget-only CPU nodes: not finished in 20s = hung.
  const result = await target.runWorkflow(page, {
    expectedNodeIds: ids,
    timeoutMs: 20_000
  })
  if (result.outcome === 'TIMEOUT') {
    // Interrupt and verify the queue drained; a non-interruptible hang can
    // only be cleared by a backend restart, so name it.
    const drained = await page.evaluate(async () => {
      await window.app!.api.interrupt(null)
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
