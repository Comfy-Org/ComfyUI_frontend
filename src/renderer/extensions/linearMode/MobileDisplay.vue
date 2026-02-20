<script setup lang="ts">
import { usePointerSwipe } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'
import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkflowActionsMenu } from '@/composables/useWorkflowActionsMenu'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import LinearControls from '@/renderer/extensions/linearMode/LinearControls.vue'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

const tabs = [
  ['Assets', 'icon-[lucide--images]'],
  ['Edit & Run', 'icon-[lucide--play]'],
  ['Results', 'icon-[comfy--image-ai-edit]']
]

const { isLoggedIn } = useCurrentUser()
const { t } = useI18n()
const queueStore = useQueueStore()
//FIXME placeholder
const { menuItems } = useWorkflowActionsMenu(
  () => useCommandStore().execute('Comfy.RenameWorkflow'),
  { isRoot: true }
)
const workflowService = useWorkflowService()
const workflowStore = useWorkflowStore()

const activeIndex = ref(2)
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

const workflowsEntries = computed(() => {
  return workflowStore.openWorkflows.map((w) => ({
    label: w.filename,
    icon: w.activeState?.extra?.linearMode
      ? 'icon-[lucide--panels-top-left] bg-primary-background'
      : undefined,
    command: () => workflowService.openWorkflow(w)
  }))
})
</script>
<template>
  <section class="absolute w-full h-full flex flex-col bg-base-background">
    <header
      class="w-full h-16 px-4 py-3 flex border-border-subtle border-b items-center gap-3"
    >
      <Popover :entries="menuItems" align="start">
        <template #button>
          <Button size="icon">
            <i class="icon-[lucide--menu]" />
          </Button>
        </template>
      </Popover>
      <Popover
        :entries="workflowsEntries"
        class="w-(--reka-popover-content-available-width)"
        :collision-padding="20"
      >
        <template #button>
          <!--TODO: Use button here? Probably too much work to destyle-->
          <div
            class="bg-secondary-background h-10 rounded-sm grow-1 flex items-center p-2 gap-2"
          >
            <i class="icon-[lucide--panels-top-left] bg-primary-background" />
            <span
              class="grow-1"
              v-text="workflowStore.activeWorkflow?.filename"
            />
            <i class="icon-[lucide--chevron-down] bg-muted-foreground" />
          </div>
        </template>
      </Popover>
      <CurrentUserButton v-if="isLoggedIn" class="[&_i]:hidden" />
    </header>
    <div class="size-full contain-content rounded-b-4xl">
      <div
        :class="cn('size-full relative', !isSwiping && 'transition-all')"
        :style="{ translate }"
      >
        <AssetsSidebarTab
          class="h-full w-screen absolute bg-secondary-background"
        />
        <div
          class="overflow-y-auto contain-size h-full w-screen absolute left-[100vw] top-0"
        >
          <LinearControls
            class="*:bg-secondary-background"
            mobile
            @navigate-assets="activeIndex = 0"
          />
        </div>
        <div
          class="w-screen absolute bg-secondary-background h-full left-[200vw] top-0 flex flex-col"
        >
          <LinearPreview mobile />
        </div>
      </div>
    </div>
    <div
      ref="sliderPaneRef"
      class="h-22 p-4 w-full flex gap-4 items-center justify-around"
    >
      <Button
        v-for="([label, icon], index) in tabs"
        :key="label"
        :variant="index === activeIndex ? 'secondary' : 'muted-textonly'"
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
