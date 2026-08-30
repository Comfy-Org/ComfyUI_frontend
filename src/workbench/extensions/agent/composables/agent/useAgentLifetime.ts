import { computed, effectScope, onBeforeUnmount, watch } from 'vue'
import type { Ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import { forgetAgentSessionMemory } from './agentSessionMemory'

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

/**
 * Deliberately incomplete, and precisely so. The panel-OPEN case is closed
 * here: draftStore.reset() drives the follower's real-detach
 * (clearPersistedDocId). The panel-CLOSED case - a live CRDT document left
 * bound with no panel mounted to detach it - remains CHRISTIAN QUESTION Q1
 * and is undecided at this layer.
 */
function purgeUserScopedAgentState(): void {
  const conversation = useAgentConversationStore()
  // Order is load-bearing: settle the outgoing user's in-flight turn and drop
  // its background turns BEFORE reset(), because reset() only clears the
  // active slot. Dropping first also empties the retained set, so reset's
  // dropAttachmentPreviews revokes every preview it still owns.
  conversation.abortActiveTurn()
  conversation.dropBackgroundTurns()
  conversation.reset()
  const composer = useAgentComposerStore()
  for (const attachment of composer.attachments) {
    if (attachment.previewUrl?.startsWith('blob:'))
      URL.revokeObjectURL(attachment.previewUrl)
  }
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
  // The follower must receive THIS ref rather than computing its own from
  // draftStore, because consuming it forces useAgentLifetime() to run before
  // useAgentCrdtFollower(docWorkflowId). That call order IS the teardown
  // contract: onBeforeUnmount hooks fire in registration order, so
  // session.stop() registers first and therefore runs before the follower
  // tears its own subscription down.
  return { docWorkflowId: computed(() => draftStore.workflowId) }
}
