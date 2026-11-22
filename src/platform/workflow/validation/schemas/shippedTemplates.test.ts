import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

const TEMPLATES_DIR = process.env.COMFYUI_TEMPLATES_DIR

const NON_WORKFLOW_ASSETS = new Set([
  'fuse_options.json',
  'index_logo.json',
  'index.schema.json'
])

interface KnownUnloadable {
  reason: string
  matches: RegExp
}

const KNOWN_UNLOADABLE: Record<string, KnownUnloadable> = {
  'image_fibo2_edit_dev_pe.json': {
    reason: 'outputs[].slot_index is null',
    matches: /received null at "nodes\[\d+\]\.outputs\[\d+\]\.slot_index"/
  },
  'image_fibo2_edit_turbo_pe.json': {
    reason: 'outputs[].slot_index is null',
    matches: /received null at "nodes\[\d+\]\.outputs\[\d+\]\.slot_index"/
  },
  'api_heygen_avatar_6_id2v.json': {
    reason: 'outputs[].slot_index is null',
    matches: /received null at "nodes\[\d+\]\.outputs\[\d+\]\.slot_index"/
  },
  'video_pika_h3_flex_fl2va.json': {
    reason: 'workflow id is a slug, not a GUID',
    matches: /Invalid GUID at "id"/
  },
  'image_joyai_image_edit.json': {
    reason: 'definitions.subgraphs[].inputs[].id are names, not GUIDs',
    matches:
      /Invalid GUID at "definitions\.subgraphs\[\d+\]\.(inputs|outputs)\[\d+\]\.id"/
  }
}

function isWorkflowAsset(file: string): boolean {
  return (
    file.endsWith('.json') &&
    !file.startsWith('index.') &&
    file !== 'index.json' &&
    !NON_WORKFLOW_ASSETS.has(file)
  )
}

interface ShippedTemplate {
  file: string
  graph: Record<string, unknown>
}

interface Corpus {
  templates: ShippedTemplate[]
  unreadable: string[]
}

function readCorpus(dir: string): Corpus {
  const templates: ShippedTemplate[] = []
  const unreadable: string[] = []
  for (const file of fs.readdirSync(dir).sort()) {
    if (!isWorkflowAsset(file)) continue
    let graph: unknown
    try {
      graph = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      unreadable.push(`${file}: ${message}`)
      continue
    }
    if (
      typeof graph !== 'object' ||
      graph === null ||
      !Array.isArray((graph as { nodes?: unknown }).nodes)
    ) {
      unreadable.push(`${file}: no node list`)
      continue
    }
    templates.push({ file, graph: graph as Record<string, unknown> })
  }
  return { templates, unreadable }
}

async function validationError(
  graph: Record<string, unknown>
): Promise<string | null> {
  let error = ''
  const validated = await validateComfyWorkflow(graph, (detail) => {
    error = detail
  })
  return validated ? null : error || 'rejected with no detail'
}

describe.skipIf(!TEMPLATES_DIR)('shipped workflow templates', () => {
  let corpus: Corpus

  beforeAll(() => {
    corpus = readCorpus(TEMPLATES_DIR!)
  })

  it('finds more than 100 templates, so a wrong COMFYUI_TEMPLATES_DIR cannot pass vacuously', () => {
    expect(corpus.templates.length).toBeGreaterThan(100)
  })

  it('every file that looks like a template is readable as a graph', () => {
    expect(
      corpus.unreadable,
      'a malformed template would otherwise be dropped silently instead of failing'
    ).toEqual([])
  })

  it(
    'every shipped template is strictly loadable',
    { timeout: 120_000 },
    async () => {
      const failures: string[] = []
      for (const { file, graph } of corpus.templates) {
        if (file in KNOWN_UNLOADABLE) continue
        const error = await validationError(graph)
        if (error)
          failures.push(
            `${file} (saved by ${savedBy(graph)}): ${firstLine(error)}`
          )
      }
      expect(
        failures,
        'fix the template or list it in KNOWN_UNLOADABLE'
      ).toEqual([])
    }
  )

  it('no entry in the known-unloadable list has been fixed, or started failing for a new reason', async () => {
    const present = new Set(corpus.templates.map(({ file }) => file))
    const stale: string[] = []
    for (const [file, { reason, matches }] of Object.entries(
      KNOWN_UNLOADABLE
    )) {
      if (!present.has(file)) {
        stale.push(`${file} is no longer shipped (${reason})`)
        continue
      }
      const graph = corpus.templates.find((entry) => entry.file === file)!.graph
      const error = await validationError(graph)
      if (!error) {
        stale.push(`${file} now validates (${reason})`)
      } else if (!matches.test(error)) {
        stale.push(
          `${file} no longer fails for the recorded reason (${reason}); it now fails with: ${firstLine(error)}`
        )
      }
    }
    expect(
      stale,
      'remove fixed entries from KNOWN_UNLOADABLE, or update the recorded reason if a new regression is layered on top'
    ).toEqual([])
  })
})

function savedBy(graph: Record<string, unknown>): string {
  const extra = graph.extra
  if (typeof extra === 'object' && extra !== null) {
    const version = (extra as { frontendVersion?: unknown }).frontendVersion
    if (typeof version === 'string') return version
  }
  return 'unknown frontend version'
}

function firstLine(error: string): string {
  return error.split('\n').slice(0, 2).join(' ').slice(0, 220)
}
