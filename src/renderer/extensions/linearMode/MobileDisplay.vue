<script setup lang="ts">
import { usePointerSwipe } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'
import LinearControls from '@/renderer/extensions/linearMode/LinearControls.vue'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useQueueStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

const tabs = [
  ['Assets', 'icon-[lucide--images]'],
  ['Edit & Run', 'icon-[lucide--play]'],
  ['Results', 'icon-[comfy--image-ai-edit]']
]

const { t } = useI18n()
const queueStore = useQueueStore()

const activeIndex = ref(0)
const sliderPaneRef = useTemplateRef('sliderPaneRef')
const sliderWidth = computed(() => sliderPaneRef.value?.offsetWidth)

const { distanceX, isSwiping } = usePointerSwipe(sliderPaneRef, {
  disableTextSelect: true,
  onSwipeEnd() {
    if (
      !sliderWidth.value ||
      Math.abs(distanceX.value) / sliderWidth.value < 0.4
    )
      return
    if (distanceX.value < 0)
      activeIndex.value = Math.max(activeIndex.value - 1, 0)
    else activeIndex.value = Math.min(activeIndex.value + 1, 2)
  }
})

const translate = computed(() => {
  const slideOffset =
    isSwiping.value && sliderWidth.value
      ? distanceX.value / sliderWidth.value
      : 0
  const totalOffset = slideOffset + activeIndex.value
  return `${totalOffset * -100}vw`
})

function onClick(index: number) {
  if (Math.abs(distanceX.value) > 30) return
  activeIndex.value = index
}
</script>
<template>
  <section class="absolute w-full h-full flex flex-col">
    <div
      :class="
        cn(
          'bg-comfy-menu-bg grow-1 w-full relative',
          !isSwiping && 'transition-all'
        )
      "
      :style="{ translate }"
    >
      <AssetsSidebarTab class="h-full w-screen absolute" />
      <div
        class="overflow-y-auto contain-size h-full w-screen absolute left-[100vw] top-0"
      >
        <LinearControls />
      </div>
      <div class="w-screen absolute bg-comfy-menu-bg h-full left-[200vw] top-0">
        <LinearPreview />
      </div>
    </div>
    <div
      ref="sliderPaneRef"
      class="h-22 p-4 bg-secondary-background w-full flex gap-4 items-center justify-around"
    >
      <Button
        v-for="([label, icon], index) in tabs"
        :key="label"
        :variant="index === activeIndex ? 'inverted' : 'secondary'"
        class="flex-col h-14 grow-1"
        @click="onClick(index)"
      >
        <div class="relative size-4">
          <i :class="cn('size-4', icon)" />
          <div
            v-if="
              index === 2 &&
              queueStore.runningTasks.length > 0 &&
              queueStore.pendingTasks.length > 0
            "
            class="absolute bg-primary-background size-2 -top-1 -right-1 rounded-full animate-pulse"
          />
        </div>
        {{ t(label) }}
      </Button>
    </div>
  </section>
</template>
