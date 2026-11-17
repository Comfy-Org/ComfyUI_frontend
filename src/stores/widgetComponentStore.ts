import { isPlainObject } from 'es-toolkit'
import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'
import type { z } from 'zod'

import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import { parseWidgetId, widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { UUID } from '@/utils/uuid'

export function defineWidgetComponentStore<
  const Id extends string,
  T extends object
>(definition: {
  id: Id
  wireKey: string
  schema: z.ZodType<T>
  encode: (component: T) => NodeProperty
}) {
  return defineStore(definition.id, () => {
    const components = shallowReactive(new Map<WidgetId, T>())

    function get(id: WidgetId): Readonly<T> | undefined {
      return components.get(id)
    }

    function set(id: WidgetId, component: T | undefined): void {
      if (component === undefined) components.delete(id)
      else components.set(id, structuredClone(component))
    }

    function move(previous: WidgetId, next: WidgetId): void {
      const component = components.get(previous)
      components.delete(previous)
      components.delete(next)
      if (component) components.set(next, component)
    }

    function clearNode(graphId: UUID, nodeId: NodeId): void {
      for (const id of components.keys()) {
        const owner = parseWidgetId(id)
        if (
          owner.graphId === graphId &&
          String(owner.nodeId) === String(nodeId)
        )
          components.delete(id)
      }
    }

    function clearGraph(graphId: UUID): void {
      for (const id of components.keys()) {
        if (parseWidgetId(id).graphId === graphId) components.delete(id)
      }
    }

    function writeNode(
      graphId: UUID,
      nodeId: NodeId,
      properties: Record<string, NodeProperty | undefined>
    ): void {
      const entries = [...components].flatMap(([id, component]) => {
        const owner = parseWidgetId(id)
        return owner.graphId === graphId &&
          String(owner.nodeId) === String(nodeId)
          ? [[owner.name, definition.encode(component)] as const]
          : []
      })
      if (entries.length)
        properties[definition.wireKey] = Object.fromEntries(entries)
      else delete properties[definition.wireKey]
    }

    function adoptNode(
      graphId: UUID,
      nodeId: NodeId,
      properties: Record<string, NodeProperty | undefined>
    ): void {
      const saved = properties[definition.wireKey]
      delete properties[definition.wireKey]
      clearNode(graphId, nodeId)
      if (!isPlainObject(saved)) return
      for (const [name, raw] of Object.entries(saved)) {
        const parsed = definition.schema.safeParse(raw)
        if (parsed.success) set(widgetId(graphId, nodeId, name), parsed.data)
      }
    }

    return { get, set, move, clearNode, clearGraph, writeNode, adoptNode }
  })
}
