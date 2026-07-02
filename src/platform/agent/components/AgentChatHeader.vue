<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

const { isMaximized } = defineProps<{
  isMaximized: boolean
}>()

const emit = defineEmits<{
  newChat: []
  toggleMaximize: []
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
  <div
    class="flex h-12 shrink-0 items-center justify-between border-b border-component-node-border px-4"
  >
    <div class="flex items-center gap-2">
      <span class="text-sm text-base-foreground">{{ $t('agent.title') }}</span>
      <span
        class="rounded-full border border-border-default px-2 py-0.5 text-xs text-muted-foreground"
      >
        {{ $t('agent.alpha') }}
      </span>
    </div>
    <div class="flex items-center gap-1">
      <Tooltip :delay-duration="300">
        <TooltipTrigger>
          <Button
            variant="textonly"
            size="icon"
            :aria-label="$t('agent.newChat')"
            @click="emit('newChat')"
          >
            <i
              class="icon-[lucide--message-circle-plus] size-4 text-muted-foreground"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{{ $t('agent.newChat') }}</TooltipContent>
      </Tooltip>
      <Tooltip :delay-duration="300">
        <TooltipTrigger>
          <Button
            variant="textonly"
            size="icon"
            :aria-label="sizeToggleLabel"
            @click="emit('toggleMaximize')"
          >
            <i :class="`${sizeToggleIcon} size-4 text-muted-foreground`" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="whitespace-nowrap">
          {{ sizeToggleLabel }}
        </TooltipContent>
      </Tooltip>
      <Tooltip :delay-duration="300">
        <TooltipTrigger>
          <Button
            variant="textonly"
            size="icon"
            :aria-label="$t('g.close')"
            @click="emit('close')"
          >
            <i class="icon-[lucide--x] size-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{{ $t('g.close') }}</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
