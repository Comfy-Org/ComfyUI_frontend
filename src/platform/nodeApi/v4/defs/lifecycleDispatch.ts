import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import { isPlainObject, once } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type {
  ExecutionResult,
  NodeCreatedEvent
} from '@/platform/nodeApi/v4/types'
import type { DispatchContext, MethodInstaller } from './dispatchContext'
import type { SavedEntryOf } from './nodeHooks'

const NO_FIELDS: Readonly<Record<string, unknown>> = Object.freeze({})

/** Delivers the hooks of a node's life: joining a graph, saved state, running, saving, resizing, leaving. */
export function createLifecycleDispatch({
  deliver,
  copyOfSaved,
  isInGraph,
  isMadeFromKnownClass
}: DispatchContext) {
  const configuredBeforeAdded = new WeakMap<LGraphNode, ISerialisedNode>()

  function deliverConfigured(
    type: string,
    node: LGraphNode,
    data: ISerialisedNode
  ) {
    const entryOf = savedEntries(data.extensions)
    deliver(type, 'onConfigured', node, (callback, handle) =>
      callback(handle, entryOf)
    )
  }

  function savedEntries(bucket: unknown): SavedEntryOf {
    const copies = new Map<string, Readonly<Record<string, unknown>>>()
    const copyOf = (key: string) => {
      const entry =
        isPlainObject(bucket) && Object.hasOwn(bucket, key)
          ? bucket[key]
          : undefined
      if (!isPlainObject(entry)) return undefined
      const copied = copies.get(key) ?? copyOfSaved('onConfigured', entry)
      if (copied) copies.set(key, copied)
      return copied
    }
    return ({ token, folderKey }) =>
      copyOf(token.id) ?? copyOf(folderKey) ?? NO_FIELDS
  }

  function nodeAdded(node: LGraphNode, loading: boolean): void {
    const saved = configuredBeforeAdded.get(node)
    configuredBeforeAdded.delete(node)
    if (!isMadeFromKnownClass(node)) return
    const event: NodeCreatedEvent = Object.freeze({
      restored: loading || saved !== undefined,
      loading
    })
    deliver(node.type, 'onCreated', node, (callback, handle) =>
      callback(handle, event)
    )
    if (saved) deliverConfigured(node.type, node, saved)
  }

  const installers: Record<string, MethodInstaller> = {
    onConfigure(target, type) {
      const previous = target.onConfigure
      target.onConfigure = function (data) {
        previous?.call(this, data)
        if (isInGraph(this)) deliverConfigured(type, this, data)
        else configuredBeforeAdded.set(this, data)
      }
    },
    onRemoved(target, type) {
      const previous = target.onRemoved
      target.onRemoved = function () {
        previous?.call(this)
        deliver(type, 'onRemoved', this, (callback, handle) => callback(handle))
      }
    },
    onExecuted(target, type) {
      const previous = target.onExecuted
      target.onExecuted = function (output) {
        previous?.call(this, output)
        const result = once(() =>
          executionResult(copyOfSaved('onExecuted', output))
        )
        deliver(type, 'onExecuted', this, (callback, handle) =>
          callback(handle, result())
        )
      }
    },
    onSerialize(target, type) {
      const previous = target.onSerialize
      target.onSerialize = function (serialized) {
        previous?.call(this, serialized)
        const saved = deliver(type, 'onSerialize', this, (callback, handle) => {
          const { pack, fields } = callback(handle)
          return { pack, fields: savedFields(fields) }
        })
        const entries = new Map<string, Record<string, unknown>>()
        for (const { pack, fields } of saved.flatMap((one) => one ?? [])) {
          if (fields) entries.set(pack, { ...entries.get(pack), ...fields })
        }
        if (entries.size === 0) return
        const bucket = isPlainObject(serialized.extensions)
          ? serialized.extensions
          : {}
        serialized.extensions = Object.assign(
          bucket,
          Object.fromEntries(entries)
        )
      }
    },
    onResize(target, type) {
      const previous = target.onResize
      target.onResize = function (size) {
        previous?.call(this, size)
        const [width, height] = size
        const frozen = Object.freeze({ width, height })
        deliver(type, 'onResized', this, (callback, handle) =>
          callback(handle, frozen)
        )
      }
    }
  }

  function savedFields(
    fields: unknown
  ): Readonly<Record<string, unknown>> | undefined {
    if (fields === undefined) return undefined
    if (!isPlainObject(fields)) {
      throw invalidArgument(
        'onSerialize',
        'an object of fields to save',
        fields
      )
    }
    return copyOfSaved('onSerialize', fields)
  }

  return { installers, nodeAdded }
}

function executionResult(raw: unknown): ExecutionResult {
  const fields = isPlainObject(raw) ? raw : NO_FIELDS
  const { text, images } = fields
  return Object.freeze({
    text: Array.isArray(text)
      ? Object.freeze(text.filter((line) => typeof line === 'string'))
      : Object.freeze([]),
    images: Array.isArray(images)
      ? Object.freeze(images.filter(isPlainObject))
      : Object.freeze([]),
    raw: fields
  })
}
