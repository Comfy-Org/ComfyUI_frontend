/**
 * Shared v2 test runtime — replaces inline `createTestRuntime` /
 * `createV2Runtime` blocks copy-pasted into BC test files.
 *
 * The runtime mirrors the real `defineNodeExtension` /
 * `mountExtensionsForNode` contract without the ECS world dependency,
 * so Phase A tests can exercise extension shape + dispatch ordering
 * without standing up the full service.
 *
 * @example
 *   import { createV2Runtime } from './harness/v2Runtime'
 *
 *   const rt = createV2Runtime()
 *   rt.register({ name: 'demo.created', nodeCreated() {} })
 *   const id = rt.addNode('KSampler')
 *   rt.mountNode(id)
 */
import type { NodeExtensionOptions } from '@/extension-api/lifecycle'
import type { NodeHandle } from '@/extension-api/node'
import type { NodeEntityId } from '@/world/entityIds'

interface NodeRecord {
  id: NodeEntityId
  comfyClass: string
}

interface V2Runtime {
  register: (options: NodeExtensionOptions) => void
  addNode: (comfyClass: string) => NodeEntityId
  mountNode: (id: NodeEntityId, isLoaded?: boolean) => void
  clear: () => void
}

interface V2RuntimeOptions {
  /** Prefix for synthetic entity ids — defaults to `'graph-test'`. */
  idPrefix?: string
}

/**
 * Build a minimal in-memory v2 runtime with deterministic id allocation
 * and lexicographic extension ordering (D10b tie-break).
 */
export function createV2Runtime(options: V2RuntimeOptions = {}): V2Runtime {
  const idPrefix = options.idPrefix ?? 'graph-test'
  const extensions: NodeExtensionOptions[] = []
  const nodes = new Map<NodeEntityId, NodeRecord>()
  let nextId = 1

  function makeNodeId(): NodeEntityId {
    return `node:${idPrefix}:${nextId++}` as NodeEntityId
  }

  function addNode(comfyClass: string): NodeEntityId {
    const id = makeNodeId()
    nodes.set(id, { id: id, comfyClass })
    return id
  }

  function createHandle(record: NodeRecord): NodeHandle {
    // Minimal NodeHandle stub — only the fields BC tests touch are real.
    const widgets: Array<{ name: string; id: string }> = []
    // widgetCounter removed alongside addWidget/addDOMWidget mocks
    // per D-ban-runtime-addwidget (wave-10).

    return {
      id: record.id as unknown as string,
      equals(other: NodeHandle): boolean {
        return this.id === other.id
      },
      get type() {
        return record.comfyClass
      },
      get comfyClass() {
        return record.comfyClass
      },
      getPosition: () => [0, 0],
      getSize: () => [0, 0],
      getTitle: () => record.comfyClass,
      setTitle: () => {},
      getMode: () => 0,
      setMode: () => {},
      getProperty: () => undefined,
      getProperties: () => ({}),
      setProperty: () => {},
      widget: (name: string) => widgets.find((w) => w.name === name),
      widgets: () => widgets,
      // REMOVED per AXIOMS.md A15 and
      // decisions/D-ban-runtime-addwidget.md — v2 NodeHandle does not
      // expose addWidget / addDOMWidget. These mocks would mask the
      // absence of the public surface in harness-backed tests.
      // addWidget: (_type, name, _defaultValue) => { … }
      // addDOMWidget: (opts) => { … }
      inputs: () => [],
      outputs: () => [],
      on: () => () => {}
    } as unknown as NodeHandle
  }

  function register(opts: NodeExtensionOptions) {
    extensions.push(opts)
  }

  function mountNode(id: NodeEntityId, isLoaded = false): void {
    const record = nodes.get(id)
    if (!record) return

    const sorted = [...extensions].sort((a, b) => a.name.localeCompare(b.name))
    for (const ext of sorted) {
      if (ext.nodeTypes && !ext.nodeTypes.includes(record.comfyClass)) {
        continue
      }
      const hook = isLoaded ? ext.loadedGraphNode : ext.nodeCreated
      if (!hook) continue
      hook(createHandle(record))
    }
  }

  function clear() {
    extensions.length = 0
    nodes.clear()
    nextId = 1
  }

  return { register, addNode, mountNode, clear }
}
