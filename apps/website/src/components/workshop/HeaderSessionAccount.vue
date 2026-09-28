<script setup lang="ts">
import { computed } from 'vue'

import { useWorkshopSessionAccount } from '../../config/workshop-web-session-identity'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { initialsOf } from '../../lib/workshop/initials'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const user = useWorkshopSessionAccount()
const accountName = computed(() => user.value?.name || user.value?.email || '')
</script>

<template>
  <span
    v-if="user"
    role="img"
    data-testid="header-session-account"
    :aria-label="`${t('auth.header.account', locale)}, ${user.email}`"
    :title="user.email"
    class="grid size-10 shrink-0 place-items-center rounded-full border border-transparency-white-t20 bg-transparency-white-t4 text-xs font-bold text-primary-warm-white"
  >
    <span aria-hidden="true">{{ initialsOf(accountName) }}</span>
  </span>
</template>
