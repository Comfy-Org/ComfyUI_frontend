import { isEqual } from 'es-toolkit'
import { defineStore } from 'pinia'
import {
  defineAsyncComponent,
  defineComponent,
  h,
  onScopeDispose,
  ref,
  toRaw
} from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasOverlayStore } from '@/stores/canvasOverlayStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope, RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import type { NodeLocatorId } from '@/types/nodeIdentification'

import { useAgentMinimapLayer } from '../minimap/useAgentMinimapLayer'
import type { TurnId } from '../schemas/agentApiSchema'

interface GeneratedNode {
  scope: GraphScope
  nodeId: NodeId
  at: number
}

export interface GraphActivity {
  phase: 'working' | 'complete'
  turnId: TurnId
  nodes: NodeLocatorId[]
  shownAt: number
}

interface WorkflowSnapshot {
  graph: ComfyWorkflowJSON
  roots: Map<RootGraphId, Map<NodeLocatorId, GeneratedNode>>
  activities: Map<RootGraphId, GraphActivity>
  latestByOwner: Map<string, number>
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
    const latestByOwner = new Map<string, number>()
    const turn = ref<{
      phase: 'working' | 'complete'
      id: TurnId
      threadId: string | null
    } | null>(null)
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const snapshots = new WeakMap<object, WorkflowSnapshot>()
    let incomingGraph: ComfyWorkflowJSON | null = null
    const nodeStore = useNodeDataStore()
    const settingStore = useSettingStore()
    const workflowStore = useWorkflowStore()
    const ActivityBar = defineAsyncComponent(
      () => import('../components/agent/AgentGraphActivityBar.vue')
    )
    const unregisterOverlay = useCanvasOverlayStore().register(
      defineComponent(
        () => () =>
          h(ActivityBar, { activities: activities.value, onDismiss: dismiss })
      )
    )

    function ownerKey(scope: GraphScope): string {
      return `${scope.rootGraphId}:${scope.owningGraphId}`
    }

    function scheduleCompletion(rootId: RootGraphId, id: TurnId): void {
      const activity = activities.value.get(rootId)
      if (!activity) return
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

    function beginTurn(id: TurnId, threadId: string | null): void {
      if (turn.value?.id === id) return
      turn.value = { phase: 'working', id, threadId }
      activities.value.clear()
      for (const snapshot of snapshotsForOpenWorkflows())
        snapshot.activities.clear()
    }

    function finishTurn(id: TurnId): void {
      if (turn.value?.id !== id) return
      turn.value = { ...turn.value, phase: 'complete' }
      for (const rootId of activities.value.keys())
        scheduleCompletion(rootId, id)
      for (const snapshot of snapshotsForOpenWorkflows())
        for (const activity of snapshot.activities.values())
          if (activity.turnId === id) activity.phase = 'complete'
    }

    function snapshotsForOpenWorkflows(): WorkflowSnapshot[] {
      return workflowStore.openWorkflows.flatMap((workflow) => {
        const snapshot = snapshots.get(workflow)
        return snapshot ? [snapshot] : []
      })
    }

    function forget(scope: GraphScope, nodeId: NodeId): void {
      const locator = locatorFor(scope, nodeId)
      const removedAt = roots.value.get(scope.rootGraphId)?.get(locator)?.at
      roots.value.get(scope.rootGraphId)?.delete(locator)
      const key = ownerKey(scope)
      if (removedAt !== undefined && latestByOwner.get(key) === removedAt)
        refreshLatestMark(scope)
      const activity = activities.value.get(scope.rootGraphId)
      if (!activity) return
      const nodes = activity.nodes.filter((id) => id !== locator)
      if (nodes.length === 0) activities.value.delete(scope.rootGraphId)
      else activities.value.set(scope.rootGraphId, { ...activity, nodes })
    }

    function refreshLatestMark(scope: GraphScope): void {
      let latest = 0
      for (const entry of roots.value.get(scope.rootGraphId)?.values() ?? [])
        if (entry.scope.owningGraphId === scope.owningGraphId)
          latest = Math.max(latest, entry.at)
      const key = ownerKey(scope)
      if (latest) latestByOwner.set(key, latest)
      else latestByOwner.delete(key)
    }

    function latestMarkAt(scope: GraphScope): number {
      return latestByOwner.get(ownerKey(scope)) ?? 0
    }

    function generatedAtFor(
      scope: GraphScope,
      nodeId: NodeId
    ): number | undefined {
      return roots.value.get(scope.rootGraphId)?.get(locatorFor(scope, nodeId))
        ?.at
    }

    function markGenerated(
      scope: GraphScope,
      nodeId: NodeId,
      context: RemoteMutationContext
    ): void {
      const now = performance.now()
      const latest = latestMarkAt(scope)
      const at =
        context.hydration && latest > 0
          ? Math.min(Math.max(now, latest + 90), now + 900)
          : now
      const locator = locatorFor(scope, nodeId)
      const marks =
        roots.value.get(scope.rootGraphId) ??
        new Map<NodeLocatorId, GeneratedNode>()
      marks.set(locator, { scope, nodeId, at })
      roots.value.set(scope.rootGraphId, marks)
      latestByOwner.set(ownerKey(scope), Math.max(latest, at))
      reportGenerated(scope.rootGraphId, locator, context.actor, now)
    }

    function reportGenerated(
      rootId: RootGraphId,
      locator: NodeLocatorId,
      actor: string,
      now: number
    ): void {
      const currentTurn = turn.value
      const actorThread = /^agent:([^:]+):[^:]+$/.exec(actor)?.[1]
      if (
        !currentTurn ||
        (actorThread !== undefined && actorThread !== currentTurn.threadId)
      )
        return
      const previous = activities.value.get(rootId)
      const activity = previous ?? {
        phase: 'working',
        turnId: currentTurn.id,
        nodes: [],
        shownAt: now
      }
      activities.value.set(rootId, {
        ...activity,
        phase: 'working',
        nodes: [...new Set([...activity.nodes, locator])]
      })
      if (!previous && !settingStore.get('Comfy.Minimap.Visible'))
        void settingStore.set('Comfy.Minimap.Visible', true)
      if (currentTurn.phase === 'complete')
        scheduleCompletion(rootId, currentTurn.id)
    }

    function restoreSnapshot(snapshot: WorkflowSnapshot): void {
      roots.value = new Map(snapshot.roots)
      activities.value = new Map(snapshot.activities)
      latestByOwner.clear()
      for (const [key, at] of snapshot.latestByOwner) latestByOwner.set(key, at)
      for (const [rootId, activity] of activities.value) {
        if (activity.turnId !== turn.value?.id) {
          activities.value.delete(rootId)
        } else if (turn.value.phase === 'complete') {
          scheduleCompletion(rootId, activity.turnId)
        }
      }
    }

    const unregisterLifecycle = useExtensionStore().registerExtension({
      name: 'Comfy.AgentGeneratedNodesLifecycle',
      beforeLoadGraph() {
        const workflow = workflowStore.activeWorkflow
        const graph = workflow?.activeState
        if (!workflow || !graph) return
        if (!snapshots.has(workflow))
          snapshots.set(workflow, {
            graph: structuredClone(toRaw(graph)),
            roots: new Map(roots.value),
            activities: new Map(activities.value),
            latestByOwner: new Map(latestByOwner)
          })
        roots.value.clear()
        activities.value.clear()
        latestByOwner.clear()
      },
      beforeConfigureGraph(graph) {
        incomingGraph = structuredClone(toRaw(graph))
      },
      afterLoadGraph() {
        const workflow = workflowStore.activeWorkflow
        const snapshot = workflow ? snapshots.get(workflow) : undefined
        if (snapshot && isEqual(snapshot.graph, incomingGraph))
          restoreSnapshot(snapshot)
        if (workflow) snapshots.delete(workflow)
        incomingGraph = null
      },
      onGraphLoadError() {
        incomingGraph = null
      }
    })

    const unsubscribe = nodeStore.$onAction(({ name, args, after }) => {
      if (name === 'registerNode') {
        const [scope, node, context] = args
        const existed = nodeStore.getNode(scope.rootGraphId, node.id)
        after((registered) => {
          if (!registered || existed) return
          forget(scope, node.id)
          if (!context || context.actor.startsWith('human:')) return
          if (context.hydration && turn.value?.phase !== 'working') return
          markGenerated(scope, node.id, context)
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
          const hadMarks = roots.value.has(rootId)
          roots.value.delete(rootId)
          activities.value.delete(rootId)
          for (const key of latestByOwner.keys())
            if (key.startsWith(`${rootId}:`)) latestByOwner.delete(key)
          const workflow = workflowStore.activeWorkflow
          if (hadMarks && workflow) snapshots.delete(workflow)
        })
      }
    }, true)

    useAgentMinimapLayer({ generatedAtFor, latestMarkAt }, roots)

    onScopeDispose(() => {
      unregisterLifecycle()
      unregisterOverlay()
      unsubscribe()
      for (const timer of timers) clearTimeout(timer)
    })

    function dismiss(rootId: RootGraphId): void {
      activities.value.delete(rootId)
      for (const snapshot of snapshotsForOpenWorkflows())
        snapshot.activities.delete(rootId)
    }

    return {
      roots,
      activities,
      beginTurn,
      finishTurn,
      latestMarkAt,
      generatedAtFor,
      dismiss
    }
  }
)
