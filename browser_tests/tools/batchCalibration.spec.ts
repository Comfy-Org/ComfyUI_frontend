// Measurement tool, not a gate: finds the largest mount-check batch size that
// is deterministic (identical results across repeats) and fast, for the
// all-nodes load tier. Run explicitly against a backend with the manifest
// packs installed and pack JS loaded (dist-serving; see ADDING_PACKS 6b):
//   CN_CALIBRATE=1 PLAYWRIGHT_TEST_URL=http://127.0.0.1:8288 \
//     pnpm exec playwright test browser_tests/tools/batchCalibration.spec.ts \
//     --config playwright.chrome.config.ts --workers=1
// Skipped everywhere else; the gating custom-nodes CI job is path-scoped to
// tests/customNodes/ and never sees this file.
/* oxlint-disable playwright/no-skipped-test -- opt-in measurement tool */
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import { normalizeNodeDefs } from '@e2e/fixtures/customNode/typePairing'
import {
  customNodeSuiteSettings,
  dismissTemplatesDialog
} from '@e2e/fixtures/utils/customNodeSuite'

const CALIBRATION_PACKS = [
  'ComfyUI-Impact-Pack',
  'ComfyUI-VideoHelperSuite',
  'rgthree-comfy',
  'ComfyUI_essentials',
  'ComfyUI-KJNodes',
  'ComfyUI-Custom-Scripts',
  'was-node-suite-comfyui'
]
const SAMPLE_SIZE = 120
// Divisors of SAMPLE_SIZE so every size covers the identical node set.
const CHUNK_SIZES = [4, 8, 12, 24, 40, 60]
const REPEATS = 3
const GRID_SPACING = { x: 420, y: 360 }
const VISIBLE_TIMEOUT_MS = 500

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  await dismissTemplatesDialog(comfyPage)
})

test('batch-size calibration for all-nodes mount checks', async ({
  comfyPage
}) => {
  test.skip(
    process.env.CN_CALIBRATE !== '1',
    'calibration tool - set CN_CALIBRATE=1 and run against a pack-loaded backend'
  )
  test.setTimeout(1_800_000)

  const defs = (await comfyPage.page.evaluate(() =>
    window.app!.api.getNodeDefs()
  )) as unknown as Record<string, RawNodeDef>
  const packNodes = normalizeNodeDefs(defs)
    .filter((node) => CALIBRATION_PACKS.includes(node.pack))
    .sort((a, b) => a.type.localeCompare(b.type))

  // Round-robin across packs so the sample mixes heavy-JS nodes (rgthree,
  // pysssss) with bulk packs instead of alphabetically front-loading one pack.
  const byPack = new Map<string, string[]>()
  for (const node of packNodes) {
    const list = byPack.get(node.pack) ?? []
    list.push(node.type)
    byPack.set(node.pack, list)
  }
  const sample: string[] = []
  for (let i = 0; sample.length < SAMPLE_SIZE; i++) {
    let took = false
    for (const pack of CALIBRATION_PACKS) {
      const list = byPack.get(pack) ?? []
      if (i < list.length && sample.length < SAMPLE_SIZE) {
        sample.push(list[i])
        took = true
      }
    }
    if (!took) break
  }
  expect(sample, 'sample size').toHaveLength(SAMPLE_SIZE)

  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

  const results: Array<{
    size: number
    repeat: number
    msPerNode: number
    missing: string[]
  }> = []

  for (const size of CHUNK_SIZES) {
    for (let repeat = 0; repeat < REPEATS; repeat++) {
      const started = Date.now()
      const missing: string[] = []
      for (let offset = 0; offset < sample.length; offset += size) {
        const chunk = sample.slice(offset, offset + size)
        const ids = await comfyPage.page.evaluate(
          ([types, spacingX, spacingY]) => {
            window.app!.graph.clear()
            const cols = Math.ceil(Math.sqrt(types.length))
            const ids: Array<string | null> = []
            for (const [index, type] of types.entries()) {
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
            // Fit the whole grid into the viewport so an off-screen node is a
            // culling result we measure, not a guaranteed miss.
            const canvas = window.app!.canvas
            const rect = canvas.canvas.getBoundingClientRect()
            const width = cols * (spacingX as number)
            const height = Math.ceil(types.length / cols) * (spacingY as number)
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
          [chunk, GRID_SPACING.x, GRID_SPACING.y] as const
        )
        await comfyPage.nextFrame()
        for (const [index, id] of ids.entries()) {
          if (id === null) {
            missing.push(`${chunk[index]} (createNode null)`)
            continue
          }
          const visible = await comfyPage.page
            .locator(`[data-node-id="${id}"]`)
            .isVisible({ timeout: VISIBLE_TIMEOUT_MS })
            .catch(() => false)
          if (!visible) missing.push(chunk[index])
        }
      }
      const msPerNode = (Date.now() - started) / sample.length
      results.push({
        size,
        repeat,
        msPerNode: Math.round(msPerNode * 10) / 10,
        missing: missing.sort()
      })
      console.log(
        `CALIB size=${size} repeat=${repeat} msPerNode=${msPerNode.toFixed(1)} missing=${missing.length}`
      )
    }
  }

  // Determinism verdict per size: the missing-set must be identical across
  // repeats. Report everything; selection happens in the PR, from this data.
  for (const size of CHUNK_SIZES) {
    const runs = results.filter((result) => result.size === size)
    const signatures = new Set(runs.map((run) => run.missing.join('|')))
    const avg = runs.reduce((sum, run) => sum + run.msPerNode, 0) / runs.length
    console.log(
      `CALIB-SUMMARY size=${size} deterministic=${signatures.size === 1} avgMsPerNode=${avg.toFixed(1)} missing=${runs[0].missing.length}`
    )
  }
  console.log('CALIB-MISSING ' + JSON.stringify(results[0].missing))
  expect(results).toHaveLength(CHUNK_SIZES.length * REPEATS)
})
