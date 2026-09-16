<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildTooltipConfig } from '@/composables/useTooltipConfig'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

const { isMaximized = false } = defineProps<{
  isMaximized?: boolean
}>()

const emit = defineEmits<{
  newChat: []
  toggleSize: []
  close: []
}>()

const { t } = useI18n()

const sizeToggleIcon = computed(() =>
  isMaximized ? 'icon-[lucide--minimize-2]' : 'icon-[lucide--maximize-2]'
)
const sizeToggleLabel = computed(() =>
  isMaximized ? t('agent.minimize') : t('agent.maximize')
)
</script>

<template>
  <header
    class="flex h-12 shrink-0 items-center gap-2 border-b border-component-node-border px-4"
  >
    <h1
      id="agent-panel-title"
      class="my-0 text-sm font-normal whitespace-nowrap text-base-foreground"
    >
      {{ t('agent.title') }}
    </h1>
    <span
      class="shrink-0 rounded-full border border-border-default px-2 py-0.5 text-xs text-muted-foreground"
    >
      {{ t('agent.alpha') }}
    </span>

    <div class="ml-auto flex items-center gap-2">
      <Button
        v-tooltip.bottom="buildTooltipConfig(t('agent.newChat'))"
        variant="muted-textonly"
        size="icon"
        class="rounded-xl hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background"
        :aria-label="t('agent.newChat')"
        @click="emit('newChat')"
      >
        <span class="icon-[lucide--message-circle-plus] size-4" />
      </Button>
      <Button
        v-tooltip.bottom="buildTooltipConfig(sizeToggleLabel)"
        variant="muted-textonly"
        size="icon"
        class="rounded-xl hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background"
        :aria-label="sizeToggleLabel"
        @click="emit('toggleSize')"
      >
        <span :class="cn(sizeToggleIcon, 'size-4')" />
      </Button>
      <Button
        v-tooltip.bottom="buildTooltipConfig(t('agent.close'))"
        variant="muted-textonly"
        size="icon"
        class="rounded-xl hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background"
        :aria-label="t('agent.close')"
        @click="emit('close')"
      >
        <span class="icon-[lucide--x] size-4" />
      </Button>
    </div>
  </header>
</template>
