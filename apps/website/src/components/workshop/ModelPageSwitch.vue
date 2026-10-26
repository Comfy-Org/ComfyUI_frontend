<script setup lang="ts">
import { computed, provide, ref, shallowRef } from 'vue'
import type { Component } from 'vue'
import { useMounted, whenever } from '@vueuse/core'

import { HUB_HOME_FLAG } from '@/lib/workshop/hub-section'
import { LIVE_PAGE_HELD } from '@/lib/workshop/live-page-hold'
import { useWorkshopEnabledSettled, useWorkshopFlag } from '@/scripts/posthog'
import type HubModelPageComponent from './HubModelPage.vue'
import ModelPage from './ModelPage.vue'

type Page = InstanceType<typeof ModelPage>['$props']['page'] &
  InstanceType<typeof HubModelPageComponent>['$props']['page']

const { page } = defineProps<{ page: Page }>()

const mounted = useMounted()
const hubOpen = useWorkshopFlag(HUB_HOME_FLAG)
const flagsSettled = useWorkshopEnabledSettled()
const hubChoice = ref<'live' | 'loading' | 'hub' | 'failed'>('live')
const HubModelPage = shallowRef<Component>()

whenever(
  () => mounted.value && hubOpen.value,
  () => {
    hubChoice.value = 'loading'
    import('./HubModelPage.vue').then(
      (loaded) => {
        HubModelPage.value = loaded.default
        hubChoice.value = 'hub'
      },
      () => {
        hubChoice.value = 'failed'
      }
    )
  },
  { once: true }
)

provide(
  LIVE_PAGE_HELD,
  computed(
    () =>
      !flagsSettled.value ||
      hubChoice.value === 'loading' ||
      hubChoice.value === 'hub'
  )
)
</script>

<template>
  <component :is="HubModelPage" v-if="HubModelPage" :page />
  <ModelPage v-else :page />
</template>
