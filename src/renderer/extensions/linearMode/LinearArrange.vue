<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import Button from '@/components/ui/button/Button.vue'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const { setMode } = useAppMode()
const { hasOutputs } = storeToRefs(useAppModeStore())
</script>

<template>
  <div
    v-if="hasOutputs"
    role="article"
    data-testid="arrange-preview"
    class="mx-auto flex h-full w-3/4 flex-col items-center justify-center gap-6 p-8"
  >
    <div
      class="flex h-4/5 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-warning-background p-12"
    >
      <p class="mb-0 font-bold text-base-foreground">
        {{ t('linearMode.arrange.outputs') }}
      </p>
      <p>{{ t('linearMode.arrange.resultsLabel') }}</p>
    </div>
  </div>
  <div
    v-else
    role="article"
    data-testid="arrange-no-outputs"
    class="mx-auto flex h-full w-lg flex-col items-center justify-center gap-6 p-8 text-center"
  >
    <p class="m-0 text-base-foreground">
      {{ t('linearMode.arrange.noOutputs') }}
    </p>

    <div class="flex w-lg flex-col gap-1 text-[14px] text-muted-foreground">
      <p class="mt-0 p-0">{{ t('linearMode.arrange.switchToOutputs') }}</p>

      <i18n-t keypath="linearMode.arrange.connectAtLeastOne" tag="div">
        <template #atLeastOne>
          <span class="font-bold italic">
            {{ t('linearMode.arrange.atLeastOne') }}
          </span>
        </template>
      </i18n-t>

      <p class="mt-0 p-0">{{ t('linearMode.arrange.outputExamples') }}</p>
    </div>
    <div class="flex flex-row gap-2">
      <Button variant="primary" size="lg" @click="setMode('builder:outputs')">
        {{ t('linearMode.arrange.switchToOutputsButton') }}
      </Button>
    </div>
  </div>
</template>
