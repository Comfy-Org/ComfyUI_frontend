/**
 * Loads a whole pack — original or converted — and records what it did.
 *
 * Per-file checks cannot answer "does this pack still work". A conversion can
 * be locally correct and still break the pack: Crystools' change to
 * `displayContext`'s signature left three call sites in two sibling files
 * passing the old arguments, and every per-file check was green. Only loading
 * the pack together catches that.
 *
 * The two images are loaded in separate processes by the caller, because the
 * litegraph type registry and the module cache are both global and a second
 * load in the same process would see the first one's registrations.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { registry } from './stubs/registry.mjs'

/**
 * Node type names the pack cares about.
 *
 * Both images are driven over the same set, so a difference in the result is
 * attributable to the conversion. Derived from the source rather than from the
 * backend because the definitions are Python-side and not available here.
 */
export function candidateTypes(sources) {
  const found = new Set()
  const patterns = [
    // `nodeData.name === "X"`, `nodeData?.name == 'X'`
    /\.name\s*===?\s*["'`]([^"'`]+)["'`]/g,
    /["'`]([^"'`]+)["'`]\s*===?\s*\w*\.?name\b/g,
    // `case "X":` inside the usual switch on the type name
    /case\s+["'`]([^"'`]+)["'`]\s*:/g,
    // `comfy.defs.extend("X"` and the array form
    /defs\.extend\(\s*["'`]([^"'`]+)["'`]/g,
    /defs\.extend\(\s*\[([^\]]+)\]/g,
    // `["A","B"].includes(nodeData.name)`
    /\[([^\]]+)\]\s*\.includes\(\s*\w+\.name/g
  ]
  for (const source of sources) {
    for (const pattern of patterns) {
      for (const [, captured] of source.matchAll(pattern)) {
        for (const piece of captured.split(',')) {
          const name = piece.trim().replace(/^["'`]|["'`]$/g, '')
          // Type names are not empty, not sentences, not paths.
          if (name && name.length < 80 && !/[\s/\\]{2,}/.test(name)) {
            found.add(name)
          }
        }
      }
    }
  }
  return [...found].sort()
}

/** Writes a pack image to disk so relative imports between files resolve. */
export function materialise(root, files) {
  for (const [relative, source] of Object.entries(files)) {
    const target = join(root, relative)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, source)
  }
  return root
}

const SYNTHETIC_MESSAGE = { text: ['harness'], images: [] }

/**
 * Loads every entry file, drives the registered extensions over `types`, and
 * reports what survived.
 */
export async function runPack({ root, entries, types, apiMajor = 1 }) {
  register('./loader.mjs', import.meta.url)
  registry.reset()

  const loadErrors = []
  for (const entry of entries) {
    try {
      await import(pathToFileURL(join(root, entry)).href)
    } catch (error) {
      loadErrors.push(`${entry}: ${error?.message ?? error}`)
    }
  }

  const { applyDefExtensions } = await import('@/platform/nodeApi/comfyApi')
  const { LGraphNode } = await import('@/lib/litegraph/src/litegraph')

  const registered = []
  const constructed = {}
  const wire = {}
  const driveErrors = []

  for (const type of types) {
    const def = {
      name: type,
      display_name: type,
      category: 'harness',
      python_module: 'custom_nodes.harness',
      output: [],
      output_name: [],
      input: { required: {} }
    }

    class Generated extends LGraphNode {
      constructor() {
        super(type)
      }
    }
    Generated.comfyClass = type
    Generated.prototype.comfyClass = type

    // Both paths run: an unconverted sibling still uses the legacy hook, and a
    // converted one uses the registry. A pack mid-migration has both.
    for (const extension of registry.extensions) {
      try {
        await extension.beforeRegisterNodeDef?.(Generated, def, {
          graph: registry.graph
        })
      } catch (error) {
        driveErrors.push(`beforeRegisterNodeDef:${type}: ${error?.message}`)
      }
    }
    try {
      applyDefExtensions(Generated, def)
    } catch (error) {
      driveErrors.push(`defs.extend:${type}: ${error?.message}`)
    }

    LiteGraph.registerNodeType(type, Generated)
    registered.push(type)

    let node = null
    try {
      node = LiteGraph.createNode(type)
    } catch (error) {
      driveErrors.push(`construct:${type}: ${error?.message}`)
    }
    constructed[type] = Boolean(node)
    if (!node) continue

    registry.graph.add(node)
    try {
      node.onExecuted?.(SYNTHETIC_MESSAGE)
    } catch (error) {
      driveErrors.push(`onExecuted:${type}: ${error?.message}`)
    }
    try {
      wire[type] = JSON.stringify(node.serialize())
    } catch (error) {
      driveErrors.push(`serialize:${type}: ${error?.message}`)
    }
  }

  return {
    loaded: loadErrors.length === 0,
    loadErrors,
    driveErrors,
    registered,
    constructed,
    wire,
    apiMajor
  }
}
