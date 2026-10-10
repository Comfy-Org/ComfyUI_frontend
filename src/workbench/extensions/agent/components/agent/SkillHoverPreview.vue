<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import HoverCard from '@/components/ui/hover-card/HoverCard.vue'
import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue'
import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue'

const { description, unavailable = false } = defineProps<{
  description: string
  unavailable?: boolean
}>()
const { t } = useI18n()
</script>

<template>
  <HoverCard :open-delay="250" :close-delay="150">
    <HoverCardTrigger as-child><slot /></HoverCardTrigger>
    <HoverCardContent
      v-if="description || unavailable"
      side="top"
      align="start"
      :collision-padding="16"
      class="w-62.5 max-w-[calc(100vw-2rem)] rounded-[10px] bg-base-background"
    >
      <div
        role="tooltip"
        class="flex flex-col gap-2 text-xs/4 font-normal wrap-anywhere text-muted-foreground"
      >
        <div v-if="unavailable" class="flex items-start gap-1.5">
          <i
            class="mt-0.5 icon-[lucide--circle-minus] size-3 shrink-0"
            aria-hidden="true"
          />
          <span>{{ t('agent.skillNotAvailable') }}</span>
        </div>
        <span v-else class="whitespace-pre-wrap">{{ description }}</span>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
