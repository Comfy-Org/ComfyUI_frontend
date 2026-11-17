<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

/**
 * `column` is the element down with no saved method to fall back on,
 * `element` the element down beside live saved methods, `saved` the saved
 * methods down beside a live element.
 */
const { rail = 'column' } = defineProps<{
  rail?: 'column' | 'element' | 'saved'
}>()

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      role="alert"
      class="flex flex-col gap-2 rounded-lg bg-muted p-4 text-sm/5"
    >
      <p class="m-0 flex items-center gap-2 font-medium text-foreground">
        <i
          class="icon-[lucide--circle-alert] text-warning"
          aria-hidden="true"
        />
        {{ t(`checkout.fullPage.railFailed.${rail}.title`) }}
      </p>
      <p class="m-0 text-muted-foreground">
        {{ t(`checkout.fullPage.railFailed.${rail}.body`) }}
      </p>
    </div>
    <button
      type="button"
      :class="
        cn(
          buttonVariants({ variant: 'inverted', size: 'lg' }),
          'w-full font-semibold'
        )
      "
      @click="emit('retry')"
    >
      {{ t('checkout.fullPage.railFailed.retry') }}
    </button>
  </div>
</template>
