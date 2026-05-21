<template>
  <div
    class="fixed bottom-layout-outer left-1/2 z-1000 flex -translate-x-1/2 flex-col items-center"
  >
    <!-- "Opens as" attachment tab -->
    <BuilderOpensAsPopover
      v-if="isSaved"
      :is-app-mode="isAppMode"
      @select="onSetDefaultView"
    />

    <!-- Main toolbar -->
    <nav
      data-testid="builder-footer-nav"
      class="panel-chrome flex h-layout-cell items-center gap-layout-gutter px-layout-gutter"
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
      <!-- Single Save button — "Save As" lives in the top-left builder
           menu (BuilderMenu.vue) so the footer stays clean. Behavior by
           state: no outputs → ConnectOutputPopover prompt; unsaved →
           saveAs() to kick off the first-save dialog; saved → save()
           with isModified gating. -->
      <ConnectOutputPopover
        v-if="!hasOutputs"
        :is-select-active="isSelectStep"
        @switch="navigateToStep('builder:outputs')"
      >
        <Button
          size="lg"
          :class="disabledSaveClasses"
          data-testid="builder-save-as-button"
        >
          {{ isSaved ? t('g.save') : t('builderToolbar.saveAs') }}
        </Button>
      </ConnectOutputPopover>
      <Button
        v-else-if="isSaved"
        size="lg"
        :disabled="!isModified"
        :class="isModified ? activeSaveClasses : disabledSaveClasses"
        data-testid="builder-save-button"
        @click="save()"
      >
        {{ t('g.save') }}
      </Button>
      <Button
        v-else
        size="lg"
        :class="activeSaveClasses"
        data-testid="builder-save-as-button"
        @click="saveAs()"
      >
        {{ t('builderToolbar.saveAs') }}
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

const isSaved = computed(
  () => workflowStore.activeWorkflow?.isTemporary === false
)

// Save has no trailing icon (unlike Next), so the default lg preset's
// 40px height + 16px horizontal padding reads as lopsided. Tighten
// horizontal to 8px and shrink height to 32px so the accent pill feels
// square-balanced rather than a tall rectangle with a short word.
const activeSaveClasses =
  'bg-primary-background text-(--primary-foreground) border border-primary-background-hover ' +
  'hover:bg-primary-background-hover h-8 px-2'
const disabledSaveClasses =
  'bg-secondary-background text-muted-foreground/50 ' +
  'disabled:opacity-100 h-8 px-2'

const isModified = computed(
  () => workflowStore.activeWorkflow?.isModified === true
)

const isAppMode = computed(
  () => workflowStore.activeWorkflow?.initialMode !== 'graph'
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
