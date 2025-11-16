<template>
  <div v-if="!workspaceStore.focusMode" class="ml-1 flex gap-x-0.5 pt-1">
    <div class="min-w-0 flex-1">
      <SubgraphBreadcrumb />
    </div>

    <div class="mx-1 flex flex-col items-end gap-1">
      <div
        class="actionbar-container pointer-events-auto flex h-12 items-center rounded-lg border border-interface-stroke px-2 shadow-interface"
      >
        <ActionBarButtons />
        <!-- Support for legacy topbar elements attached by custom scripts, hidden if no elements present -->
        <div
          ref="legacyCommandsContainerRef"
          class="[&:not(:has(*>*:not(:empty)))]:hidden"
        ></div>
        <ComfyActionbar />
        <button
          v-tooltip.bottom="queueHistoryTooltipConfig"
          type="button"
          class="queue-history-toggle relative mr-2 inline-flex shrink-0 items-center justify-center rounded-lg border-none p-2 text-muted-foreground transition-colors duration-200 ease-in-out hover:bg-secondary-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-background cursor-pointer"
          :class="
            isQueueOverlayExpanded
              ? 'bg-secondary-background-selected'
              : 'bg-secondary-background'
          "
          :aria-pressed="isQueueOverlayExpanded"
          :aria-label="
            t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')
          "
          @click="toggleQueueOverlay"
        >
          <i class="icon-[lucide--history] block size-4" />
          <span
            v-if="queuedCount > 0"
            class="absolute -top-1 -right-1 min-w-[16px] rounded-full bg-primary-background py-0.25 text-[10px] font-medium leading-[14px] text-white"
          >
            {{ queuedCount }}
          </span>
        </button>
        <template v-if="isLoggedIn">
          <CurrentUserButton class="shrink-0" />
        </template>
        <template v-else-if="isDesktop">
          <LoginButton />
        </template>
      </div>
      <QueueProgressOverlay v-model:expanded="isQueueOverlayExpanded" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import ActionBarButtons from '@/components/topbar/ActionBarButtons.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { app } from '@/scripts/app'
import { useQueueStore } from '@/stores/queueStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isElectron } from '@/utils/envUtil'

const workspaceStore = useWorkspaceStore()
const { isLoggedIn } = useCurrentUser()
const isDesktop = isElectron()
const { t } = useI18n()
const isQueueOverlayExpanded = ref(false)
const queueStore = useQueueStore()
const queuedCount = computed(() => queueStore.pendingTasks.length)
const queueHistoryTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.viewJobHistory'))
)

// Maintain support for legacy topbar elements attached by custom scripts
const legacyCommandsContainerRef = ref<HTMLElement>()
onMounted(() => {
  if (legacyCommandsContainerRef.value) {
    app.menu.element.style.width = 'fit-content'
    legacyCommandsContainerRef.value.appendChild(app.menu.element)
  }
})

const toggleQueueOverlay = () => {
  isQueueOverlayExpanded.value = !isQueueOverlayExpanded.value
}
</script>

<style scoped>
.actionbar-container {
  background-color: var(--comfy-menu-bg);
}
</style>
