import { computed, effectScope, onBeforeUnmount, watch } from 'vue'
import type { Ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import { forgetAgentSessionMemory } from './useAgentSession'

/**
 * Structural on purpose: the adapter never imports useAgentSession's return
 * type, so replacing either side stays a one-file change.
 */
export interface AgentSessionLifetime {
  start(): void
  stop(): void
}

export interface AgentLifetimeDeps {
  session: AgentSessionLifetime
}

export interface AgentLifetime {
  docWorkflowId: Readonly<Ref<string | null>>
}

function purgeUserScopedAgentState(): void {
  useAgentConversationStore().reset()
  const composer = useAgentComposerStore()
  composer.draft = ''
  composer.attachments = []
  forgetAgentSessionMemory()
  useAgentWorkflowTabBindingStore().clear()
  useAgentDraftStore().reset()
}

/**
 * App scope: lifetimes that must be observed while no panel is mounted.
 * Registered once from the extension setup; returns its disposer.
 */
export function registerAgentLifetimes(): () => void {
  const scope = effectScope(true)
  scope.run(() => {
    const workflowStore = useWorkflowStore()
    const tabActivity = useWorkflowTabActivityStore()
    const { resolvedUserInfo } = useCurrentUser()
    watch(
      () => workflowStore.activeWorkflow?.path,
      (path) => {
        if (path !== undefined) tabActivity.markSeen(path)
      }
    )
    watch(
      () => workflowStore.openWorkflows.map((tab) => tab.path),
      (paths) => tabActivity.pruneClosed(paths)
    )
    // Guarded on a previous identity: the boot-time null -> user resolution
    // must keep the stored thread id so the last session can resume.
    watch(
      () => resolvedUserInfo.value?.id ?? null,
      (_id, previousId) => {
        if (previousId !== null) purgeUserScopedAgentState()
      }
    )
  })
  return () => scope.stop()
}

/** Panel scope: begins at panel mount, ends at panel unmount. */
export function useAgentLifetime(deps: AgentLifetimeDeps): AgentLifetime {
  const { session } = deps
  const draftStore = useAgentDraftStore()
  const tabActivity = useWorkflowTabActivityStore()
  const { resolvedUserInfo } = useCurrentUser()
  session.start()
  watch(
    () => resolvedUserInfo.value?.id ?? null,
    (_id, previousId) => {
      if (previousId !== null) {
        session.stop()
        session.start()
      }
    }
  )
  // Never nulls docWorkflowId: a null write would run the follower's real
  // detach branch and destroy the FE-1902 remount rebind. The follower's own
  // unmount teardown is already total.
  onBeforeUnmount(() => {
    session.stop()
    tabActivity.setEditing(null)
    tabActivity.setCreating(false)
  })
  // Sourcing the doc ref here forces useAgentLifetime() to be called before
  // useAgentCrdtFollower(docWorkflowId), so session.stop() registers, and
  // runs, before the follower's own teardown hook.
  return { docWorkflowId: computed(() => draftStore.workflowId) }
}
