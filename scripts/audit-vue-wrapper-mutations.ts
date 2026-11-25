import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { isDeepStrictEqual, promisify } from 'node:util'

import { createServer, normalizePath } from 'vite'
import { z } from 'zod'

const execFile = promisify(execFileCallback)
const playwrightCli = createRequire(import.meta.url).resolve(
  '@playwright/test/cli'
)
const box = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  })
  .nullable()
const captureSchema = z.object({
  elements: z.number().int().positive(),
  node: box,
  modelSocket: box,
  accessibility: z.string(),
  screenshotDifference: z.number().min(0).max(1),
  editSlot: z.boolean(),
  collapse: z.boolean()
})
const root = 'src/renderer/extensions/vueNodes'
const fieldLabel = `${root}/widgets/components/layout/WidgetLayoutFieldLabel.vue`
const header = `${root}/components/NodeHeader.vue`
const inputSlot = `${root}/components/InputSlot.vue`

const historicLabel = {
  file: fieldLabel,
  from: `    data-testid="widget-layout-field-label"
  >
    {{ label }}`,
  to: `  >
    <span data-testid="widget-layout-field-label" class="block truncate">
      {{ label }}
    </span>`
}

const arms = [
  { name: 'baseline', edits: [historicLabel] },
  { name: 'repeat', edits: [historicLabel] },
  { name: 'known-good-label', edits: [] },
  {
    name: 'known-bad-collapse',
    edits: [
      historicLabel,
      {
        file: header,
        from: 'data-part="node-collapse-button"',
        to: 'data-part="node-collapse-button" v-if="false"'
      }
    ]
  },
  {
    name: 'candidate-input-slot',
    edits: [
      historicLabel,
      {
        file: inputSlot,
        from: `    <div
      v-if="!effectiveDotOnly"
      class="flex h-full min-w-0 items-center"
      data-part="slot-label"
    >
      <EditableText
        class="min-w-0"`,
        to: `    <EditableText
        v-if="!effectiveDotOnly"
        class="h-full min-w-0 content-center"
        data-part="slot-label"`
      },
      { file: inputSlot, from: '      />\n    </div>', to: '    />' }
    ]
  }
]

const backend = process.env.PLAYWRIGHT_SETUP_API_URL ?? 'http://127.0.0.1:8188'
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(backend).hostname))
  throw new Error('Use a disposable local ComfyUI E2E backend')
Object.assign(process.env, {
  DEV_SERVER_COMFYUI_URL: backend,
  DISTRIBUTION: 'localhost',
  DISABLE_VUE_PLUGINS: 'true',
  VITE_USE_LEGACY_DEFAULT_GRAPH: 'true'
})

const outputRoot = resolve('.amp/in/orb-backup')
await mkdir(outputRoot, { recursive: true })
const output = await mkdtemp(`${outputRoot}/vue-wrapper-pilot-`)
console.log(`Captures: ${output}`)
const cacheDir = `${output}/vite-cache`
const measureLayout = process.argv.includes('--layout')
const screenshotTolerance = 0.0005
const results: Awaited<ReturnType<typeof compare>>[] = []

async function capture({ name, edits }: (typeof arms)[number]) {
  const sources = new Map<string, string>()
  for (const { file, from, to } of edits) {
    const id = normalizePath(resolve(file))
    const source = sources.get(id) ?? (await readFile(id, 'utf8'))
    if (source.split(from).length !== 2)
      throw new Error(`${name}: expected one source match in ${file}`)
    sources.set(id, source.replace(from, to))
  }

  const transformed = new Set<string>()
  const server = await createServer({
    cacheDir,
    server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [
      {
        name: 'vue-wrapper-mutation-pilot',
        enforce: 'pre',
        transform(_, id) {
          const source = sources.get(id)
          if (source === undefined) return
          transformed.add(id)
          return source
        }
      }
    ]
  })
  try {
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string')
      throw new Error('Vite did not listen on a TCP port')
    const capturePath = `${output}/${name}`
    const { stdout } = await execFile(
      process.execPath,
      [
        playwrightCli,
        'test',
        '--project=chromium',
        '--workers=1',
        '--retries=0',
        '--reporter=line',
        `--output=${capturePath}-playwright`,
        'vueWrapperPilot.spec.ts'
      ],
      {
        env: {
          ...process.env,
          PLAYWRIGHT_LOCAL: '1',
          PLAYWRIGHT_SETUP_API_URL: backend,
          PLAYWRIGHT_TEST_URL: `http://127.0.0.1:${address.port}`,
          VUE_WRAPPER_PILOT_CAPTURE: capturePath,
          VUE_WRAPPER_PILOT_LAYOUT:
            measureLayout && name !== 'known-bad-collapse' ? '1' : '',
          VUE_WRAPPER_PILOT_BASELINE:
            name === 'baseline' ? '' : `${output}/baseline.png`
        }
      }
    ).catch((error: unknown) => {
      throw new Error(`${name}: Chromium fixture failed before comparison`, {
        cause: error
      })
    })
    for (const line of stdout.split('\n')) {
      if (line.startsWith('Layout diagnostic:')) console.log(`${name}: ${line}`)
    }
    if (transformed.size !== sources.size)
      throw new Error(`${name}: not all mutated components were compiled`)
    return captureSchema.parse(
      JSON.parse(await readFile(`${capturePath}.json`, 'utf8'))
    )
  } finally {
    await server.close()
  }
}

const [baseline, repeat, good, bad, candidate] = arms
async function compare(
  arm: (typeof arms)[number],
  reference: z.infer<typeof captureSchema>
) {
  const actual = await capture(arm)
  const { elements, screenshotDifference, ...observed } = actual
  const expected = new Map(Object.entries(reference))
  const changes = Object.entries(observed)
    .filter(([key, value]) => !isDeepStrictEqual(value, expected.get(key)))
    .map(([key]) => key)
  if (screenshotDifference > screenshotTolerance) changes.push('screenshot')
  const delta = elements - reference.elements
  const status = changes.length
    ? 'changed'
    : delta < 0
      ? 'survived'
      : delta === 0
        ? 'matched'
        : 'added-elements'
  const verdict = changes.length
    ? `changed ${changes.join(', ')}`
    : delta < 0
      ? 'survived these checks'
      : delta === 0
        ? 'matched baseline'
        : 'added elements'
  console.log(
    `${arm.name}: ${reference.elements} → ${elements}; ${verdict}; ${(screenshotDifference * 100).toFixed(3)}% pixels changed`
  )
  return {
    name: arm.name,
    status,
    baselineElements: reference.elements,
    elements,
    delta,
    changes,
    screenshotDifference,
    capture: `${arm.name}.json`,
    screenshot: `${arm.name}.png`,
    layout: measureLayout && arm !== bad ? `${arm.name}-layout.json` : null
  }
}

let status = 'incomplete'
let errorMessage: string | null = null
try {
  const reference = await capture(baseline)
  const noise = await compare(repeat, reference)
  results.push(noise)
  if (noise.delta || noise.changes.length)
    throw new Error(
      'Baseline repeat drifted; mutation results would be inconclusive'
    )
  if (!reference.collapse || !reference.editSlot)
    throw new Error('Baseline did not exercise both interactions')

  const positive = await compare(good, reference)
  results.push(positive)
  const negative = await compare(bad, reference)
  results.push(negative, await compare(candidate, reference))
  if (positive.delta >= 0 || positive.changes.length)
    throw new Error('Known-good control did not survive with fewer elements')
  if (negative.delta >= 0 || !negative.changes.includes('collapse'))
    throw new Error('Known-bad control was not rejected by the collapse check')
  status = 'completed'
} catch (error) {
  errorMessage = error instanceof Error ? error.message : String(error)
  throw error
} finally {
  await rm(cacheDir, { recursive: true, force: true })
  const report = `${output}/report.json`
  await writeFile(
    report,
    JSON.stringify(
      {
        schemaVersion: 1,
        status,
        error: errorMessage,
        screenshotTolerance,
        baseline: {
          capture: 'baseline.json',
          screenshot: 'baseline.png',
          layout: measureLayout ? 'baseline-layout.json' : null
        },
        results
      },
      null,
      2
    ) + '\n'
  )
  console.log(`JSON report: ${report}`)
}
