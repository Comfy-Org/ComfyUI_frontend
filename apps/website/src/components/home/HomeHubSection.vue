<script setup lang="ts">
import { computed } from 'vue'
import { useMounted } from '@vueuse/core'

import type { HubBannerContent } from '@/data/hubBanner'
import type { Locale } from '@/i18n/translations'
import { HUB_HOME_FLAG } from '@/lib/workshop/hub-section'
import { useWorkshopFlag } from '@/scripts/posthog'
import type {
  DiscoveryProvider,
  DiscoveryWorkflow
} from '@/data/modelDiscovery'
import HubBannerSection from './HubBannerSection.vue'
import ModelDiscoverySection from './ModelDiscoverySection.vue'

const {
  locale = 'en',
  content,
  providers,
  workflows
} = defineProps<{
  locale?: Locale
  content: HubBannerContent
  providers: readonly DiscoveryProvider[]
  workflows: readonly DiscoveryWorkflow[]
}>()

const mounted = useMounted()
const hubHomeEnabled = useWorkshopFlag(HUB_HOME_FLAG)
const showBanner = computed(() => mounted.value && hubHomeEnabled.value)
</script>

<template>
  <HubBannerSection v-if="showBanner" :locale :content />
  <ModelDiscoverySection v-else :providers :workflows />
</template>
