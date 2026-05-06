<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'

import AppModeWordmark from './AppModeWordmark.vue'

const { t } = useI18n()
const { setMode } = useAppMode()
const { toastErrorHandler } = useErrorHandling()
const appModeStore = useAppModeStore()
const { hasOutputs, hasNodes } = storeToRefs(appModeStore)

const workflowStore = useWorkflowStore()
const isAppDefault = computed(
  () => workflowStore.activeWorkflow?.initialMode === 'app'
)
const templateSelectorDialog = useWorkflowTemplateSelectorDialog()

// Same command RunCell dispatches; shift = priority queue.
const commandStore = useCommandStore()
async function runFromPill(e: MouseEvent) {
  const commandId = e.shiftKey ? 'Comfy.QueuePromptFront' : 'Comfy.QueuePrompt'
  try {
    await commandStore.execute(commandId, {
      metadata: { subscribe_to_run: false, trigger_source: 'linear' }
    })
  } catch (error) {
    toastErrorHandler(error)
  }
}
</script>

<template>
  <section
    data-testid="linear-welcome"
    :class="[
      'panel-chrome pointer-events-auto absolute z-1 flex flex-col overflow-hidden',
      'top-[calc(var(--spacing-layout-outer)+var(--spacing-layout-cell)+var(--spacing-layout-gutter))]',
      'max-h-[calc(100%-var(--spacing-layout-outer)*2-var(--spacing-layout-cell)*2-var(--spacing-layout-gutter)*2)]',
      'left-(--spacing-layout-outer) w-(--panel-dock-width,440px)'
    ]"
  >
    <header
      class="flex min-h-layout-cell items-center gap-2 border-b border-(--border-color) bg-(--color-layout-header-fill) px-[10px] py-2 select-none"
    >
      <span class="truncate text-layout-md font-semibold text-layout-text">
        {{ t('linearMode.welcome.header') }}
      </span>
    </header>
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <AppModeWordmark
        aria-hidden="true"
        class="h-20 w-auto text-base-foreground"
      />

      <div class="flex flex-col gap-3 text-lg text-muted-foreground">
        <p>{{ t('linearMode.welcome.message') }}</p>
        <p>{{ t('linearMode.welcome.controls') }}</p>
        <p>{{ t('linearMode.welcome.sharing') }}</p>
      </div>

      <p v-if="hasOutputs" class="text-lg text-base-foreground">
        <i18n-t keypath="linearMode.welcome.getStarted" tag="span">
          <template #runButton>
            <Button
              variant="primary"
              size="unset"
              :class="[
                'mx-1 translate-y-px transform px-3 py-1 text-sm',
                'border-0! bg-success-background! hover:brightness-110',
                'text-success-foreground!'
              ]"
              @click="runFromPill"
            >
              <i class="icon-[lucide--play] size-4" />
              {{ t('menu.run') }}
            </Button>
          </template>
        </i18n-t>
      </p>

      <template v-else>
        <p
          v-if="!hasNodes"
          data-testid="linear-welcome-empty-workflow"
          class="max-w-md text-base text-base-foreground"
        >
          {{ t('linearMode.emptyWorkflowExplanation') }}
        </p>
        <p
          v-if="hasNodes && isAppDefault"
          class="max-w-md text-base text-base-foreground"
        >
          <i18n-t keypath="linearMode.welcome.noOutputs" tag="span">
            <template #count>
              <span class="font-bold text-warning-background">
                {{ t('linearMode.welcome.oneOutput') }}
              </span>
            </template>
          </i18n-t>
        </p>
        <div class="flex flex-row gap-2">
          <Button
            data-testid="linear-welcome-back-to-workflow"
            variant="textonly"
            size="lg"
            @click="setMode('graph')"
          >
            {{ t('linearMode.backToWorkflow') }}
          </Button>
          <Button
            v-if="!hasNodes"
            data-testid="linear-welcome-load-template"
            variant="secondary"
            size="lg"
            @click="templateSelectorDialog.show('appbuilder')"
          >
            {{ t('linearMode.loadTemplate') }}
          </Button>
          <Button
            v-else
            data-testid="linear-welcome-build-app"
            variant="primary"
            size="lg"
            @click="appModeStore.enterBuilder()"
          >
            <i class="icon-[lucide--hammer]" />
            {{ t('linearMode.welcome.buildApp') }}
            <div
              class="absolute -top-2 -right-2 rounded-full bg-base-foreground px-1 text-2xs text-base-background"
            >
              {{ t('g.experimental') }}
            </div>
          </Button>
        </div>
      </template>
    </div>
  </section>
</template>
