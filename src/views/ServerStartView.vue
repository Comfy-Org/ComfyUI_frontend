<template>
  <div
    class="absolute inset-0 flex flex-col items-center justify-center h-screen bg-surface-0"
  >
    <ProgressSpinner class="w-16 h-16 mb-4" />
    <div class="text-xl">{{ $t('loading') }}{{ counter }}</div>
  </div>
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { useWorkspaceStore, WorkspaceState } from '@/stores/workspaceStore'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useInterval } from '@vueuse/core'

const workspaceStore = useWorkspaceStore()
const router = useRouter()
const counter = useInterval(1000)

onMounted(() => {
  setTimeout(() => {
    workspaceStore.state = WorkspaceState.Ready
    router.push('/')
  }, 3000)
})
</script>
