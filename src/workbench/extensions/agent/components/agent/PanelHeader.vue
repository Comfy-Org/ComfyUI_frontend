<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
    class="border-agent-border flex h-12 shrink-0 items-center gap-2 border-b px-4"
  >
    <h1 class="text-agent-fg my-0 text-sm font-normal whitespace-nowrap">
      {{ t('agent.title') }}
    </h1>
    <span
      class="border-agent-border-strong text-agent-fg-muted shrink-0 rounded-full border px-2 py-0.5 text-xs"
    >
      {{ t('agent.alpha') }}
    </span>

    <div class="ml-auto flex items-center gap-1">
      <Button
        v-tooltip.bottom="{ value: t('agent.newChat'), showDelay: 300 }"
        variant="muted-textonly"
        size="icon"
        class="hover:text-agent-fg focus-visible:ring-agent-accent rounded-xl focus-visible:ring-2"
        :aria-label="t('agent.newChat')"
        @click="emit('newChat')"
      >
        <span class="icon-[lucide--message-circle-plus] size-4" />
      </Button>
      <Button
        v-tooltip.bottom="{ value: sizeToggleLabel, showDelay: 300 }"
        variant="muted-textonly"
        size="icon"
        class="hover:text-agent-fg focus-visible:ring-agent-accent rounded-xl focus-visible:ring-2"
        :aria-label="sizeToggleLabel"
        @click="emit('toggleSize')"
      >
        <span :class="cn(sizeToggleIcon, 'size-4')" />
      </Button>
      <Button
        v-tooltip.bottom="{ value: t('agent.close'), showDelay: 300 }"
        variant="muted-textonly"
        size="icon"
        class="hover:text-agent-fg focus-visible:ring-agent-accent rounded-xl focus-visible:ring-2"
        :aria-label="t('agent.close')"
        @click="emit('close')"
      >
        <span class="icon-[lucide--x] size-4" />
      </Button>
    </div>
  </header>
</template>
