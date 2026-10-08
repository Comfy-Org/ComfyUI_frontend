<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef } from 'vue'

import HoverCard from '@/components/ui/hover-card/HoverCard.vue'
import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue'
import type { SkillReferenceMetadata } from '../../../types/skillReference'

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
}>()

const card = useTemplateRef<HTMLDivElement>('card')
onBeforeUnmount(() => {
  if (card.value?.contains(document.activeElement)) emit('releaseFocus')
})
</script>

<template>
  <HoverCard v-if="skill && anchor" open>
    <HoverCardContent
      :reference="anchor"
      side="top"
      align="end"
      :side-offset="0"
      :collision-padding="16"
      class="border-0 bg-transparent p-0 shadow-none"
    >
      <div
        class="pb-1.5"
        @mouseenter="emit('enter')"
        @mouseleave="emit('leave')"
      >
        <div
          :id
          ref="card"
          tabindex="-1"
          class="w-62.5 max-w-[calc(100vw-2rem)] rounded-[10px] border border-border-subtle bg-base-background p-2.5 text-xs/4 font-normal wrap-anywhere whitespace-pre-wrap text-muted-foreground shadow-md outline-none select-text"
          @focusout="emit('focusout', $event)"
        >
          {{ skill.description }}
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
