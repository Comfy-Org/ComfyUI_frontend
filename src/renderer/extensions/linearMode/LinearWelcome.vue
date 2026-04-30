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
import { getPathDetails } from '@/utils/formatUtil'

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

const headerTitle = computed(() => {
  const path = workflowStore.activeWorkflow?.path
  return path ? getPathDetails(path).filename : t('linearMode.welcome.title')
})

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
  <div class="absolute inset-0 flex items-center justify-center p-6">
    <section
      data-testid="linear-welcome"
      class="panel-chrome flex max-w-sm flex-col overflow-hidden"
    >
      <header
        class="flex min-h-layout-cell items-center gap-2 border-b border-white/8 bg-(--color-layout-header-fill) px-[10px] py-2 select-none"
      >
        <span class="truncate text-layout-md font-semibold text-layout-text">
          {{ headerTitle }}
        </span>
      </header>
      <div class="flex flex-col gap-4 p-6">
        <AppModeWordmark
          aria-hidden="true"
          class="h-20 w-auto text-base-foreground"
        />

        <div class="flex flex-col gap-3 text-base text-muted-foreground">
          <p>{{ t('linearMode.welcome.message') }}</p>
          <p>{{ t('linearMode.welcome.controls') }}</p>
          <p>{{ t('linearMode.welcome.sharing') }}</p>
        </div>

        <p v-if="hasOutputs" class="text-base text-base-foreground">
          <i18n-t keypath="linearMode.welcome.getStarted" tag="span">
            <template #runButton>
              <Button
                variant="primary"
                size="unset"
                :class="[
                  'mx-1 translate-y-px transform px-3 py-1 text-sm',
                  'border-[#166534]! bg-[#16a34a]! hover:bg-[#22c55e]!',
                  'text-white!'
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
            class="max-w-md text-sm text-base-foreground"
          >
            {{ t('linearMode.emptyWorkflowExplanation') }}
          </p>
          <p
            v-if="hasNodes && isAppDefault"
            class="max-w-md text-sm text-base-foreground"
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
  </div>
</template>
