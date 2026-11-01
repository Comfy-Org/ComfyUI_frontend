/**
 * Every workflow template we ship has to be strictly loadable.
 *
 * `useTemplateWorkflows` validates a template against `validateComfyWorkflow`
 * and, when that fails, falls back to `zLegacyLoadableWorkflow` and loads the
 * template anyway with `strict: false`, reporting
 * `error_validating_workflow_template_schema` at warning level. So a template
 * this schema rejects does not look broken: it opens, it reports a warning
 * nobody reads, and it skips whatever the strict path guarantees downstream.
 *
 * Nothing checked that before this. The templates repo validates its own
 * `index.json` and the JSON syntax of each file, and ComfyUI checks the node
 * graph against its node registry, but neither of them knows what this
 * schema considers a loadable workflow. A hand-edited template with a slug
 * where a GUID belongs passes both and fails here.
 *
 * The corpus is the real thing: the `comfyui-workflow-templates` release that
 * ships alongside ComfyUI, which is ~650 workflows saved by about thirty
 * different frontend releases (1.27 through 1.58 at the time of writing), so
 * it doubles as the format-migration coverage we otherwise have none of.
 *
 * Point `COMFYUI_TEMPLATES_DIR` at the installed package's `templates`
 * directory to run it. `.github/workflows/ci-shipped-templates.yaml` installs
 * the version ComfyUI pins and sets it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

const TEMPLATES_DIR = process.env.COMFYUI_TEMPLATES_DIR

/** The package ships its index, schema and lookup tables beside the workflows. */
const NON_WORKFLOW_ASSETS = new Set([
  'fuse_options.json',
  'index_logo.json',
  'index.schema.json'
])

/**
 * Templates this schema rejects today, with why. Each one loads through the
 * legacy fallback, so this is a defect list rather than an exemption: fix the
 * template in Comfy-Org/workflow_templates and delete the entry. The test
 * fails if one of these starts passing, so a fix cannot leave a stale entry
 * behind, and it fails if anything else starts failing.
 */
const KNOWN_UNLOADABLE: Record<string, string> = {
  // Every output slot carries an explicit `slot_index: null` (along with null
  // color_off, color_on, dir, label, locked, nameLocked, removable and pos).
  // The schema takes a number or a string there, not null.
  'image_fibo2_edit_dev_pe.json': 'outputs[].slot_index is null',
  'image_fibo2_edit_turbo_pe.json': 'outputs[].slot_index is null',
  // Hand-authored ids: the workflow id is the slug "pika-h3-flex-fl2va", and
  // the subgraph input ids are names like "image1" and "prompt". The schema
  // requires GUIDs, which is what a real save writes.
  'video_pika_h3_flex_fl2va.json': 'workflow id is a slug, not a GUID',
  'image_joyai_image_edit.json':
    'definitions.subgraphs[].inputs[].id are names, not GUIDs'
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
  /** Files that look like a template but could not be read as a graph. */
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
      unreadable.push(`${file}: ${(error as Error).message}`)
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
  // Read in a hook, not at module scope: a missing or wrong directory has to
  // surface as a failed assertion naming the path, not as a collection error
  // that reports "no tests" and reads like a skip.
  let corpus: Corpus

  beforeAll(() => {
    corpus = readCorpus(TEMPLATES_DIR!)
  })

  it('found the shipped corpus', () => {
    // A wrong COMFYUI_TEMPLATES_DIR would otherwise make every assertion
    // below vacuous: an empty corpus passes them all.
    expect(corpus.templates.length).toBeGreaterThan(100)
  })

  it('every file that looks like a template is readable as a graph', () => {
    // A template that is not JSON, or has no node list, is malformed rather
    // than out of scope. Dropping it quietly would hide it from the checks.
    expect(corpus.unreadable).toEqual([])
  })

  it('every shipped template is strictly loadable', async () => {
    const failures: string[] = []
    for (const { file, graph } of corpus.templates) {
      if (file in KNOWN_UNLOADABLE) continue
      const error = await validationError(graph)
      if (error)
        failures.push(
          `${file} (saved by ${savedBy(graph)}): ${firstLine(error)}`
        )
    }
    // Anything listed here loads through the legacy fallback instead of the
    // strict schema, reporting error_validating_workflow_template_schema on
    // every open. Fix the template, or add it to KNOWN_UNLOADABLE with why.
    expect(failures).toEqual([])
  })

  it('no entry in the known-unloadable list has been fixed', async () => {
    const present = new Set(corpus.templates.map(({ file }) => file))
    const stale: string[] = []
    for (const [file, reason] of Object.entries(KNOWN_UNLOADABLE)) {
      if (!present.has(file)) {
        stale.push(`${file} is no longer shipped (${reason})`)
        continue
      }
      const graph = corpus.templates.find((entry) => entry.file === file)!.graph
      if (!(await validationError(graph)))
        stale.push(`${file} now validates (${reason})`)
    }
    // Remove these from KNOWN_UNLOADABLE, so that a later regression in the
    // same template is caught again instead of staying excused.
    expect(stale).toEqual([])
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
