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
import { onMounted, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const workspaceStore = useTeamWorkspaceStore()
const { fetchMembers, fetchPendingInvites } = workspaceStore
const { workspaceRole } = useWorkspaceUI()

const loadFailed = ref(false)

async function load() {
  loadFailed.value = false
  const results = await Promise.allSettled([
    fetchMembers(),
    fetchPendingInvites()
  ])
  loadFailed.value = results.some((result) => result.status === 'rejected')
}

onMounted(() => {
  void load()
})
</script>
