<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { label, code } = defineProps<{
  label: string
  code: string
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ legacy: true })

/** Breaks after its underscores and hyphens first, and mid-word only when one piece alone overflows. */
const segments = computed(() => code.split(/(?<=[_-])/))
</script>

<template>
  <div
    class="flex w-full flex-col gap-2 rounded-lg bg-secondary-background p-6 text-left"
  >
    <p class="m-0 text-sm/5 text-muted-foreground">{{ label }}</p>
    <div class="flex items-center justify-between gap-4">
      <code
        class="min-w-0 font-mono text-base font-normal wrap-anywhere text-base-foreground"
        data-testid="checkout-ending-code"
      >
        <template v-for="(segment, index) in segments" :key="index">
          <wbr v-if="index > 0" />{{ segment }}
        </template>
      </code>
      <button
        type="button"
        :aria-label="
          copied
            ? t('checkout.fullPage.ending.copied')
            : t('checkout.fullPage.ending.copy')
        "
        class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none max-lg:size-10"
        @click="copy(code)"
      >
        <i
          :class="
            cn(
              'size-4',
              copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
            )
          "
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>
