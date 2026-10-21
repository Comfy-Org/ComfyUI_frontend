<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef } from 'vue'

import HoverCard from '@/components/ui/hover-card/HoverCard.vue'
import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue'
import type { SkillReferenceMetadata } from '@/workbench/extensions/agent/types/skillReference'

const { id, skill, anchor } = defineProps<{
  id: string
  skill?: SkillReferenceMetadata
  anchor: HTMLElement | null
}>()
const emit = defineEmits<{
  enter: []
  leave: []
  focusout: [event: FocusEvent]
  releaseFocus: []
  dismiss: []
}>()

const card = useTemplateRef<HTMLDivElement>('card')
onBeforeUnmount(() => {
  if (card.value?.contains(document.activeElement)) emit('releaseFocus')
})
</script>

<template>
  <HoverCard v-if="skill && anchor" open>
    <HoverCardContent
      as-child
      :reference="anchor"
      side="top"
      align="end"
      :side-offset="6"
      :collision-padding="16"
      class="w-62.5 max-w-[calc(100vw-2rem)] before:absolute before:inset-x-0 before:h-1.5 data-[side=bottom]:before:bottom-full data-[side=top]:before:top-full"
    >
      <div
        :id
        ref="card"
        tabindex="-1"
        class="text-xs/4 font-normal wrap-anywhere whitespace-pre-wrap text-muted-foreground outline-none select-text"
        @mouseenter="emit('enter')"
        @mouseleave="emit('leave')"
        @focusout="emit('focusout', $event)"
        @keydown.esc.stop="emit('dismiss')"
      >
        {{ skill.description }}
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
