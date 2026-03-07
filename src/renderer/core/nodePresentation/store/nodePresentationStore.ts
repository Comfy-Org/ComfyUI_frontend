import { customRef } from 'vue'
import type { Ref } from 'vue'

import type { NodeId } from '@/renderer/core/layout/types'
import { PresentationSource } from '@/renderer/core/nodePresentation/types'
import type {
  NodePresentationState,
  PresentationChange,
  PresentationUpdate
} from '@/renderer/core/nodePresentation/types'

interface NodeRefEntry {
  ref: Ref<NodePresentationState | null>
  trigger: () => void
}

class NodePresentationStoreImpl {
  private nodes = new Map<NodeId, NodePresentationState>()
  private currentSource: PresentationSource = PresentationSource.Canvas
  private changeListeners = new Set<(change: PresentationChange) => void>()
  private version = 0
  private nodeRefCache = new Map<NodeId, NodeRefEntry>()

  initializeNode(nodeId: NodeId, initial: NodePresentationState): void {
    this.nodes.set(nodeId, { ...initial })
    this.version++

    this.notifyChange({
      type: 'create',
      nodeId,
      source: this.currentSource
    })

    this.triggerRef(nodeId)
  }

  updateNode(
    nodeId: NodeId,
    update: PresentationUpdate,
    source?: PresentationSource
  ): void {
    const existing = this.nodes.get(nodeId)
    if (!existing) return

    const effectiveSource = source ?? this.currentSource
    let changed = false

    for (const key of Object.keys(update) as Array<keyof PresentationUpdate>) {
      if (key === 'flags') {
        const flagUpdate = update.flags
        if (!flagUpdate) continue

        const mergedFlags = { ...existing.flags, ...flagUpdate }
        const flagsChanged = Object.keys(flagUpdate).some(
          (fk) =>
            existing.flags[fk as keyof typeof existing.flags] !==
            flagUpdate[fk as keyof typeof flagUpdate]
        )

        if (flagsChanged) {
          const oldFlags = { ...existing.flags }
          existing.flags = mergedFlags
          changed = true

          this.notifyChange({
            type: 'update',
            nodeId,
            property: 'flags',
            source: effectiveSource,
            oldValue: oldFlags,
            newValue: mergedFlags
          })
        }
        continue
      }

      const oldValue = existing[key]
      const newValue = update[key]

      if (oldValue === newValue) continue

      ;(existing as unknown as Record<string, unknown>)[key] = newValue
      changed = true

      this.notifyChange({
        type: 'update',
        nodeId,
        property: key,
        source: effectiveSource,
        oldValue,
        newValue
      })
    }

    if (changed) {
      this.version++
      this.triggerRef(nodeId)
    }
  }

  removeNode(nodeId: NodeId): void {
    const existed = this.nodes.delete(nodeId)
    if (!existed) return

    this.version++

    this.notifyChange({
      type: 'delete',
      nodeId,
      source: this.currentSource
    })

    this.triggerRef(nodeId)
    this.nodeRefCache.delete(nodeId)
  }

  getNode(nodeId: NodeId): NodePresentationState | null {
    return this.nodes.get(nodeId) ?? null
  }

  getNodeRef(nodeId: NodeId): Ref<NodePresentationState | null> {
    const cached = this.nodeRefCache.get(nodeId)
    if (cached) return cached.ref

    let triggerFn: () => void
    const ref = customRef<NodePresentationState | null>((track, trigger) => {
      triggerFn = trigger
      return {
        get: () => {
          track()
          return this.nodes.get(nodeId) ?? null
        },
        set: () => {}
      }
    })
    this.nodeRefCache.set(nodeId, { ref, trigger: triggerFn! })
    return ref
  }

  setSource(source: PresentationSource): void {
    this.currentSource = source
  }

  getCurrentSource(): PresentationSource {
    return this.currentSource
  }

  onChange(callback: (change: PresentationChange) => void): () => void {
    this.changeListeners.add(callback)
    return () => {
      this.changeListeners.delete(callback)
    }
  }

  clear(): void {
    const nodeIds = [...this.nodes.keys()]
    this.nodes.clear()
    this.version++

    for (const nodeId of nodeIds) {
      this.triggerRef(nodeId)
    }
  }

  getVersion(): number {
    return this.version
  }

  private notifyChange(change: PresentationChange): void {
    for (const listener of this.changeListeners) {
      listener(change)
    }
  }

  private triggerRef(nodeId: NodeId): void {
    this.nodeRefCache.get(nodeId)?.trigger()
  }
}

export const nodePresentationStore = new NodePresentationStoreImpl()
