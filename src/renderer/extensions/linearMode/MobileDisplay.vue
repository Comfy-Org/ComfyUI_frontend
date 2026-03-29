<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { useFullscreen, usePointerSwipe } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import LinearControls from '@/renderer/extensions/linearMode/LinearControls.vue'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import MobileError from '@/renderer/extensions/linearMode/MobileError.vue'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useQueueStore } from '@/stores/queueStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { cn } from '@/utils/tailwindUtil'

const tabs = [
  ['linearMode.mobileControls', 'icon-[lucide--play]'],
  ['nodeHelpPage.outputs', 'icon-[comfy--image-ai-edit]'],
  ['sideToolbar.assets', 'icon-[lucide--images]']
]

const canvasStore = useCanvasStore()
const colorPaletteService = useColorPaletteService()
const colorPaletteStore = useColorPaletteStore()
const { isLoggedIn } = useCurrentUser()
const executionErrorStore = useExecutionErrorStore()
const { t } = useI18n()
const { commandIdToMenuItem } = useMenuItemStore()
const queueStore = useQueueStore()
const workflowService = useWorkflowService()
const workflowStore = useWorkflowStore()
const { toggle: toggleFullscreen } = useFullscreen(undefined, {
  autoExit: true
})

const activeIndex = ref(1)
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
    else activeIndex.value = Math.min(activeIndex.value + 1, tabs.length - 1)
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
  return [
    ...workflowStore.openWorkflows.map((w) => ({
      label: w.filename,
      icon: w.activeState?.extra?.linearMode
        ? 'icon-[lucide--panels-top-left] bg-primary-background'
        : undefined,
      command: () => workflowService.openWorkflow(w),
      checked: workflowStore.activeWorkflow === w
    }))
  ]
})

const menuEntries = computed<MenuItem[]>(() => [
  {
    label: t('linearMode.appModeToolbar.apps'),
    icon: 'icon-[lucide--panels-top-left]'
  },
  {
    ...commandIdToMenuItem('Comfy.BrowseTemplates'),
    label: t('sideToolbar.templates'),
    icon: 'icon-[comfy--template]'
  },
  { separator: true },
  {
    label: t('icon.file'),
    items: [
      commandIdToMenuItem('Comfy.RenameWorkflow'),
      commandIdToMenuItem('Comfy.DuplicateWorkflow'),
      { separator: true },
      commandIdToMenuItem('Comfy.SaveWorkflow'),
      commandIdToMenuItem('Comfy.SaveWorkflowAs'),
      { separator: true },
      commandIdToMenuItem('Comfy.ExportWorkflow'),
      commandIdToMenuItem('Comfy.ExportWorkflowAPI')
    ]
  },
  {
    label: t('g.edit'),
    items: [
      commandIdToMenuItem('Comfy.Undo'),
      commandIdToMenuItem('Comfy.Redo'),
      { separator: true },
      commandIdToMenuItem('Comfy.RefreshNodeDefinitions'),
      commandIdToMenuItem('Comfy.Memory.UnloadModels'),
      commandIdToMenuItem('Comfy.Memory.UnloadModelsAndExecutionCache')
    ]
  },
  {
    label: t('linearMode.enterNodeGraph'),
    icon: 'icon-[comfy--workflow]',
    new: true,
    command: () => (canvasStore.linearMode = false)
  },
  { separator: true },
  {
    label: t('menu.theme'),
    items: colorPaletteStore.palettes.map((palette) => ({
      label: palette.name,
      icon:
        colorPaletteStore.activePaletteId === palette.id
          ? 'icon-[lucide--check]'
          : '',
      command: () => colorPaletteService.loadColorPalette(palette.id)
    }))
  },
  { separator: true },
  {
    ...commandIdToMenuItem('Comfy.ShowSettingsDialog'),
    label: t('menu.settings')
  },
  { ...commandIdToMenuItem('Comfy.ToggleHelpCenter'), label: t('menu.help') },
  {
    label: t('menu.fullscreen'),
    icon: 'icon-[lucide--fullscreen]',
    command: toggleFullscreen
  }
])
</script>
<template>
  <section
    class="absolute flex size-full flex-col bg-secondary-background"
    data-testid="linear-mobile"
  >
    <header
      class="flex h-16 w-full items-center gap-3 border-b border-border-subtle bg-base-background px-4 py-3"
    >
      <DropdownMenu :entries="menuEntries" />
      <DropdownMenu
        :entries="workflowsEntries"
        class="max-h-[40vh] w-(--reka-dropdown-menu-content-available-width) overflow-y-auto"
        :collision-padding="20"
      >
        <template #button>
          <!--TODO: Use button here? Probably too much work to destyle-->
          <div
            class="flex h-10 grow items-center gap-2 rounded-sm bg-secondary-background p-2"
            data-testid="linear-mobile-workflows"
          >
            <i
              class="icon-[lucide--panels-top-left] shrink-0 bg-primary-background"
            />
            <span
              class="size-full truncate contain-size"
              v-text="workflowStore.activeWorkflow?.filename"
            />
            <i
              class="icon-[lucide--chevron-down] shrink-0 bg-muted-foreground"
            />
          </div>
        </template>
      </DropdownMenu>
      <CurrentUserButton v-if="isLoggedIn" :show-arrow="false" />
    </header>
    <div class="size-full rounded-b-4xl contain-content">
      <div
        :class="
          cn('relative size-full', !isSwiping && 'transition-[translate]')
        "
        :style="{ translate }"
      >
        <div
          class="absolute h-full w-screen overflow-y-auto contain-size"
          role="tabpanel"
          :aria-hidden="activeIndex !== 0"
        >
          <LinearControls mobile @navigate-outputs="activeIndex = 1" />
        </div>
        <div
          class="absolute top-0 left-[100vw] flex h-full w-screen flex-col bg-base-background"
          role="tabpanel"
          :aria-hidden="activeIndex !== 1"
        >
          <MobileError
            v-if="executionErrorStore.isErrorOverlayOpen"
            @navigate-controls="activeIndex = 0"
          />
          <LinearPreview v-else mobile @navigate-controls="activeIndex = 0" />
        </div>
        <AssetsSidebarTab
          class="absolute top-0 left-[200vw] h-full w-screen bg-base-background"
          role="tabpanel"
          :aria-hidden="activeIndex !== 2"
        />
      </div>
    </div>
    <div
      ref="sliderPaneRef"
      class="flex h-22 w-full items-center justify-around gap-4 bg-secondary-background p-4"
      role="tablist"
    >
      <Button
        v-for="([label, icon], index) in tabs"
        :key="label"
        :variant="index === activeIndex ? 'secondary' : 'muted-textonly'"
        class="h-14 grow flex-col"
        role="tab"
        :aria-selected="index === activeIndex"
        @click="onClick(index)"
      >
        <div class="relative size-4">
          <i :class="cn('size-4', icon)" />
          <div
            v-if="index === 1 && executionErrorStore.isErrorOverlayOpen"
            class="absolute -top-1 -right-1 size-2 rounded-full bg-error"
          />
          <div
            v-else-if="
              index === 1 &&
              (queueStore.runningTasks.length > 0 ||
                queueStore.pendingTasks.length > 0)
            "
            class="absolute -top-1 -right-1 size-2 animate-pulse rounded-full bg-primary-background"
          />
        </div>
        {{ t(label) }}
      </Button>
    </div>
  </section>
</template>
