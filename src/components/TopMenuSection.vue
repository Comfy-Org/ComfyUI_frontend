<template>
  <div v-if="!workspaceStore.focusMode" class="flex pt-2 pointer-events-none">
    <div
      class="flex-1 min-w-0 pointer-events-auto"
      :class="{ 'ml-2': sidebarPanelVisible }"
    >
      <SubgraphBreadcrumb />
    </div>

    <div
      class="actionbar-container shadow-md mx-2 flex pointer-events-auto items-center h-12 rounded-lg px-2"
    >
      <div ref="legacyCommandsContainerRef"></div>
      <ComfyActionbar />
      <LoginButton v-if="!isLoggedIn" />
      <CurrentUserButton v-else class="shrink-0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'

defineProps<{
  sidebarPanelVisible: boolean
}>()

const workspaceStore = useWorkspaceStore()
const { isLoggedIn } = useCurrentUser()

// Maintain support for legacy topbar elements attached by custom scripts
const legacyCommandsContainerRef = ref<HTMLElement>()
onMounted(() => {
  if (legacyCommandsContainerRef.value) {
    app.menu.element.style.width = 'fit-content'
    legacyCommandsContainerRef.value.appendChild(app.menu.element)
  }
})
</script>

<style scoped>
.actionbar-container {
  background-color: var(--comfy-menu-bg);
  border: 1px solid var(--p-panel-border-color);
}
</style>
