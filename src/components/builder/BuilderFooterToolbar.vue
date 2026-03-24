<template>
  <div
    class="fixed bottom-4 left-1/2 z-1000 flex -translate-x-1/2 flex-col items-center"
  >
    <!-- "Opens as" attachment tab -->
    <BuilderOpensAsPopover
      v-if="isSaved"
      :is-app-mode="isAppMode"
      @select="onSetDefaultView"
    />

    <!-- Main toolbar -->
    <nav
      class="flex items-center gap-2 rounded-2xl border border-border-default bg-base-background p-2 shadow-interface"
    >
      <Button variant="textonly" size="lg" @click="onExitBuilder">
        {{ t('builderMenu.exitAppBuilder') }}
      </Button>
      <Button variant="secondary" size="lg" @click="onViewApp">
        {{ t('builderToolbar.viewApp') }}
      </Button>
      <Button
        variant="textonly"
        size="lg"
        :disabled="isFirstStep"
        @click="goBack"
      >
        <i class="icon-[lucide--chevron-left]" aria-hidden="true" />
        {{ t('g.back') }}
      </Button>
      <Button size="lg" :disabled="isLastStep" @click="goNext">
        {{ t('g.next') }}
        <i class="icon-[lucide--chevron-right]" aria-hidden="true" />
      </Button>
      <ConnectOutputPopover
        v-if="!hasOutputs"
        :is-select-active="isSelectStep"
        @switch="navigateToStep('builder:outputs')"
      >
        <Button
          size="lg"
          class="bg-interface-builder-mode-button-background text-interface-builder-mode-button-foreground opacity-50 hover:bg-interface-builder-mode-button-background/80"
        >
          {{ saveButtonLabel }}
        </Button>
      </ConnectOutputPopover>
      <Button
        v-else
        size="lg"
        class="bg-interface-builder-mode-button-background text-interface-builder-mode-button-foreground hover:bg-interface-builder-mode-button-background/80"
        @click="isSaved ? save() : saveAs()"
      >
        {{ saveButtonLabel }}
      </Button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useDialogStore } from '@/stores/dialogStore'

import BuilderOpensAsPopover from './BuilderOpensAsPopover.vue'
import { setWorkflowDefaultView } from './builderViewOptions'
import ConnectOutputPopover from './ConnectOutputPopover.vue'
import { useBuilderSave } from './useBuilderSave'
import { useBuilderSteps } from './useBuilderSteps'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const dialogStore = useDialogStore()
const workflowStore = useWorkflowStore()
const { isBuilderMode, setMode } = useAppMode()
const { hasOutputs } = storeToRefs(appModeStore)
const {
  isFirstStep,
  isLastStep,
  isSelectStep,
  navigateToStep,
  goBack,
  goNext
} = useBuilderSteps({
  hasOutputs
})
const { save, saveAs } = useBuilderSave()

const isSaved = computed(() => !workflowStore.activeWorkflow?.isTemporary)

const isAppMode = computed(
  () => workflowStore.activeWorkflow?.initialMode !== 'graph'
)

const saveButtonLabel = computed(() =>
  isSaved.value ? t('g.save') : t('builderToolbar.saveAs')
)

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (
    e.key === 'Escape' &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey &&
    dialogStore.dialogStack.length === 0 &&
    isBuilderMode.value
  ) {
    e.preventDefault()
    e.stopPropagation()
    onExitBuilder()
  }
})

function onExitBuilder() {
  appModeStore.exitBuilder()
}

function onViewApp() {
  setMode('app')
}

function onSetDefaultView(openAsApp: boolean) {
  const workflow = workflowStore.activeWorkflow
  if (!workflow) return
  setWorkflowDefaultView(workflow, openAsApp)
}
</script>
