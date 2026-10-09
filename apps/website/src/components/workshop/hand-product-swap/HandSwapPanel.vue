<script setup lang="ts">
import { ChevronDown, Maximize } from '@lucide/vue'
import { computed } from 'vue'

import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import type { HandProductSwap } from '@/composables/useHandProductSwap'
import type { Locale } from '@/i18n/translations'
import {
  SWAP_RESOLUTIONS,
  outputSize
} from '@/lib/workshop/hand-product-swap/contract'
import { hc } from '@/lib/workshop/hand-product-swap/copy'
import type { SwapImage } from '@/lib/workshop/hand-product-swap/examples'
import HandSwapProducts from './HandSwapProducts.vue'
import HandSwapSeedBar from './HandSwapSeedBar.vue'

const {
  hand,
  swap,
  locale = 'en'
} = defineProps<{
  hand: SwapImage
  swap: HandProductSwap
  locale?: Locale
}>()

const { phase, resolution, seed } = swap

const resolutions = computed(() =>
  SWAP_RESOLUTIONS.map((id) => ({
    id,
    label: id,
    meta: hc(
      'swap.resolution.size',
      locale,
      outputSize(id, hand.width, hand.height)
    )
  }))
)
const resolutionValue = computed({
  get: () => resolution.value,
  set: (id: string) => {
    const picked = SWAP_RESOLUTIONS.find((option) => option === id)
    if (picked) resolution.value = picked
  }
})
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="flex min-w-0 flex-col gap-3 pt-2"
    data-testid="swap-panel"
  >
    <EditorSourceTile
      kind="image"
      :src="hand.url"
      :name="hand.name"
      :add-label="hc('swap.empty.upload', locale)"
      :change-label="hc('swap.hand.change', locale)"
      input-test-id="swap-hand-input"
      @file="swap.useHandFile"
    />
    <HandSwapProducts :swap :locale />
    <div class="grid grid-cols-2 gap-2">
      <CinematicMenu
        v-model="resolutionValue"
        :options="resolutions"
        :heading="hc('swap.resolution', locale)"
        side="top"
        tooltip
        :trigger-class="FORMAT_TRIGGER_CLASS"
      >
        <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
        <span class="flex-1 text-left">{{ resolution }}</span>
        <ChevronDown
          class="size-3.5 text-primary-warm-gray"
          aria-hidden="true"
        />
      </CinematicMenu>
      <HandSwapSeedBar
        v-model="seed"
        :label="hc('swap.seed', locale)"
        :shuffle-label="hc('swap.seed.shuffle', locale)"
      />
    </div>
  </fieldset>
</template>
