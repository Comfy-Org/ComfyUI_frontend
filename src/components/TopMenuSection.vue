<template>
  <div
    v-if="!workspaceStore.focusMode"
    class="pointer-events-none ml-2 flex gap-4 pt-2 pr-2"
  >
    <div class="pointer-events-auto min-w-0 flex-1">
      <SubgraphBreadcrumb />
    </div>

    <div class="pointer-events-none flex flex-col items-end gap-2">
      <div
        class="actionbar-container pointer-events-auto flex h-12 items-center rounded-lg px-2 shadow-md"
      >
        <div
          ref="legacyCommandsContainerRef"
          class="[&:not(:has(*>*:not(:empty)))]:hidden"
        ></div>
        <ComfyActionbar />
        <LoginButton v-if="!isLoggedIn" />
        <CurrentUserButton v-else class="shrink-0" />
      </div>
      <QueueProgressOverlay />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'

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
