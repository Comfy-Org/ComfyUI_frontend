<script setup lang="ts">
import { ComboboxInput } from 'reka-ui'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import { searchVariants } from './remoteCombo.variants'
import { RemoteComboKey } from './state'

defineProps<{
  placeholder?: string
}>()

const ctx = inject(RemoteComboKey)
if (!ctx) {
  throw new Error('RemoteCombo.Search must be used inside RemoteCombo.Root')
}

const { t } = useI18n()

const emptyDisplayValue = () => ''
</script>

<template>
  <div :class="cn(searchVariants())">
    <i
      class="icon-[lucide--search] size-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
    <ComboboxInput
      v-model="ctx.searchQuery.value"
      :display-value="emptyDisplayValue"
      :placeholder="placeholder ?? t('g.search')"
      class="w-full border-none bg-transparent text-xs text-base-foreground outline-none placeholder:text-muted-foreground"
      :aria-label="
        t('widgets.remoteCombo.searchAriaLabel', {
          field: ctx.fieldLabel.value
        })
      "
      data-testid="remote-combo-search-input"
    />
  </div>
</template>
