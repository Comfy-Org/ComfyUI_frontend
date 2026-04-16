<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useAppModeStore } from '@/stores/appModeStore'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import AppModeWordmark from './AppModeWordmark.vue'

const { t } = useI18n()
const { setMode } = useAppMode()
const appModeStore = useAppModeStore()
const { hasOutputs, hasNodes } = storeToRefs(appModeStore)
const workflowStore = useWorkflowStore()
const isAppDefault = computed(
  () => workflowStore.activeWorkflow?.initialMode === 'app'
)
const templateSelectorDialog = useWorkflowTemplateSelectorDialog()
</script>

<template>
  <div
    class="size-full"
    :style="{ paddingRight: 'var(--welcome-panel-offset, 0px)' }"
  >
    <div
      role="article"
      data-testid="linear-welcome"
      class="mx-auto flex h-full max-w-2xl flex-col items-start justify-center gap-6 p-6 text-left"
    >
      <div class="flex flex-col gap-2">
        <h2 class="sr-only">{{ t('linearMode.welcome.title') }}</h2>
        <AppModeWordmark
          aria-hidden="true"
          class="h-32 w-auto text-base-foreground"
        />
      </div>

      <div class="flex max-w-2xl flex-col gap-4 text-3xl text-muted-foreground">
        <p class="mt-0">{{ t('linearMode.welcome.message') }}</p>
        <p class="mt-0">{{ t('linearMode.welcome.controls') }}</p>
        <p class="mt-0">{{ t('linearMode.welcome.sharing') }}</p>
      </div>
      <div v-if="hasOutputs" class="flex flex-row gap-2 text-3xl">
        <p class="mt-0 text-base-foreground">
          <i18n-t keypath="linearMode.welcome.getStarted" tag="span">
            <template #runButton>
              <span
                class="mx-1 inline-flex -translate-y-0.5 transform cursor-default items-center rounded-sm px-3 py-1 text-base font-medium"
                :style="{
                  backgroundColor: 'var(--layout-color-accent)',
                  color: 'var(--layout-color-accent-foreground)'
                }"
              >
                {{ t('menu.run') }}
              </span>
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
