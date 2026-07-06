<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
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

const card = computed(() =>
  hasOutputs.value
    ? {
        icon: 'icon-[lucide--play]',
        title: t('linearMode.welcome.title'),
        description: t('linearMode.welcome.description')
      }
    : {
        icon: 'icon-[lucide--panels-top-left]',
        title: t('linearMode.buildPrompt.title'),
        description: t('linearMode.buildPrompt.description')
      }
)
</script>

<template>
  <LinearGetStarted v-if="showGetStarted" />
  <div
    v-else
    role="article"
    data-testid="linear-welcome"
    class="flex size-full flex-col items-center justify-center p-8 text-center"
  >
    <div class="flex w-full max-w-md flex-col items-center gap-6">
      <div
        class="flex w-full flex-col gap-5 rounded-2xl border border-border-subtle bg-base-background p-5 text-left"
      >
        <div
          class="flex size-12 items-center justify-center rounded-xl bg-secondary-background-hover"
        >
          <i :class="cn(card.icon, 'size-6 text-base-foreground')" />
        </div>
        <h2 class="m-0 p-0 text-xl font-semibold text-base-foreground">
          {{ card.title }}
        </h2>
        <p class="m-0 p-0 text-sm/relaxed text-base-foreground">
          {{ card.description }}
        </p>
        <Button
          v-if="!hasOutputs"
          data-testid="linear-welcome-build-app"
          variant="inverted"
          size="lg"
          class="w-full"
          @click="appModeStore.enterBuilder()"
        >
          <i class="icon-[lucide--hammer]" />
          {{ t('linearMode.buildPrompt.button') }}
        </Button>
      </div>
    </div>
  </div>
</template>
