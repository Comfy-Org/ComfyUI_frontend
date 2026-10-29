<template>
  <div v-coachmark="FIRST_RUN_COACH_IDS.templatesButton" class="flex">
    <SidebarIcon
      icon="icon-[comfy--template]"
      :tooltip="$t('sideToolbar.templates')"
      :label="$t('sideToolbar.labels.templates')"
      :is-small="isSmall"
      class="templates-tab-button"
      @click="openTemplates"
    />
  </div>
</template>

<script setup lang="ts">
import { useTelemetry } from '@comfyorg/telemetry'
import { computed } from 'vue'

import { FIRST_RUN_COACH_IDS } from '@/platform/onboarding/onboardingTours'
import { vCoachmark } from '@/platform/onboarding/vCoachmark'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowTemplateSelectorDialog } from '@/platform/workflow/templates/composables/useWorkflowTemplateSelectorDialog'

import SidebarIcon from './SidebarIcon.vue'

const settingStore = useSettingStore()

const isSmall = computed(
  () => settingStore.get('Comfy.Sidebar.Size') === 'small'
)

/**
 * Open templates dialog from sidebar and track UI button click.
 */
const openTemplates = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'sidebar_templates_dialog_opened',
    element_group: 'sidebar'
  })
  useWorkflowTemplateSelectorDialog().show('sidebar')
}
</script>
