<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PromoEntry } from '@/checkout/promoEntry'
import type { PromoChip } from '@/checkout/summaryLedger'
import PromoCodeField from '@/components/fullPage/summary/PromoCodeField.vue'

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

const P = 'checkout.fullPage.summary.promo'

/** One entered code per quote; held discounts do not count against it. */
const takesCode = computed(
  () => accepts && !chips.some((chip) => chip.removable)
)

const showsAdd = computed(() => takesCode.value && entry.kind === 'idle')

const field = computed(() =>
  takesCode.value && 'draft' in entry
    ? {
        draft: entry.draft,
        error: entry.kind === 'rejected' ? entry.reason : undefined,
        locked: !live || entry.kind === 'applying'
      }
    : undefined
)

const canRemove = computed(() => live && entry.kind !== 'removing')
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
          :disabled="!canRemove"
          :aria-label="t(`${P}.remove`, { code: chip.code })"
          class="flex size-4 cursor-pointer items-center justify-center rounded-sm text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          @click="emit('remove')"
        >
          <i class="icon-[lucide--x] size-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <div v-if="showsAdd">
      <button
        type="button"
        :disabled="!live"
        class="flex h-8 cursor-pointer items-center rounded-md bg-secondary-background px-2 text-xs text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        @click="emit('open')"
      >
        {{ t(`${P}.add`) }}
      </button>
    </div>
    <PromoCodeField
      v-if="field"
      v-bind="field"
      @edit="emit('edit', $event)"
      @dismiss="emit('dismiss')"
      @apply="emit('apply')"
    />
  </div>
</template>
