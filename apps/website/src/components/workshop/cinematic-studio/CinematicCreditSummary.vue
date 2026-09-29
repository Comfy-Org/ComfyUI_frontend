<script setup lang="ts">
import { Coins } from '@lucide/vue'
import { computed } from 'vue'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import { isUnpaid } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicCreditAction from './CinematicCreditAction.vue'

const {
  takes,
  memberWorkspace,
  locale = 'en'
} = defineProps<{
  /** The takes of one shot. */
  takes: readonly Take[]
  memberWorkspace?: string
  locale?: Locale
}>()

const emit = defineEmits<{ retry: [ids: string[]] }>()

const skipped = computed(() => takes.filter(isUnpaid))
</script>

<template>
  <div
    v-if="takes.length > 1 && skipped.length"
    role="status"
    data-testid="cinematic-credit-summary"
    class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-comfy-yellow/5 px-4 py-2.5 ring-1 ring-primary-comfy-yellow/25 ring-inset"
  >
    <span class="flex items-center gap-2 text-sm text-primary-warm-white">
      <Coins
        class="size-4 shrink-0 text-primary-comfy-yellow"
        aria-hidden="true"
      />
      {{
        tc('cinematic.credits.skipped', locale, {
          failed: skipped.length,
          total: takes.length
        })
      }}
    </span>
    <CinematicCreditAction
      :member="memberWorkspace !== undefined"
      :retry-label="tc('cinematic.credits.retrySkipped', locale)"
      :locale
      @retry="
        emit(
          'retry',
          skipped.map(({ id }) => id)
        )
      "
    />
  </div>
</template>
