<script setup lang="ts">
import { computed } from 'vue'
import { useMounted } from '@vueuse/core'

import { HUB_HOME_FLAG } from '@/lib/workshop/hub-section'
import { useWorkshopFlag } from '@/scripts/posthog'
import HubModelPage from './HubModelPage.vue'
import ModelPage from './ModelPage.vue'

type Page = InstanceType<typeof ModelPage>['$props']['page'] &
  InstanceType<typeof HubModelPage>['$props']['page']

const { page } = defineProps<{ page: Page }>()

const mounted = useMounted()
const hubOpen = useWorkshopFlag(HUB_HOME_FLAG)
const showHub = computed(() => mounted.value && hubOpen.value)
</script>

<template>
  <HubModelPage v-if="showHub" :page />
  <ModelPage v-else :page />
</template>
