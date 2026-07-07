<script setup lang="ts">
import { ToggleGroupRoot } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import ToggleGroupItem from '../../ui/ToggleGroupItem.vue'

// Display control for the approval mode. Server-side honoring of client `auto` is removed
// by the M5.3 hardening, so this reflects a local preference; the send path never bypasses
// an approval on the strength of this toggle.
const mode = defineModel<'auto' | 'ask'>({ default: 'ask' })
const { t } = useI18n()
</script>

<template>
  <ToggleGroupRoot
    :model-value="mode"
    type="single"
    class="rounded-agent border-agent-border inline-flex border p-0.5"
    @update:model-value="
      (value) => {
        if (value === 'ask' || value === 'auto') mode = value
      }
    "
  >
    <ToggleGroupItem value="ask" class="px-2 py-1 text-xs">
      {{ t('agent.modeAsk') }}
    </ToggleGroupItem>
    <ToggleGroupItem value="auto" class="px-2 py-1 text-xs">
      {{ t('agent.modeAuto') }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
