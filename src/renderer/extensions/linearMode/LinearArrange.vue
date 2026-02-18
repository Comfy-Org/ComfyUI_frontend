<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppModeStore } from '@/stores/appModeStore'
import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()
const appModeStore = useAppModeStore()
</script>

<template>
  <div
    v-if="appModeStore.hasOutputs"
    role="article"
    data-testid="arrange-no-outputs"
    class="flex flex-col items-center justify-center h-full gap-6 p-8 w-lg mx-auto text-center"
  >
    <p class="m-0 text-base-foreground">
      {{ t('linearMode.arrange.noOutputs') }}
    </p>

    <div class="flex flex-col gap-1 text-muted-foreground w-lg text-[14px]">
      <p class="mt-0 p-0">{{ t('linearMode.arrange.switchToSelect') }}</p>

      <i18n-t keypath="linearMode.arrange.connectAtLeastOne" tag="div">
        <template #atLeastOne>
          <span class="italic font-bold">
            {{ t('linearMode.arrange.atLeastOne') }}
          </span>
        </template>
      </i18n-t>

      <p class="mt-0 p-0">{{ t('linearMode.arrange.outputExamples') }}</p>
    </div>
    <div class="flex flex-row gap-2">
      <Button
        variant="primary"
        size="lg"
        @click="appModeStore.setMode('builder:select')"
      >
        {{ t('linearMode.arrange.switchToSelectButton') }}
      </Button>
    </div>
  </div>
</template>
