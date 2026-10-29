<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useEnterBuilder } from '@/components/builder/useEnterBuilder'
import WorkflowActionsDropdown from '@/components/common/WorkflowActionsDropdown.vue'
import Button from '@comfyorg/design-system/button/Button'
import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const { enableAppBuilder } = useAppMode()
const appModeStore = useAppModeStore()
const { enterBuilder } = useEnterBuilder()
const { hasNodes } = storeToRefs(appModeStore)
</script>

<template>
  <div class="pointer-events-auto flex items-start gap-2">
    <WorkflowActionsDropdown source="app_mode_toolbar" />
    <Button
      v-if="enableAppBuilder"
      variant="base"
      size="unset"
      :disabled="!hasNodes"
      :aria-label="t('linearMode.appModeToolbar.buildAnApp')"
      class="h-10 gap-1.5 rounded-lg px-3 font-normal"
      @click="enterBuilder"
    >
      <i class="icon-[lucide--hammer]" />
      <span>{{ t('linearMode.appModeToolbar.buildAnApp') }}</span>
    </Button>
  </div>
</template>
