<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'

import { subscribeToWorkshopBuyCredits } from '../../../config/workshop-buy-credits'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import WorkshopGate from '../WorkshopGate.vue'
import CinematicStudio from './CinematicStudio.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly CinematicModel[]
  locale?: Locale
}>()

const BuyCreditsDialog = defineAsyncComponent(
  () => import('../BuyCreditsDialog.vue')
)
const buyingCredits = ref(false)
let stopBuyCreditsRequests: (() => void) | undefined
onMounted(() => {
  stopBuyCreditsRequests = subscribeToWorkshopBuyCredits(() => {
    buyingCredits.value = true
  })
})
onBeforeUnmount(() => stopBuyCreditsRequests?.())
</script>

<template>
  <WorkshopGate>
    <CinematicStudio :models :locale />
    <BuyCreditsDialog
      v-if="buyingCredits"
      v-model:open="buyingCredits"
      :locale
    />
    <template #fallback>
      <div
        class="flex h-svh flex-col items-center justify-center gap-3 text-center"
      >
        <p class="text-base font-semibold text-primary-warm-white">
          {{ t('cinematic.unavailable.title', locale) }}
        </p>
        <a
          href="/models/"
          class="text-sm text-primary-comfy-yellow underline underline-offset-4"
        >
          {{ t('cinematic.unavailable.link', locale) }}
        </a>
      </div>
    </template>
  </WorkshopGate>
</template>
