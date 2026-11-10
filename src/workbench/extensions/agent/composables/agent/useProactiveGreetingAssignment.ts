import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'
import { reportError } from '@comfyorg/telemetry/reportError'
import { once } from 'es-toolkit'
import type { User } from 'firebase/auth'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  ingestApiClient,
  requestAuth
} from '@/platform/remote/ingest/ingestApi'
import { ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'
import {
  getHostProactiveGreetingAdmission,
  requiresHostProactiveGreetingAdmission,
  subscribeToHostProactiveGreetingAdmission
} from '@/platform/telemetry/hostProactiveGreeting'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { isCloud } from '@/platform/distribution/types'
import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'
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

type HostAssignment = {
  userId: string
  workspaceId: string
  assignment?: AgentGreetingAssignment
}
type AssignmentLoadFailure = 'failed'

async function verifyHostFirebaseUser(
  userId: string,
  firebaseUser: () => User | null,
  signal: AbortSignal
): Promise<true | AssignmentLoadFailure | undefined> {
  const user = firebaseUser()
  if (signal.aborted || user?.uid !== userId) return
  const isStale = () => signal.aborted || firebaseUser() !== user
  let token: string
  try {
    token = await user.getIdToken()
  } catch {
    return 'failed'
  }
  if (!token || isStale()) return
  const admission = await getHostProactiveGreetingAdmission(userId, token)
  if (admission === 'allowed' && !isStale()) return true
}

async function readLocalAssignment(
  userId: string,
  workspaceId: string,
  signal: AbortSignal
): Promise<AgentGreetingAssignment | AssignmentLoadFailure | undefined> {
  let auth: Awaited<ReturnType<typeof requestAuth>>
  try {
    auth = await requestAuth()
  } catch {
    return 'failed'
  }
  if (signal.aborted) return
  const url = ingestApiUrl('/features')
  let response: { data: unknown }
  try {
    response = await ingestApiClient.get<unknown>(url, {
      ...auth,
      signal,
      timeout: 10_000
    })
  } catch {
    return 'failed'
  }
  return resolveProactiveGreetingAssignment(response.data, {
    userId,
    workspaceId
  })
}

async function loadHostAssignment(
  userId: string,
  workspaceId: string,
  firebaseUser: () => User | null,
  signal: AbortSignal
): Promise<HostAssignment | AssignmentLoadFailure | undefined> {
  const isAborted = (): boolean => signal.aborted
  const admission = await getHostProactiveGreetingAdmission(userId)
  if (isAborted() || admission === 'denied') return
  if (isCloud)
    return admission === 'allowed' ? { userId, workspaceId } : undefined

  const assignment = await readLocalAssignment(userId, workspaceId, signal)
  if (!assignment || assignment === 'failed') return assignment
  if (admission === 'verify-firebase') {
    const proof = await verifyHostFirebaseUser(userId, firebaseUser, signal)
    if (proof !== true) return proof
  }
  return { userId, workspaceId, assignment }
}

function sameAssignment(
  current: AgentGreetingAssignment | undefined,
  previous: AgentGreetingAssignment | undefined
): boolean {
  if (!current || !previous) return false
  return (
    current.userId === previous.userId &&
    current.workspaceId === previous.workspaceId &&
    current.variant === previous.variant &&
    current.telemetry?.group_key === previous.telemetry?.group_key
  )
}

export function useProactiveGreetingAssignment() {
  const { resolvedUserInfo } = useCurrentUser()
  const authStore = useAuthStore()
  const firebaseUser = () => authStore.currentUser
  const workspace = useTeamWorkspaceStore()
  const panel = useAgentPanelStore()
  const requiresHostAdmission = requiresHostProactiveGreetingAdmission()
  const reportAssignmentFailure = once(() =>
    reportError(new Error('Failed to load proactive greeting assignment'), {
      surface: 'agent',
      errorType: 'failure_loading_agent_proactive_assignment',
      level: 'warning'
    })
  )
  const hostAssignment = shallowRef<HostAssignment>()
  const identity = computed(() => ({
    userId: resolvedUserInfo.value?.id ?? null,
    workspaceId: workspace.activeWorkspaceId ?? null
  }))
  const admissionRevision = ref(0)
  const unsubscribe = requiresHostAdmission
    ? subscribeToHostProactiveGreetingAdmission(() => {
        admissionRevision.value++
      })
    : undefined
  if (unsubscribe) {
    onScopeDispose(unsubscribe)
    watch(
      [
        () => identity.value.userId,
        () => identity.value.workspaceId,
        () => panel.isOpen,
        firebaseUser,
        admissionRevision
      ],
      async ([userId, workspaceId, open], _, onCleanup) => {
        hostAssignment.value = undefined
        if (!open || !userId || !workspaceId) return
        const controller = new AbortController()
        onCleanup(() => controller.abort())
        const admitted = await loadHostAssignment(
          userId,
          workspaceId,
          firebaseUser,
          controller.signal
        )
        if (controller.signal.aborted) return
        if (admitted === 'failed') return reportAssignmentFailure()
        hostAssignment.value = admitted
      },
      { immediate: true, flush: 'sync' }
    )
  }
  function currentAssignment(): AgentGreetingAssignment | undefined {
    const admitted = hostAssignment.value
    if (
      requiresHostAdmission &&
      (!admitted ||
        admitted.userId !== identity.value.userId ||
        admitted.workspaceId !== identity.value.workspaceId)
    )
      return
    if (!isCloud) return admitted?.assignment
    if (authenticatedRemoteConfigState.value !== 'authenticated') return
    return resolveProactiveGreetingAssignment(
      remoteConfig.value,
      identity.value
    )
  }

  return computed<AgentGreetingAssignment | undefined>((previous) => {
    const assignment = currentAssignment()
    return sameAssignment(assignment, previous) ? previous : assignment
  })
}
