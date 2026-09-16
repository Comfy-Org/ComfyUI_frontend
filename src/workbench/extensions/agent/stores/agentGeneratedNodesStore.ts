import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope, RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import type { NodeLocatorId } from '@/types/nodeIdentification'

import type { TurnId } from '../schemas/agentApiSchema'

interface GeneratedNode {
  scope: GraphScope
  nodeId: NodeId
  at: number
}

interface GraphActivity {
  phase: 'working' | 'complete'
  turnId: TurnId
  nodes: NodeLocatorId[]
  shownAt: number
}

function locatorFor(scope: GraphScope, nodeId: NodeId): NodeLocatorId {
  return createNodeLocatorId(
    String(scope.rootGraphId) === scope.owningGraphId
      ? null
      : scope.owningGraphId,
    nodeId
  )
}

export const useAgentGeneratedNodesStore = defineStore(
  'agentGeneratedNodes',
  () => {
    const roots = ref(new Map<RootGraphId, Map<NodeLocatorId, GeneratedNode>>())
    const activities = ref(new Map<RootGraphId, GraphActivity>())
    const turn = ref<{ phase: 'working' | 'complete'; id: TurnId } | null>(null)
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const nodeStore = useNodeDataStore()
    const settingStore = useSettingStore()

    function beginTurn(id: TurnId): void {
      if (turn.value?.id === id) return
      turn.value = { phase: 'working', id }
      activities.value.clear()
    }

    function finishTurn(id: TurnId): void {
      if (turn.value?.id !== id) return
      turn.value = { phase: 'complete', id }
      for (const [rootId, activity] of activities.value) {
        const timer = setTimeout(
          () => {
            timers.delete(timer)
            const current = activities.value.get(rootId)
            if (current?.turnId === id)
              activities.value.set(rootId, { ...current, phase: 'complete' })
          },
          Math.max(0, activity.shownAt + 1200 - performance.now())
        )
        timers.add(timer)
      }
    }

    function forget(scope: GraphScope, nodeId: NodeId): void {
      const locator = locatorFor(scope, nodeId)
      roots.value.get(scope.rootGraphId)?.delete(locator)
      const activity = activities.value.get(scope.rootGraphId)
      if (!activity) return
      const nodes = activity.nodes.filter((id) => id !== locator)
      if (nodes.length === 0) activities.value.delete(scope.rootGraphId)
      else activities.value.set(scope.rootGraphId, { ...activity, nodes })
    }

    function latestMarkAt(scope: GraphScope): number {
      let latest = 0
      for (const entry of roots.value.get(scope.rootGraphId)?.values() ?? []) {
        if (entry.scope.owningGraphId === scope.owningGraphId)
          latest = Math.max(latest, entry.at)
      }
      return latest
    }

    function markGenerated(
      scope: GraphScope,
      nodeId: NodeId,
      cascade: boolean
    ): void {
      const now = performance.now()
      const latest = latestMarkAt(scope)
      const at =
        cascade && latest > 0
          ? Math.min(Math.max(now, latest + 90), now + 900)
          : now
      const locator = locatorFor(scope, nodeId)
      let marks = roots.value.get(scope.rootGraphId)
      if (!marks) {
        roots.value.set(scope.rootGraphId, new Map())
        marks = roots.value.get(scope.rootGraphId)!
      }
      marks.set(locator, { scope, nodeId, at })
      const currentTurn = turn.value
      if (!currentTurn) return
      const previous = activities.value.get(scope.rootGraphId)
      activities.value.set(scope.rootGraphId, {
        phase: currentTurn.phase,
        turnId: currentTurn.id,
        nodes: [...new Set([...(previous?.nodes ?? []), locator])],
        shownAt: previous?.shownAt ?? now
      })
      if (!previous && !settingStore.get('Comfy.Minimap.Visible'))
        void settingStore.set('Comfy.Minimap.Visible', true)
    }

    const unsubscribe = nodeStore.$onAction(({ name, args, after }) => {
      if (name === 'registerNode') {
        const [scope, node, context] = args
        const existed = nodeStore.getNode(scope.rootGraphId, node.id)
        after((registered) => {
          if (!registered || existed) return
          forget(scope, node.id)
          if (!context || context.actor.startsWith('human:')) return
          if (context.hydration && turn.value?.phase !== 'working') return
          markGenerated(scope, node.id, context.hydration === true)
        })
      } else if (name === 'deleteNode') {
        const [scope, node] = args
        after((removed) => {
          if (removed) forget(scope, node.id)
        })
      } else if (name === 'clearOwner') {
        const [scope] = args
        after(() => {
          for (const entry of roots.value.get(scope.rootGraphId)?.values() ??
            [])
            if (entry.scope.owningGraphId === scope.owningGraphId)
              forget(scope, entry.nodeId)
        })
      } else if (name === 'clearGraph') {
        const rootId = toRootGraphId(args[0])
        after(() => {
          roots.value.delete(rootId)
          activities.value.delete(rootId)
        })
      }
    }, true)

    onScopeDispose(() => {
      unsubscribe()
      for (const timer of timers) clearTimeout(timer)
    })

    return {
      roots,
      activities,
      beginTurn,
      finishTurn,
      latestMarkAt,
      generatedAtFor: (scope: GraphScope, nodeId: NodeId) =>
        roots.value.get(scope.rootGraphId)?.get(locatorFor(scope, nodeId))?.at,
      dismiss: (rootId: RootGraphId) => activities.value.delete(rootId)
    }
  }
)
