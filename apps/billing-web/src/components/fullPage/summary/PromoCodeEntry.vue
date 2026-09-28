<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { PromoEntry } from '@/checkout/promoEntry'
import type { PromoChip } from '@/checkout/summaryLedger'

const { chips, entry, accepts, live } = defineProps<{
  chips: readonly PromoChip[]
  entry: PromoEntry
  /** Whether this charge takes a code at all. */
  accepts: boolean
  /** Whether the customer may change the code right now. */
  live: boolean
}>()

const emit = defineEmits<{
  open: []
  edit: [draft: string]
  dismiss: []
  apply: []
  remove: []
}>()

const { t } = useI18n()
const errorId = useId()

const P = 'checkout.fullPage.summary.promo'

/** One entered code per quote; held discounts do not count against it. */
const takesCode = computed(
  () => accepts && !chips.some((chip) => chip.removable)
)

function edit(event: Event) {
  if (event.target instanceof HTMLInputElement) emit('edit', event.target.value)
}

const SECONDARY =
  'flex h-8 cursor-pointer items-center rounded-md bg-secondary-background px-2 text-xs text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40'
</script>

<template>
  <div v-if="chips.length > 0 || takesCode" class="flex flex-col gap-2">
    <ul v-if="chips.length > 0" class="m-0 flex list-none flex-wrap gap-2 p-0">
      <li
        v-for="chip in chips"
        :key="chip.code"
        class="flex h-8 items-center gap-1 rounded-md bg-secondary-background px-2 text-xs text-base-foreground"
      >
        {{ chip.code }}
        <button
          v-if="chip.removable"
          type="button"
          :disabled="!live || entry.kind === 'removing'"
          :aria-label="t(`${P}.remove`, { code: chip.code })"
          class="flex size-4 cursor-pointer items-center justify-center rounded-sm text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          @click="emit('remove')"
        >
          <i class="icon-[lucide--x] size-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <template v-if="takesCode">
      <div v-if="entry.kind === 'idle'">
        <button
          type="button"
          :disabled="!live"
          :class="SECONDARY"
          @click="emit('open')"
        >
          {{ t(`${P}.add`) }}
        </button>
      </div>
      <form
        v-else-if="
          entry.kind === 'editing' ||
          entry.kind === 'applying' ||
          entry.kind === 'rejected'
        "
        class="flex flex-col gap-2"
        novalidate
        @submit.prevent="emit('apply')"
      >
        <div class="flex items-center gap-2">
          <input
            :value="entry.draft"
            :aria-label="t(`${P}.field`)"
            :aria-invalid="entry.kind === 'rejected'"
            :aria-describedby="entry.kind === 'rejected' ? errorId : undefined"
            :disabled="!live || entry.kind === 'applying'"
            autocomplete="off"
            spellcheck="false"
            :class="
              cn(
                'h-8 min-w-0 flex-1 rounded-md border border-border-default bg-transparent px-3 text-sm text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:opacity-40',
                entry.kind === 'rejected' && 'border-destructive-background'
              )
            "
            @input="edit"
          />
          <button
            type="submit"
            :disabled="!live || entry.kind === 'applying'"
            :aria-busy="entry.kind === 'applying'"
            :class="SECONDARY"
          >
            {{ t(`${P}.apply`) }}
          </button>
          <button
            type="button"
            :disabled="!live || entry.kind === 'applying'"
            :aria-label="t(`${P}.dismiss`)"
            class="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            @click="emit('dismiss')"
          >
            <i class="icon-[lucide--x] size-4" aria-hidden="true" />
          </button>
        </div>
        <p
          v-if="entry.kind === 'rejected'"
          :id="errorId"
          class="m-0 text-xs text-destructive-background"
        >
          {{ t(`${P}.${entry.reason}`) }}
        </p>
      </form>
    </template>
  </div>
</template>
