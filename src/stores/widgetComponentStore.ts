import { isPlainObject } from 'es-toolkit'
import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'
import type { z } from 'zod'

import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import {
  isWidgetId,
  isWidgetNameUnreadable,
  parseWidgetId,
  widgetId
} from '@comfyorg/graph-model/widgetId'
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
    const components = shallowReactive(
      new Map<UUID, Map<string, Map<WidgetId, T>>>()
    )

    function get(id: WidgetId): Readonly<T> | undefined {
      const { graphId, nodeId } = parseWidgetId(id)
      return components.get(graphId)?.get(String(nodeId))?.get(id)
    }

    function set(id: WidgetId, component: T | undefined): void {
      const { graphId, nodeId } = parseWidgetId(id)
      const key = String(nodeId)
      let nodes = components.get(graphId)
      let widgets = nodes?.get(key)
      if (component === undefined) {
        widgets?.delete(id)
        if (!widgets?.size) nodes?.delete(key)
        if (!nodes?.size) components.delete(graphId)
        return
      }
      if (!nodes) {
        nodes = shallowReactive(new Map<string, Map<WidgetId, T>>())
        components.set(graphId, nodes)
      }
      if (!widgets) {
        widgets = shallowReactive(new Map<WidgetId, T>())
        nodes.set(key, widgets)
      }
      widgets.set(id, structuredClone(component))
    }

    function move(previous: WidgetId, next: WidgetId): void {
      const { graphId, nodeId } = parseWidgetId(previous)
      const component = components
        .get(graphId)
        ?.get(String(nodeId))
        ?.get(previous)
      set(previous, undefined)
      set(next, component)
    }

    function clearNode(graphId: UUID, nodeId: NodeId): void {
      const nodes = components.get(graphId)
      nodes?.delete(String(nodeId))
      if (!nodes?.size) components.delete(graphId)
    }

    function clearGraph(graphId: UUID): void {
      components.delete(graphId)
    }

    function writeNode(
      graphId: UUID,
      nodeId: NodeId,
      properties: Record<string, NodeProperty | undefined>
    ): void {
      const widgets = components.get(graphId)?.get(String(nodeId))
      const entries = [...(widgets ?? [])].map(([id, component]) => [
        parseWidgetId(id).name,
        definition.encode(component)
      ])
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
        if (!parsed.success || isWidgetNameUnreadable({ name })) continue
        const id = widgetId(graphId, nodeId, name)
        if (isWidgetId(id)) set(id, parsed.data)
      }
    }

    return {
      wireKey: definition.wireKey,
      get,
      set,
      move,
      clearNode,
      clearGraph,
      writeNode,
      adoptNode
    }
  })
}
