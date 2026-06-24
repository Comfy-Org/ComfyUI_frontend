<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { VIEW_MODE_TOGGLE_HOST_ID } from '@/constants/viewModeToggle'
import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const { enableAppBuilder } = useAppMode()
const appModeStore = useAppModeStore()
const { enterBuilder } = appModeStore
const { hasNodes } = storeToRefs(appModeStore)
</script>

<template>
  <div class="pointer-events-auto flex flex-row items-start gap-2">
    <div :id="VIEW_MODE_TOGGLE_HOST_ID.app" class="contents" />
    <Button
      v-if="enableAppBuilder"
      variant="base"
      size="unset"
      :disabled="!hasNodes"
      :aria-label="t('linearMode.appModeToolbar.buildAnApp')"
      class="h-10 gap-1.5 rounded-lg px-3 font-normal"
      @click="enterBuilder"
    >
      <i class="icon-[lucide--hammer] size-4" />
      <span>{{ t('linearMode.appModeToolbar.buildAnApp') }}</span>
    </Button>
  </div>
</template>
