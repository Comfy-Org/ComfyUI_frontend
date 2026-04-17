<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useAppModeStore } from '@/stores/appModeStore'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import AppModeWordmark from './AppModeWordmark.vue'

const { t } = useI18n()
const { setMode } = useAppMode()
const appModeStore = useAppModeStore()
const { hasOutputs, hasNodes, panelPreset } = storeToRefs(appModeStore)

// Which viewport side the panel is docked on. Mirror the welcome copy
// to the opposite side so it stays fully visible — left panel → content
// aligned right, right panel → content aligned left.
const panelSide = computed(() => {
  const p = panelPreset.value
  if (p === 'left-dock' || p === 'float-tl' || p === 'float-bl') return 'left'
  return 'right'
})
const workflowStore = useWorkflowStore()
const isAppDefault = computed(
  () => workflowStore.activeWorkflow?.initialMode === 'app'
)
const templateSelectorDialog = useWorkflowTemplateSelectorDialog()

// Same command the corner RunCell dispatches. Shift-click queues to
// the front of the line; plain click appends.
const commandStore = useCommandStore()
async function runFromPill(e: MouseEvent) {
  const commandId = e.shiftKey ? 'Comfy.QueuePromptFront' : 'Comfy.QueuePrompt'
  try {
    await commandStore.execute(commandId, {
      metadata: { subscribe_to_run: false, trigger_source: 'linear' }
    })
  } catch (error) {
    console.error('[LinearWelcome] Queue prompt failed:', error)
  }
}
</script>

<template>
  <div
    class="size-full"
    :style="{
      paddingLeft: 'var(--welcome-panel-offset-left, 0px)',
      paddingRight: 'var(--welcome-panel-offset-right, 0px)'
    }"
  >
    <div
      role="article"
      data-testid="linear-welcome"
      :class="[
        'flex h-full max-w-2xl flex-col justify-start gap-6 pb-6',
        panelSide === 'left'
          ? 'ml-auto items-end pr-(--layout-outer-padding,16px) pl-6 text-right'
          : 'items-start pr-6 pl-(--layout-outer-padding,16px) text-left'
      ]"
      :style="{
        paddingTop:
          'calc(var(--layout-outer-padding, 16px) + var(--layout-cell-size, 48px) + var(--layout-gutter-min, 8px))'
      }"
    >
      <div class="flex flex-col gap-2">
        <h2 class="sr-only">{{ t('linearMode.welcome.title') }}</h2>
        <AppModeWordmark
          aria-hidden="true"
          class="h-32 w-auto text-base-foreground"
        />
      </div>

      <div
        class="mt-4 flex max-w-2xl flex-col gap-4 text-2xl text-muted-foreground"
      >
        <p class="mt-0">{{ t('linearMode.welcome.message') }}</p>
        <p class="mt-0">{{ t('linearMode.welcome.controls') }}</p>
        <p class="mt-0">{{ t('linearMode.welcome.sharing') }}</p>
      </div>
      <div v-if="hasOutputs" class="flex flex-row gap-2 text-2xl">
        <p class="mt-0 text-base-foreground">
          <i18n-t keypath="linearMode.welcome.getStarted" tag="span">
            <template #runButton>
              <button
                type="button"
                class="mx-1 inline-flex translate-y-px transform cursor-pointer items-center gap-2 rounded-md border-0 px-4 py-1.5 text-xl font-medium outline-none focus:outline-none"
                :style="{
                  backgroundColor: 'var(--layout-color-accent)',
                  color: 'var(--layout-color-accent-foreground)'
                }"
                @click="runFromPill"
              >
                <i class="icon-[lucide--play] size-5" />
                {{ t('menu.run') }}
              </button>
            </template>
          </i18n-t>
        </p>
      </div>
      <template v-else>
        <p
          v-if="!hasNodes"
          data-testid="linear-welcome-empty-workflow"
          class="mt-0 max-w-md text-sm text-base-foreground"
        >
          {{ t('linearMode.emptyWorkflowExplanation') }}
        </p>
        <p
          v-if="hasNodes && isAppDefault"
          class="mt-0 max-w-md text-sm text-base-foreground"
        >
          <i18n-t keypath="linearMode.welcome.noOutputs" tag="span">
            <template #count>
              <span class="font-bold text-warning-background">{{
                t('linearMode.welcome.oneOutput')
              }}</span>
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
  </div>
</template>
