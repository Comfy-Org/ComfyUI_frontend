<script setup lang="ts">
import { ComboboxAnchor, ComboboxTrigger } from 'reka-ui'
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import { displayName } from '@/base/remote/itemSchema'

import { triggerVariants } from './remoteCombo.variants'
import type { TriggerVariants } from './remoteCombo.variants'
import { RemoteComboKey } from './state'

const props = defineProps<{
  size?: TriggerVariants['size']
  variant?: TriggerVariants['variant']
  border?: TriggerVariants['border']
  class?: string
  placeholder?: string
  disabled?: boolean
}>()

const ctx = inject(RemoteComboKey)
if (!ctx) {
  throw new Error('RemoteCombo.Trigger must be used inside RemoteCombo.Root')
}

const { t } = useI18n()

const displayLabel = computed(() => {
  if (ctx.isLoading.value) return t('widgets.remoteCombo.loading')
  if (ctx.errorMessage.value) return ctx.errorMessage.value
  const id = ctx.selectedValue.value
  if (!id) return props.placeholder ?? t('widgets.uploadSelect.placeholder')
  const item = ctx.items.value.find((i) => i.id === id)
  return item ? displayName(item) : id
})

const computedBorder = computed<TriggerVariants['border']>(() => {
  if (props.border) return props.border
  if (ctx.errorMessage.value) return 'invalid'
  if (ctx.isOpen.value) return 'active'
  return 'none'
})
</script>

<template>
  <ComboboxAnchor as-child>
    <ComboboxTrigger
      :class="
        cn(
          triggerVariants({
            size: props.size,
            variant: props.variant,
            border: computedBorder
          }),
          props.class
        )
      "
      :aria-label="
        t('widgets.remoteCombo.selectAriaLabel', {
          field: ctx.fieldLabel.value
        })
      "
      :disabled="
        props.disabled || ctx.isLoading.value || !!ctx.errorMessage.value
      "
      :aria-disabled="
        props.disabled || ctx.isLoading.value || !!ctx.errorMessage.value
      "
      data-testid="remote-combo-trigger"
    >
      <span class="truncate">{{ displayLabel }}</span>
      <i
        class="icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </ComboboxTrigger>
  </ComboboxAnchor>
</template>
