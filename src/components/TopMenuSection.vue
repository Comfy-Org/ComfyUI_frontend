<template>
  <div v-if="!workspaceStore.focusMode" class="ml-1 flex flex-col gap-1 pt-1">
    <div class="flex gap-x-0.5">
      <div class="min-w-0 flex-1">
        <SubgraphBreadcrumb />
      </div>

      <div class="mx-1 flex flex-col items-end gap-1">
        <div
          ref="actionbarContainerRef"
          class="actionbar-container relative pointer-events-auto flex h-12 items-center overflow-hidden rounded-lg border border-interface-stroke px-2 shadow-interface"
        >
          <ActionBarButtons />
          <!-- Support for legacy topbar elements attached by custom scripts, hidden if no elements present -->
          <div
            ref="legacyCommandsContainerRef"
            class="[&:not(:has(*>*:not(:empty)))]:hidden"
          ></div>
          <ComfyActionbar
            v-model:docked="isActionbarDocked"
            v-model:queue-overlay-expanded="isQueueOverlayExpanded"
            :top-menu-container="actionbarContainerRef"
          />
          <CurrentUserButton v-if="isLoggedIn" class="shrink-0" />
          <LoginButton v-else-if="isDesktop" />
          <IconButton
            v-if="!isRightSidePanelOpen"
            v-tooltip.bottom="rightSidePanelTooltipConfig"
            type="transparent"
            size="sm"
            class="mr-2 text-base-foreground transition-colors duration-200 ease-in-out bg-secondary-background hover:bg-secondary-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-background"
            :aria-label="t('rightSidePanel.togglePanel')"
            @click="rightSidePanelStore.togglePanel"
          >
            <i class="icon-[lucide--panel-right] size-4" />
          </IconButton>
        </div>
        <QueueProgressOverlay v-model:expanded="isQueueOverlayExpanded" />
      </div>
    </div>

    <div>
      <QueueInlineProgressSummary
        v-if="!isActionbarFloating"
        class="pr-1"
        :hidden="isQueueOverlayExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import IconButton from '@/components/button/IconButton.vue'
import QueueInlineProgressSummary from '@/components/queue/QueueInlineProgressSummary.vue'
import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import ActionBarButtons from '@/components/topbar/ActionBarButtons.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isElectron } from '@/utils/envUtil'

const workspaceStore = useWorkspaceStore()
const rightSidePanelStore = useRightSidePanelStore()
const settingsStore = useSettingStore()
const { isLoggedIn } = useCurrentUser()
const isDesktop = isElectron()
const { t } = useI18n()
const isQueueOverlayExpanded = ref(false)
const actionbarContainerRef = ref<HTMLElement>()
const isActionbarDocked = ref(true)
const actionbarPosition = computed(() => settingsStore.get('Comfy.UseNewMenu'))
const isActionbarEnabled = computed(
  () => actionbarPosition.value !== 'Disabled'
)
const isActionbarFloating = computed(
  () => isActionbarEnabled.value && !isActionbarDocked.value
)

// Right side panel toggle
const { isOpen: isRightSidePanelOpen } = storeToRefs(rightSidePanelStore)

const rightSidePanelTooltipConfig = computed(() =>
  buildTooltipConfig(t('rightSidePanel.togglePanel'))
)

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
}
</style>
