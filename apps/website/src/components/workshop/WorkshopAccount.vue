<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { computed, defineAsyncComponent } from 'vue'

import { resolveWorkshopAccountSource } from '@/config/workshop-account-source'
import type { Locale } from '@/i18n/translations'
import { useWorkshopAuthFlag, useWorkshopEnabled } from '@/scripts/posthog'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const mounted = useMounted()
const workshopEnabled = useWorkshopEnabled()
const workshopAuthEnabled = useWorkshopAuthFlag()
const shown = computed(
  () => mounted.value && workshopEnabled.value && workshopAuthEnabled.value
)

// Each loader waits for the account source, so a visitor the web session
// knows never mounts an island that would start Firebase.
const HeaderAccount = defineAsyncComponent(async () => {
  const [source, firebaseHeader] = await Promise.all([
    resolveWorkshopAccountSource(),
    import('@/components/workshop/HeaderAccount.vue')
  ])
  return source === 'session'
    ? import('@/components/workshop/HeaderSessionAccount.vue')
    : firebaseHeader
})
</script>

<template>
  <HeaderAccount v-if="shown" :locale />
</template>
