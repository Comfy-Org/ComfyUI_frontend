import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import { isPlainObject, once } from 'es-toolkit'

import { isNodeCanonicalField } from '@/lib/litegraph/src/extensionPersistence'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type {
  ExecutionResult,
  NodeCreatedEvent
} from '@/platform/nodeApi/v4/types'
import type { DispatchContext, MethodInstaller } from './dispatchContext'

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
    const copy = once(() => {
      const copied = copyOfSaved<unknown>('onConfigured', data)
      return isPlainObject(copied) ? copied : NO_FIELDS
    })
    deliver(type, 'onConfigured', node, (callback, handle) =>
      callback(handle, copy())
    )
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
        const added = deliver(type, 'onSerialize', this, (callback, handle) =>
          savedFields(callback(handle))
        )
        for (const fields of added) Object.assign(serialized, fields)
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

  function savedFields(fields: unknown): Readonly<Record<string, unknown>> {
    if (fields === undefined) return NO_FIELDS
    if (!isPlainObject(fields)) {
      throw invalidArgument(
        'onSerialize',
        'an object of fields to save',
        fields
      )
    }
    const taken = Object.keys(fields).find(
      (field) => isNodeCanonicalField(field) || field === 'extensions'
    )
    if (taken !== undefined) {
      throw invalidArgument(
        'onSerialize',
        'fields the node does not save itself',
        taken
      )
    }
    return copyOfSaved('onSerialize', fields) ?? NO_FIELDS
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
