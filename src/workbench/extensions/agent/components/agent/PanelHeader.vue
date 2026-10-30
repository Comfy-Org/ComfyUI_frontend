<script setup lang="ts">
import Badge from '@comfyorg/design-system/badge/Badge'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

const { isMaximized = false } = defineProps<{
  isMaximized?: boolean
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
    <div class="flex items-center gap-1">
      <h1
        id="agent-panel-title"
        data-testid="agent-panel-title"
        class="my-0 text-sm font-normal whitespace-nowrap"
      >
        {{ t('agent.title') }}
      </h1>
      <Button
        :tooltip="t('agent.takeTour')"
        tooltip-side="bottom"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.takeTour')"
        class="size-6 shrink-0"
        @click="emit('startTour')"
      >
        <i aria-hidden="true" class="icon-[lucide--info]" />
      </Button>
    </div>
    <Badge
      variant="pill"
      class="border bg-transparent text-xs text-muted-foreground"
    >
      {{ t('agent.beta') }}
    </Badge>

    <div class="ml-auto flex items-center gap-2">
      <Button
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
