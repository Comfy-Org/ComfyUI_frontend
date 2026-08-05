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
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { registry } from './stubs/registry.mjs'

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
export async function runPack({
  root,
  entries,
  types,
  category = 'harness',
  apiMajor = 1
}) {
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
      category,
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

    // Backend-derived nodes serialise their widgets, and without it the wire
    // comparison cannot see widget changes — precisely what these conversions
    // alter. Set on the instance because the class field shadows the prototype,
    // and only when unset so a pack's own choice still wins.
    node.serialize_widgets ??= true

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
