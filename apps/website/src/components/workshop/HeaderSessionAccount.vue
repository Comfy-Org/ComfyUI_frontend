<script setup lang="ts">
import { Coins } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useWorkshopSessionBalance } from '../../config/workshop-session-balance'
import {
  useWorkshopSessionAccount,
  useWorkshopWebSession
} from '../../config/workshop-web-session-identity'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { initialsOf } from '../../lib/workshop/initials'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const user = useWorkshopSessionAccount()
const balance = useWorkshopSessionBalance(useWorkshopWebSession())
const accountName = computed(() => user.value?.name || user.value?.email || '')
const credits = computed(() =>
  balance.value.status === 'ok' ? balance.value.credits : undefined
)
const creditsUnit = computed(() =>
  t(credits.value === 1 ? 'auth.header.credit' : 'auth.header.credits', locale)
)
</script>

<template>
  <span v-if="user" class="flex shrink-0 items-center gap-1.5">
    <span
      v-if="credits !== undefined"
      data-testid="header-session-credits"
      :class="
        cn(
          'flex h-8 items-center gap-1.5 px-2 text-sm font-bold whitespace-nowrap tabular-nums',
          credits > 0 ? 'text-primary-warm-white' : 'text-primary-comfy-red'
        )
      "
    >
      <Coins class="size-4" aria-hidden="true" />
      {{ new Intl.NumberFormat(locale).format(credits) }}
      <span class="sr-only">{{ creditsUnit }}</span>
    </span>
    <span
      role="img"
      data-testid="header-session-account"
      :aria-label="`${t('auth.header.account', locale)}, ${user.email}`"
      :title="user.email"
      class="grid size-10 shrink-0 place-items-center rounded-full border border-transparency-white-t20 bg-transparency-white-t4 text-xs font-bold text-primary-warm-white"
    >
      <span aria-hidden="true">{{ initialsOf(accountName) }}</span>
    </span>
  </span>
</template>
