<script setup lang="ts">
import {
  breakpointsTailwind,
  unrefElement,
  useBreakpoints,
  whenever
} from '@vueuse/core'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import AppModeToolbar from '@/components/appMode/AppModeToolbar.vue'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import ModeToggle from '@/components/sidebar/ModeToggle.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import WorkflowTabs from '@/components/topbar/WorkflowTabs.vue'
import TypeformPopoverButton from '@/components/ui/TypeformPopoverButton.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useSettingStore } from '@/platform/settings/settingStore'
import LinearControls from '@/renderer/extensions/linearMode/LinearControls.vue'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import MobileMenu from '@/renderer/extensions/linearMode/MobileMenu.vue'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import type { ResultItemImpl } from '@/stores/queueStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const { t } = useI18n()
const nodeOutputStore = useNodeOutputStore()
const settingStore = useSettingStore()
const workspaceStore = useWorkspaceStore()

const mobileDisplay = useBreakpoints(breakpointsTailwind).smaller('md')

const activeTab = computed(() => workspaceStore.sidebarTab.activeSidebarTab)
const sidebarOnLeft = computed(
  () => settingStore.get('Comfy.Sidebar.Location') === 'left'
)
const hasLeftPanel = computed(
  () => (sidebarOnLeft.value && activeTab.value) || !sidebarOnLeft.value
)
const hasRightPanel = computed(
  () => sidebarOnLeft.value || (!sidebarOnLeft.value && activeTab.value)
)

const hasPreview = ref(false)
whenever(
  () => nodeOutputStore.latestPreview[0],
  () => (hasPreview.value = true)
)

const selectedItem = ref<AssetItem>()
const selectedOutput = ref<ResultItemImpl>()
const canShowPreview = ref(true)

const topLeftRef = useTemplateRef('topLeftRef')
const topRightRef = useTemplateRef('topRightRef')
const bottomLeftRef = useTemplateRef('bottomLeftRef')
const bottomRightRef = useTemplateRef('bottomRightRef')
const linearWorkflowRef = useTemplateRef('linearWorkflowRef')
</script>
<template>
  <div class="absolute w-full h-full">
    <div class="workflow-tabs-container pointer-events-auto h-9.5 w-full">
      <div class="flex h-full items-center">
        <WorkflowTabs />
        <TopbarBadges />
      </div>
    </div>
    <div
      v-if="mobileDisplay"
      class="justify-center border-border-subtle border-t overflow-y-scroll h-[calc(100%-38px)] bg-comfy-menu-bg"
    >
      <MobileMenu />
      <div class="flex flex-col text-muted-foreground">
        <LinearPreview
          :latent-preview="
            canShowPreview && hasPreview
              ? nodeOutputStore.latestPreview[0]
              : undefined
          "
          :run-button-click="linearWorkflowRef?.runButtonClick"
          :selected-item
          :selected-output
          mobile
        />
      </div>
      <LinearControls ref="linearWorkflowRef" mobile />
      <div class="text-base-foreground flex items-center gap-4">
        <div class="border-r border-border-subtle mr-auto">
          <ModeToggle class="m-2" />
        </div>
        <div v-text="t('linearMode.beta')" />
        <TypeformPopoverButton data-tf-widget="gmVqFi8l" class="mx-2" />
      </div>
    </div>
    <Splitter
      v-else
      class="h-[calc(100%-38px)] w-full bg-comfy-menu-secondary-bg"
      :pt="{ gutter: { class: 'bg-transparent w-4 -mx-1' } }"
      @resizestart="({ originalEvent }) => originalEvent.preventDefault()"
    >
      <SplitterPanel
        v-if="hasLeftPanel"
        id="linearLeftPanel"
        :size="1"
        class="min-w-min outline-none"
      >
        <div
          v-if="sidebarOnLeft && activeTab"
          class="flex h-full border-border-subtle border-r"
        >
          <ExtensionSlot :extension="activeTab" />
        </div>
        <LinearControls
          v-else
          ref="linearWorkflowRef"
          :toast-to="unrefElement(bottomLeftRef) ?? undefined"
          :notes-to="unrefElement(topLeftRef) ?? undefined"
        />
      </SplitterPanel>
      <SplitterPanel
        id="linearCenterPanel"
        :size="98"
        class="flex flex-col min-w-min gap-4 mr-2 px-10 pt-8 pb-4 relative text-muted-foreground outline-none"
      >
        <LinearPreview
          :latent-preview="
            canShowPreview && hasPreview
              ? nodeOutputStore.latestPreview[0]
              : undefined
          "
          :run-button-click="linearWorkflowRef?.runButtonClick"
          :selected-item
          :selected-output
        />
        <div ref="topLeftRef" class="absolute z-21 top-1 left-1">
          <AppModeToolbar />
        </div>
        <div ref="topRightRef" class="absolute z-21 top-4 right-4" />
        <div ref="bottomLeftRef" class="absolute z-20 bottom-4 left-4" />
        <div ref="bottomRightRef" class="absolute z-20 bottom-24 right-4" />
        <div
          class="absolute z-20 bottom-4 right-4 text-base-foreground flex items-center gap-4"
        >
          <TypeformPopoverButton
            data-tf-widget="gmVqFi8l"
            :align="
              settingStore.get('Comfy.Sidebar.Location') === 'left'
                ? 'end'
                : 'start'
            "
          />
        </div>
      </SplitterPanel>
      <SplitterPanel
        v-if="hasRightPanel"
        id="linearRightPanel"
        :size="1"
        class="min-w-min outline-none"
      >
        <LinearControls
          v-if="sidebarOnLeft"
          ref="linearWorkflowRef"
          :toast-to="unrefElement(bottomRightRef) ?? undefined"
          :notes-to="unrefElement(topRightRef) ?? undefined"
        />
        <div
          v-else-if="activeTab"
          class="flex h-full border-border-subtle border-l"
        >
          <ExtensionSlot :extension="activeTab" />
        </div>
      </SplitterPanel>
    </Splitter>
  </div>
</template>
