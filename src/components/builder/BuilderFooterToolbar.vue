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
      data-testid="builder-footer-nav"
      class="panel-chrome flex items-center gap-2 p-2"
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
      <div class="relative min-w-24">
        <!--
          Invisible sizers: both labels rendered with matching button padding
          so the container's intrinsic width equals the wider label.
          height:0 + overflow:hidden keeps them invisible without affecting height.
        -->
        <div class="max-h-0 overflow-y-hidden" aria-hidden="true">
          <div class="px-4 py-2 text-sm">{{ t('g.save') }}</div>
          <div class="px-4 py-2 text-sm">{{ t('builderToolbar.saveAs') }}</div>
        </div>
        <ConnectOutputPopover
          v-if="!hasOutputs"
          class="w-full"
          :is-select-active="isSelectStep"
          @switch="navigateToStep('builder:outputs')"
        >
          <Button
            size="lg"
            class="w-full"
            :class="disabledSaveClasses"
            data-testid="builder-save-as-button"
          >
            {{ isSaved ? t('g.save') : t('builderToolbar.saveAs') }}
          </Button>
        </ConnectOutputPopover>
        <ButtonGroup
          v-else-if="isSaved"
          data-testid="builder-save-group"
          class="w-full rounded-lg bg-secondary-background has-[[data-save-chevron]:hover]:bg-secondary-background-hover"
        >
          <Button
            size="lg"
            :disabled="!isModified"
            class="flex-1"
            :class="isModified ? activeSaveClasses : disabledSaveClasses"
            data-testid="builder-save-button"
            @click="save()"
          >
            {{ t('g.save') }}
          </Button>
          <DropdownMenuRoot>
            <DropdownMenuTrigger as-child>
              <Button
                size="lg"
                :aria-label="t('builderToolbar.saveAs')"
                data-save-chevron
                data-testid="builder-save-as-chevron"
                class="w-6 rounded-l-none border-l border-border-default px-0"
              >
                <i
                  class="icon-[lucide--chevron-down] size-4"
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                align="end"
                :side-offset="4"
                class="z-1001 min-w-36 rounded-lg border border-border-subtle bg-base-background p-1 shadow-interface"
              >
                <DropdownMenuItem as-child @select="saveAs()">
                  <Button
                    variant="secondary"
                    size="lg"
                    class="w-full justify-start font-normal"
                  >
                    {{ t('builderToolbar.saveAs') }}
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </ButtonGroup>
        <Button
          v-else
          size="lg"
          class="w-full"
          :class="activeSaveClasses"
          data-testid="builder-save-as-button"
          @click="saveAs()"
        >
          {{ t('builderToolbar.saveAs') }}
        </Button>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import ButtonGroup from '@/components/ui/button-group/ButtonGroup.vue'
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

const activeSaveClasses =
  'bg-interface-builder-mode-button-background text-interface-builder-mode-button-foreground hover:bg-interface-builder-mode-button-background/80'
const disabledSaveClasses =
  'bg-secondary-background text-muted-foreground/50 disabled:opacity-100'

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
