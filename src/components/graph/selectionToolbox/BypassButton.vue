<template>
  <Button
    v-show="hasAnySelection"
    v-tooltip.top="{
      value: t('commands.Comfy_Canvas_ToggleSelectedNodes_Bypass.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    data-testid="bypass-button"
    :class="{
      'hover:dark-theme:!bg-[#262729] hover:!bg-[#E7E6E6]': true,
      'dark-theme:[&:not(:active)]:!bg-[#262729] [&:not(:active)]:!bg-[#E7E6E6]':
        isBypassed
    }"
    @click="toggleBypass"
  >
    <template #icon>
      <i-lucide:ban class="size-4" />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { hasAnySelection } = useSelectionState()
const isBypassed = ref(false)

const toggleBypass = async () => {
  await commandStore.execute('Comfy.Canvas.ToggleSelectedNodes.Bypass')
}
</script>
