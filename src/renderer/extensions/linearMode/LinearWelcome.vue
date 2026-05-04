<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useAppModeStore } from '@/stores/appModeStore'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

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
    role="article"
    data-testid="linear-welcome"
    class="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-6 p-8 text-center"
  >
    <div class="flex flex-col gap-2">
      <h2 class="text-3xl font-semibold text-muted-foreground">
        {{ t('linearMode.welcome.title') }}
      </h2>
    </div>

    <div class="flex max-w-md flex-col gap-3 text-[14px] text-muted-foreground">
      <p class="mt-0">{{ t('linearMode.welcome.message') }}</p>
      <p class="mt-0">{{ t('linearMode.welcome.controls') }}</p>
      <p class="mt-0">{{ t('linearMode.welcome.sharing') }}</p>
    </div>
    <div v-if="hasOutputs" class="flex flex-row gap-2 text-[14px]">
      <p class="mt-0 text-base-foreground">
        <i18n-t keypath="linearMode.welcome.getStarted" tag="span">
          <template #runButton>
            <span
              class="mx-0.5 inline-flex -translate-y-0.5 transform cursor-default items-center rounded-sm bg-primary-background px-3.5 py-0.5 text-2xs font-medium text-base-foreground"
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
</template>
