<template>
  <Popover
    v-if="linearMode"
    :side="sidebarOnLeft ? 'right' : 'left'"
    :side-offset="8"
  >
    <template #button>
      <SidebarIcon
        icon="pi pi-question-circle"
        class="comfy-help-center-btn"
        data-testid="help-center-button"
        :label="$t('menu.help')"
        :tooltip="$t('linearMode.giveFeedback')"
        :is-small="isSmall"
      />
    </template>
    <div ref="feedbackRef" data-tf-auto-resize :data-tf-widget="typeformId" />
  </Popover>
  <SidebarIcon
    v-else
    icon="pi pi-question-circle"
    class="comfy-help-center-btn"
    data-testid="help-center-button"
    :label="$t('menu.help')"
    :tooltip="$t('sideToolbar.helpCenter')"
    :icon-badge="shouldShowRedDot ? '•' : ''"
    badge-class="-top-1 -right-1 min-w-2 w-2 h-2 p-0 rounded-full text-[0px] bg-[#ff3b30]"
    :is-small="isSmall"
    @click="toggleHelpCenter()"
  />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'

import Popover from '@/components/ui/Popover.vue'
import { useHelpCenter } from '@/composables/useHelpCenter'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTypeformEmbed } from '@/platform/surveys/useTypeformEmbed'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import SidebarIcon from './SidebarIcon.vue'

const APP_MODE_FEEDBACK_TYPEFORM_ID = 'jmmzmlKw'

defineProps<{
  isSmall: boolean
}>()

const { shouldShowRedDot, toggleHelpCenter } = useHelpCenter()
const { linearMode } = storeToRefs(useCanvasStore())

const settingStore = useSettingStore()
const sidebarOnLeft = computed(
  () => settingStore.get('Comfy.Sidebar.Location') === 'left'
)

const feedbackRef = useTemplateRef<HTMLDivElement>('feedbackRef')
const { typeformId } = useTypeformEmbed(
  feedbackRef,
  APP_MODE_FEEDBACK_TYPEFORM_ID
)
</script>
