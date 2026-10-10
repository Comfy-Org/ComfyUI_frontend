<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      v-if="loadFailed"
      class="flex items-center gap-2 px-6 py-3 text-sm text-warning-background"
    >
      <i class="icon-[lucide--circle-alert] size-4 shrink-0" />
      <span>{{ $t('workspacePanel.members.loadFailed') }}</span>
      <Button variant="muted-textonly" size="sm" @click="load">
        {{ $t('g.retry') }}
      </Button>
    </div>
    <MembersPanelContent :key="workspaceRole" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useMembersPanel } from '@/platform/workspace/composables/useMembersPanel'
import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const workspaceStore = useTeamWorkspaceStore()
const { fetchMembers, fetchPendingInvites } = workspaceStore
const { workspaceRole } = useWorkspaceUI()
const { permissions } = useMembersPanel()
const canViewPendingInvites = computed(
  () => permissions.value.canViewPendingInvites
)

const failed = reactive({ members: false, invites: false })
const requests = { members: 0, invites: 0 }
const loaders = { members: fetchMembers, invites: fetchPendingInvites }
const loadFailed = computed(
  () => failed.members || (canViewPendingInvites.value && failed.invites)
)

async function loadResource(resource: keyof typeof loaders) {
  const workspaceId = workspaceStore.activeWorkspaceId
  const request = ++requests[resource]
  failed[resource] = false
  const [result] = await Promise.allSettled([loaders[resource]()])
  if (
    workspaceId === workspaceStore.activeWorkspaceId &&
    request === requests[resource]
  ) {
    failed[resource] = result.status === 'rejected'
  }
}

function loadInvites() {
  if (canViewPendingInvites.value) return loadResource('invites')
  ++requests.invites
  failed.invites = false
}

function load() {
  return Promise.all([loadResource('members'), loadInvites()])
}

watch(
  () => workspaceStore.activeWorkspaceId,
  () => void loadResource('members'),
  { immediate: true }
)
watch(
  [() => workspaceStore.activeWorkspaceId, canViewPendingInvites],
  () => void loadInvites(),
  { immediate: true }
)
</script>
