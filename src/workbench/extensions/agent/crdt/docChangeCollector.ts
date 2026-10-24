import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import { definitionsObserverRoot } from './agentSubgraphDefinitions'
import type { FrameChanges, NodeChange } from './liveGraphApplier'
import { SYNCED_NODE_FIELDS } from './liveGraphApplier'

/**
 * Collects what the Y observers on one follower document report between two
 * `take()` calls, in the shape the applier consumes. Observers fire
 * synchronously inside `applyRemoteUpdate`, so the frame that delivered an
 * update sees exactly that update's changes. Changes stay collected until a
 * graph is there to take them, so a frame delivered before the graph loads is
 * applied once it does.
 */
export class DocChangeCollector {
  private readonly nodes = new Map<string, NodeChange>()
  private readonly widgets = new Map<string, Set<string> | 'all'>()
  private readonly resyncNodes = new Set<string>()
  private readonly links = new Set<string>()
  private readonly interiors = new Map<
    string,
    Map<string, Set<string> | 'all'>
  >()
  private readonly interiorDefinitions = new Set<string>()
  private readonly removedGroups = new Set<string>()
  private readonly nodesMap: Y.Map<Y.Map<unknown>>
  private readonly linksMap: Y.Map<unknown>
  private readonly definitionsMap: Y.Map<unknown>
  private readonly metaMap: Y.Map<unknown>

  constructor(doc: Y.Doc) {
    this.nodesMap = nodesMap(doc)
    this.linksMap = linksMap(doc)
    this.definitionsMap = definitionsObserverRoot(doc)
    this.metaMap = doc.getMap('meta')
    this.nodesMap.observeDeep(this.onNodesChanged)
    this.linksMap.observe(this.onLinksChanged)
    this.definitionsMap.observeDeep(this.onDefinitionsChanged)
    this.metaMap.observe(this.onMetaChanged)
  }

  /** Returns everything collected so far without clearing it. */
  peek(): FrameChanges {
    return {
      nodes: new Map(this.nodes),
      widgets: new Map(this.widgets),
      resyncNodes: new Set(this.resyncNodes),
      links: new Set(this.links),
      interiors: new Map(
        [...this.interiors].map(([definitionId, nodes]) => [
          definitionId,
          new Map(nodes)
        ])
      ),
      interiorDefinitions: new Set(this.interiorDefinitions),
      removedGroups: new Set(this.removedGroups)
    }
  }

  /** Returns and clears everything collected so far. */
  take(): FrameChanges {
    const changes = this.peek()
    this.discard()
    return changes
  }

  discard(): void {
    this.nodes.clear()
    this.widgets.clear()
    this.resyncNodes.clear()
    this.links.clear()
    this.interiors.clear()
    this.interiorDefinitions.clear()
    this.removedGroups.clear()
  }

  destroy(): void {
    this.nodesMap.unobserveDeep(this.onNodesChanged)
    this.linksMap.unobserve(this.onLinksChanged)
    this.definitionsMap.unobserveDeep(this.onDefinitionsChanged)
    this.metaMap.unobserve(this.onMetaChanged)
    this.discard()
  }

  private markInterior(
    definitionId: string,
    nodeId: string,
    names: ReadonlySet<string> | 'all'
  ): void {
    let nodes = this.interiors.get(definitionId)
    if (!nodes) {
      nodes = new Map()
      this.interiors.set(definitionId, nodes)
    }
    if (names === 'all') {
      if (nodes.get(nodeId) === undefined) nodes.set(nodeId, 'all')
      return
    }
    const current = nodes.get(nodeId)
    const merged = current === 'all' || !current ? new Set<string>() : current
    for (const name of names) merged.add(name)
    nodes.set(nodeId, merged)
  }

  private readonly onDefinitionsChanged = (
    events: Y.YEvent<Y.AbstractType<unknown>>[]
  ): void => {
    for (const event of events) this.collectDefinitionEvent(event)
  }

  private collectDefinitionEvent(
    event: Y.YEvent<Y.AbstractType<unknown>>
  ): void {
    const path = event.path.map(String)
    const nodesIndex = path.lastIndexOf('nodes')
    if (nodesIndex >= 1 && path.length > nodesIndex + 1) {
      this.collectInteriorEvent(event, path, nodesIndex)
      return
    }
    this.collectDefinitionResync(event, path)
  }

  private collectInteriorEvent(
    event: Y.YEvent<Y.AbstractType<unknown>>,
    path: string[],
    nodesIndex: number
  ): void {
    const definitionId = path[nodesIndex - 1]
    const nodeId = path[nodesIndex + 1]
    const tail = path[nodesIndex + 2]
    if (tail === 'widgets' && event instanceof Y.YMapEvent) {
      this.markInterior(definitionId, nodeId, new Set(event.keysChanged))
      return
    }
    this.markInterior(definitionId, nodeId, 'all')
  }

  private collectDefinitionResync(
    event: Y.YEvent<Y.AbstractType<unknown>>,
    path: string[]
  ): void {
    const subgraphsIndex = path.lastIndexOf('subgraphs')
    const definitionId =
      subgraphsIndex >= 0 && path.length > subgraphsIndex + 1
        ? path[subgraphsIndex + 1]
        : path[0]
    if (definitionId) this.interiorDefinitions.add(definitionId)
    if (event.target === this.definitionsMap && event instanceof Y.YMapEvent) {
      for (const id of event.keysChanged) this.interiorDefinitions.add(id)
    }
  }

  private readonly onNodesChanged = (
    events: Y.YEvent<Y.AbstractType<unknown>>[]
  ): void => {
    for (const event of events) {
      if (event instanceof Y.YArrayEvent) this.onOpaqueWidgetsChanged(event)
      else if (event instanceof Y.YMapEvent) this.onNodeMapChanged(event)
    }
  }

  private onNodeMapChanged(event: Y.YMapEvent<unknown>): void {
    if (event.target === this.nodesMap) this.onNodeEntriesChanged(event)
    else if (event.path.length === 1) this.onNodeFieldsChanged(event)
    else if (event.path[1] === 'widgets') this.onNamedWidgetsChanged(event)
    else if (event.path[1] === 'flags')
      this.resyncNodes.add(String(event.path[0]))
  }

  private onOpaqueWidgetsChanged(event: Y.YArrayEvent<unknown>): void {
    if (event.path.length === 2 && event.path[1] === OPAQUE_WIDGETS_KEY)
      this.widgets.set(String(event.path[0]), 'all')
  }

  private onNodeEntriesChanged(event: Y.YMapEvent<unknown>): void {
    for (const [id, change] of event.changes.keys)
      this.nodes.set(id, change.action)
  }

  private onNamedWidgetsChanged(event: Y.YMapEvent<unknown>): void {
    const id = String(event.path[0])
    const current = this.widgets.get(id)
    if (current === 'all') return
    const names = current ?? new Set<string>()
    for (const name of event.keysChanged) names.add(name)
    this.widgets.set(id, names)
  }

  private onNodeFieldsChanged(event: Y.YMapEvent<unknown>): void {
    const id = String(event.path[0])
    if (
      event.keysChanged.has('widgets') ||
      event.keysChanged.has(OPAQUE_WIDGETS_KEY)
    )
      this.widgets.set(id, 'all')
    if ([...event.keysChanged].some((key) => SYNCED_NODE_FIELDS.has(key)))
      this.resyncNodes.add(id)
  }

  private readonly onLinksChanged = (event: Y.YMapEvent<unknown>): void => {
    for (const id of event.keysChanged) this.links.add(id)
  }

  private readonly onMetaChanged = (event: Y.YMapEvent<unknown>): void => {
    const change = event.changes.keys.get('groups')
    if (!change) return
    const current = groupIds(this.metaMap.get('groups'))
    for (const id of groupIds(change.oldValue))
      if (!current.has(id)) this.removedGroups.add(id)
    for (const id of current) this.removedGroups.delete(id)
  }
}

export function groupIds(groups: unknown): Set<string> {
  const ids = new Set<string>()
  if (!Array.isArray(groups)) return ids
  for (const group of groups) {
    const id: unknown =
      typeof group === 'object' && group !== null
        ? (group as { id?: unknown }).id
        : undefined
    if (typeof id === 'number' || typeof id === 'string') ids.add(String(id))
  }
  return ids
}
