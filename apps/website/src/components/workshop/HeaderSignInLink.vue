<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import UserIcon from '@/components/icons/UserIcon.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  href,
  locale = 'en',
  compact = false
} = defineProps<{
  href: string
  locale?: Locale
  /** Drops the label for the icon, where the bar has no room for words. */
  compact?: boolean
}>()
</script>

<template>
  <a
    :href="href"
    data-testid="header-sign-in"
    :class="
      cn(
        'flex h-10 items-center justify-center rounded-2xl bg-transparency-white-t4 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 md:text-sm',
        compact ? 'w-10' : 'px-6 py-2.5'
      )
    "
  >
    <UserIcon v-if="compact" data-testid="sign-in-icon" class="size-5" />
    <span :class="cn(compact && 'sr-only')">{{
      t('auth.header.signIn', locale)
    }}</span>
  </a>
</template>
