<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import AgentBrand from './AgentBrand.vue'

const {
  isMaximized = false,
  showBrand = true,
  showNewChat = true
} = defineProps<{
  isMaximized?: boolean
  showBrand?: boolean
  showNewChat?: boolean
}>()

const emit = defineEmits<{
  newChat: []
  startTour: []
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
  <header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
    <AgentBrand v-if="showBrand" @start-tour="emit('startTour')" />
    <slot name="lead" />

    <div class="ml-auto flex items-center gap-2">
      <Button
        v-if="showNewChat"
        :tooltip="t('agent.newChat')"
        tooltip-side="bottom"
        variant="muted-textonly"
        size="icon"
        :aria-label="t('agent.newChat')"
        @click="emit('newChat')"
      >
        <i aria-hidden="true" class="icon-[lucide--plus]" />
      </Button>
      <Button
        :tooltip="sizeToggleLabel"
        tooltip-side="bottom"
        variant="muted-textonly"
        size="icon"
        :aria-label="sizeToggleLabel"
        @click="emit('toggleSize')"
      >
        <i aria-hidden="true" :class="sizeToggleIcon" />
      </Button>
      <Button
        :tooltip="t('agent.close')"
        tooltip-side="bottom"
        variant="muted-textonly"
        size="icon"
        :aria-label="t('agent.close')"
        @click="emit('close')"
      >
        <i aria-hidden="true" class="icon-[lucide--x]" />
      </Button>
    </div>
  </header>
</template>
