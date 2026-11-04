<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useCommandStore } from '@/platform/keybindings/commandStore'

const { t } = useI18n()
const { flags } = useFeatureFlags()
const commandStore = useCommandStore()

function toggle() {
  void commandStore.execute('Comfy.ToggleSuperComfy')
}
</script>

<template>
  <Button
    v-if="flags.superComfyEnabled"
    :tooltip="t('superComfy.open')"
    variant="muted-textonly"
    size="icon"
    class="size-6 shrink-0 rounded-sm p-0"
    :aria-label="t('superComfy.open')"
    data-testid="supercomfy-toggle"
    @click="toggle"
  >
    <i class="icon-[lucide--network]" />
  </Button>
</template>
