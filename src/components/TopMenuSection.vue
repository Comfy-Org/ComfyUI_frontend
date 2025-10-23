<template>
  <div v-if="!workspaceStore.focusMode" class="ml-2 flex pt-2">
    <div class="min-w-0 flex-1">
      <SubgraphBreadcrumb />
    </div>

    <div
      class="actionbar-container pointer-events-auto mx-2 flex h-12 items-center rounded-lg px-2 shadow-md"
    >
      <!-- Support for legacy topbar elements attached by custom scripts, hidden if no elements present -->
      <div
        ref="legacyCommandsContainerRef"
        class="[&:not(:has(*>*:not(:empty)))]:hidden"
      ></div>
      <ComfyActionbar />
      <template v-if="isDesktop">
        <LoginButton v-if="!isLoggedIn" />
        <CurrentUserButton v-else class="shrink-0" />
      </template>
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
import { isElectron } from '@/utils/envUtil'

const workspaceStore = useWorkspaceStore()
const { isLoggedIn } = useCurrentUser()
const isDesktop = isElectron()

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
