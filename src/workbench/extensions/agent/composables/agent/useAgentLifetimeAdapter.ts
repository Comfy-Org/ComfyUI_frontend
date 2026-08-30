import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { AgentTarget } from '../../types/agentTarget'

interface BindingPort {
  pruneClosed(openTabPaths: readonly string[]): void
  reset(): void
  setSubject(subject: string | null): void
  workflowIdFor(tabPath: string): string | undefined
}

interface FollowerLifetimePort {
  retarget(target: AgentTarget | null): void
  dispose(): void
}

interface ThreadLifetimePort {
  retarget(target: AgentTarget | null): void
  close(target: AgentTarget): void
  abort(): void
  dispose(): void
}

interface AgentLifetimeAdapterOptions {
  enabled: Readonly<Ref<boolean>>
  userId: Readonly<Ref<string | null>>
  target: Readonly<Ref<AgentTarget | null>>
  currentGraphId: Readonly<Ref<string | null>>
  openTabPaths: Readonly<Ref<readonly string[]>>
  bindings: BindingPort
  follower: FollowerLifetimePort
  thread: ThreadLifetimePort
}

function sameTarget(
  left: AgentTarget | null,
  right: AgentTarget | null
): boolean {
  return (
    left?.workflowId === right?.workflowId &&
    left?.tabPath === right?.tabPath &&
    left?.graphId === right?.graphId
  )
}

export function useAgentLifetimeAdapter(options: AgentLifetimeAdapterOptions) {
  const {
    enabled,
    userId,
    target,
    currentGraphId,
    openTabPaths,
    bindings,
    follower,
    thread
  } = options
  const selected = ref<AgentTarget | null>(null)
  let attachedTarget: AgentTarget | null = null
  let activeSubject: string | null = null
  let disposed = false
  let stopTargetWatcher: (() => void) | null = null
  let stopGraphWatcher: (() => void) | null = null
  let stopTabsWatcher: (() => void) | null = null

  function stopOperationalWatchers(): void {
    stopTargetWatcher?.()
    stopGraphWatcher?.()
    stopTabsWatcher?.()
    stopTargetWatcher = null
    stopGraphWatcher = null
    stopTabsWatcher = null
  }

  function retargetFollower(next: AgentTarget | null): void {
    const attach =
      next !== null && next.graphId === currentGraphId.value ? next : null
    if (sameTarget(attachedTarget, attach)) return
    follower.retarget(attach)
    attachedTarget = attach
  }

  function detach(abort: boolean): void {
    retargetFollower(null)
    if (abort) thread.abort()
    selected.value = null
  }

  function startOperationalWatchers(): void {
    if (stopTargetWatcher !== null) return
    stopTargetWatcher = watch(target, (next) => {
      if (!enabled.value || userId.value === null) return
      if (sameTarget(selected.value, next)) return
      retargetFollower(next)
      thread.retarget(next)
      selected.value = next
    })

    stopGraphWatcher = watch(currentGraphId, () => {
      if (!enabled.value || userId.value === null) return
      retargetFollower(selected.value)
    })

    stopTabsWatcher = watch(
      openTabPaths,
      (open, previous = []) => {
        if (!enabled.value || userId.value === null) return
        const openSet = new Set(open)
        for (const closedPath of previous.filter(
          (path) => !openSet.has(path)
        )) {
          const workflowId = bindings.workflowIdFor(closedPath)
          if (
            workflowId === undefined ||
            selected.value?.workflowId !== workflowId
          )
            continue
          const closed = selected.value
          retargetFollower(null)
          thread.close(closed)
          selected.value = null
        }
        bindings.pruneClosed(open)
      },
      { flush: 'sync' }
    )
  }

  const stopLifetimeWatcher = watch(
    [enabled, userId],
    ([isEnabled, subject]) => {
      if (!isEnabled || subject === null) {
        if (!isEnabled) stopOperationalWatchers()
        detach(
          activeSubject !== null ||
            selected.value !== null ||
            attachedTarget !== null
        )
        if (activeSubject !== null) bindings.reset()
        bindings.setSubject(null)
        activeSubject = null
        return
      }

      startOperationalWatchers()
      if (activeSubject !== subject) {
        detach(activeSubject !== null)
        bindings.setSubject(subject)
        activeSubject = subject
      }

      if (!sameTarget(selected.value, target.value)) {
        retargetFollower(target.value)
        thread.retarget(target.value)
        selected.value = target.value
      }
    },
    { immediate: true }
  )

  function dispose(): void {
    if (disposed) return
    disposed = true
    stopLifetimeWatcher()
    stopOperationalWatchers()
    follower.dispose()
    thread.dispose()
    selected.value = null
    attachedTarget = null
  }

  onBeforeUnmount(dispose)

  return {
    selectedTarget: computed(() => selected.value),
    dispose
  }
}
