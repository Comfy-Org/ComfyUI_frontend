<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppModeStore } from '@/stores/appModeStore'
import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()
const appModeStore = useAppModeStore()
</script>

<template>
  <div
    role="article"
    data-testid="linear-welcome"
    class="flex flex-col items-center justify-center h-full gap-6 p-8 max-w-lg mx-auto text-center"
  >
    <div class="flex flex-col gap-2">
      <h2 class="text-3xl font-semibold text-muted-foreground">
        {{ t('linearMode.welcome.title') }}
      </h2>
    </div>

    <div class="flex flex-col gap-3 text-muted-foreground max-w-md text-[14px]">
      <p class="mt-0">{{ t('linearMode.welcome.message') }}</p>
      <p class="mt-0">{{ t('linearMode.welcome.controls') }}</p>
      <p class="mt-0">{{ t('linearMode.welcome.sharing') }}</p>
    </div>
    <div class="flex flex-row gap-2">
      <Button
        variant="textonly"
        size="lg"
        @click="appModeStore.setMode('graph')"
      >
        {{ t('linearMode.welcome.backToWorkflow') }}
      </Button>
      <Button
        variant="primary"
        size="lg"
        @click="appModeStore.setMode('builder:select')"
      >
        <i class="icon-[lucide--hammer]" />
        {{ t('linearMode.welcome.buildApp') }}
        <div
          class="bg-base-foreground text-base-background text-xxs rounded-full absolute -top-2 -right-2 px-1"
        >
          {{ t('g.experimental') }}
        </div>
      </Button>
    </div>
  </div>
</template>
