<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import LinearGetStarted from '@/renderer/extensions/linearMode/LinearGetStarted.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const { hasOutputs, hasNodes } = storeToRefs(appModeStore)
const showGetStarted = computed(() => !hasOutputs.value && !hasNodes.value)
</script>

<template>
  <LinearGetStarted v-if="showGetStarted" />
  <div
    v-else
    role="article"
    data-testid="linear-welcome"
    class="flex size-full flex-col items-center justify-center p-8 text-center"
  >
    <div class="flex w-full max-w-xl flex-col items-center gap-6">
      <div
        v-if="hasOutputs"
        class="flex w-full flex-col gap-2.5 rounded-2xl bg-base-background p-8 text-left"
      >
        <div
          class="flex size-12 items-center justify-center rounded-xl bg-secondary-background-hover"
        >
          <i class="icon-[lucide--play] size-6 text-base-foreground" />
        </div>
        <div class="flex flex-col gap-2">
          <h2 class="text-3xl font-semibold text-base-foreground">
            {{ t('linearMode.welcome.title') }}
          </h2>
          <p class="text-sm/relaxed text-base-foreground">
            {{ t('linearMode.welcome.description') }}
          </p>
        </div>
      </div>
      <div
        v-else
        class="flex w-full flex-col gap-2.5 rounded-2xl bg-base-background p-8 text-left"
      >
        <div
          class="flex size-12 items-center justify-center rounded-xl bg-secondary-background-hover"
        >
          <i
            class="icon-[lucide--panels-top-left] size-6 text-base-foreground"
          />
        </div>
        <div class="flex flex-col gap-2">
          <h2 class="text-3xl font-semibold text-base-foreground">
            {{ t('linearMode.buildPrompt.title') }}
          </h2>
          <p class="text-sm/relaxed text-base-foreground">
            {{ t('linearMode.buildPrompt.description') }}
          </p>
        </div>
        <Button
          data-testid="linear-welcome-build-app"
          variant="inverted"
          size="lg"
          class="mt-4 w-full"
          @click="appModeStore.enterBuilder()"
        >
          <i class="icon-[lucide--hammer]" />
          {{ t('linearMode.buildPrompt.button') }}
        </Button>
      </div>
    </div>
  </div>
</template>
