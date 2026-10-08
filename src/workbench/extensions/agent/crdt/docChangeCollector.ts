import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

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
  private readonly nodesMap: Y.Map<Y.Map<unknown>>
  private readonly linksMap: Y.Map<unknown>

  constructor(doc: Y.Doc) {
    this.nodesMap = nodesMap(doc)
    this.linksMap = linksMap(doc)
    this.nodesMap.observeDeep(this.onNodesChanged)
    this.linksMap.observe(this.onLinksChanged)
  }

  /** Returns everything collected so far without clearing it. */
  peek(): FrameChanges {
    return {
      nodes: new Map(this.nodes),
      widgets: new Map(this.widgets),
      resyncNodes: new Set(this.resyncNodes),
      links: new Set(this.links)
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
  }

  destroy(): void {
    this.nodesMap.unobserveDeep(this.onNodesChanged)
    this.linksMap.unobserve(this.onLinksChanged)
    this.discard()
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
}
