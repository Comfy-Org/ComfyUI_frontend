import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'
import { computed, shallowRef, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  ingestApiClient,
  requestAuth
} from '@/platform/remote/ingest/ingestApi'
import { ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'
import { isHostTelemetryEnabled } from '@/platform/telemetry/hostTelemetryEnabled'
import { canEnrollHostProactiveGreeting } from '@/platform/telemetry/hostProactiveGreeting'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { isCloud } from '@/platform/distribution/types'
import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { AgentGreetingAssignment } from '@/workbench/extensions/agent/types/proactiveGreeting'

const assignmentConfig = zGetFeaturesResponse.pick({
  agent_proactive_greeting_assignment: true
})

export function resolveProactiveGreetingAssignment(
  config: unknown,
  identity: { userId: string | null; workspaceId: string | null }
): AgentGreetingAssignment | undefined {
  if (!identity.userId || !identity.workspaceId) return
  const parsed = assignmentConfig.safeParse(config)
  if (!parsed.success) return
  const assignment = parsed.data.agent_proactive_greeting_assignment
  if (
    !assignment ||
    assignment.user_id !== identity.userId ||
    assignment.workspace_id !== identity.workspaceId ||
    assignment.group_key !==
      JSON.stringify([identity.userId, identity.workspaceId])
  )
    return

  const variants = {
    control: 'A',
    generic: 'B',
    'canvas-prefill': 'C',
    'canvas-only': 'D'
  } as const
  return {
    userId: assignment.user_id,
    workspaceId: assignment.workspace_id,
    variant: variants[assignment.variant],
    telemetry: { ...assignment }
  }
}

export function useProactiveGreetingAssignment() {
  const { resolvedUserInfo } = useCurrentUser()
  const workspace = useTeamWorkspaceStore()
  const panel = useAgentPanelStore()
  const requiresHostAdmission =
    !isCloud || Boolean(window.__comfyDesktop2?.Telemetry)
  const hostAssignment = shallowRef<{
    userId: string
    workspaceId: string
    assignment?: AgentGreetingAssignment
  }>()
  const identity = computed(() => ({
    userId: resolvedUserInfo.value?.id ?? null,
    workspaceId: workspace.activeWorkspaceId ?? null
  }))
  if (requiresHostAdmission) {
    watch(
      [
        () => identity.value.userId,
        () => identity.value.workspaceId,
        () => panel.isOpen,
        isHostTelemetryEnabled
      ],
      async ([userId, workspaceId, open, telemetryEnabled], _, onCleanup) => {
        hostAssignment.value = undefined
        if (!telemetryEnabled || !open || !userId || !workspaceId) return
        const controller = new AbortController()
        const isAborted = (): boolean => controller.signal.aborted
        onCleanup(() => controller.abort())
        try {
          if (!(await canEnrollHostProactiveGreeting(userId))) return
          if (isAborted()) return
          if (isCloud) {
            hostAssignment.value = { userId, workspaceId }
            return
          }
          const auth = await requestAuth()
          if (isAborted()) return
          const { data } = await ingestApiClient.get<unknown>(
            ingestApiUrl('/features'),
            { ...auth, signal: controller.signal, timeout: 10_000 }
          )
          if (isAborted()) return
          hostAssignment.value = {
            userId,
            workspaceId,
            assignment: resolveProactiveGreetingAssignment(data, {
              userId,
              workspaceId
            })
          }
        } catch {
          if (!isAborted()) hostAssignment.value = undefined
        }
      },
      { immediate: true, flush: 'sync' }
    )
  }
  return computed<AgentGreetingAssignment | undefined>((previous) => {
    const admitted = hostAssignment.value
    if (
      requiresHostAdmission &&
      (!admitted ||
        admitted.userId !== identity.value.userId ||
        admitted.workspaceId !== identity.value.workspaceId)
    )
      return
    const assignment = isCloud
      ? authenticatedRemoteConfigState.value === 'authenticated'
        ? resolveProactiveGreetingAssignment(remoteConfig.value, identity.value)
        : undefined
      : admitted?.assignment
    return assignment &&
      previous &&
      assignment.userId === previous.userId &&
      assignment.workspaceId === previous.workspaceId &&
      assignment.variant === previous.variant &&
      assignment.telemetry?.group_key === previous.telemetry?.group_key
      ? previous
      : assignment
  })
}
