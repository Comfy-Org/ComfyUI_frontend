<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { PromoRejection } from '@/checkout/promoEntry'

const { draft, error, locked } = defineProps<{
  draft: string
  error?: PromoRejection
  /** Not live, or the typed code is being priced. */
  locked: boolean
}>()

const emit = defineEmits<{
  edit: [draft: string]
  dismiss: []
  apply: []
}>()

const { t } = useI18n()
const errorId = useId()

const P = 'checkout.fullPage.summary.promo'

function edit(event: Event) {
  if (event.target instanceof HTMLInputElement) emit('edit', event.target.value)
}
</script>

<template>
  <form class="flex flex-col gap-2" novalidate @submit.prevent="emit('apply')">
    <div class="flex items-center gap-2">
      <input
        :value="draft"
        :aria-label="t(`${P}.field`)"
        :aria-invalid="error !== undefined"
        :aria-describedby="error && errorId"
        :disabled="locked"
        autocomplete="off"
        spellcheck="false"
        :class="
          cn(
            'h-8 min-w-0 flex-1 rounded-md border border-border-default bg-transparent px-3 text-sm text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:opacity-40',
            error && 'border-destructive-background'
          )
        "
        @input="edit"
      />
      <button
        type="submit"
        :disabled="locked"
        class="flex h-8 cursor-pointer items-center rounded-md bg-secondary-background px-2 text-xs text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        {{ t(`${P}.apply`) }}
      </button>
      <button
        type="button"
        :disabled="locked"
        :aria-label="t(`${P}.dismiss`)"
        class="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        @click="emit('dismiss')"
      >
        <i class="icon-[lucide--x] size-4" aria-hidden="true" />
      </button>
    </div>
    <p
      v-if="error"
      :id="errorId"
      class="m-0 text-xs text-destructive-background"
    >
      {{ t(`${P}.${error}`) }}
    </p>
  </form>
</template>
