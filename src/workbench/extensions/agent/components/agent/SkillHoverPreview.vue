<script setup lang="ts">
import HoverCard from '@/components/ui/hover-card/HoverCard.vue'
import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue'
import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue'
import type { SkillReferenceMetadata } from '../../types/skillReference'

const { skill } = defineProps<{ skill: SkillReferenceMetadata }>()
</script>

<template>
  <HoverCard :open-delay="250" :close-delay="150">
    <HoverCardTrigger as-child><slot /></HoverCardTrigger>
    <HoverCardContent
      side="top"
      align="start"
      :collision-padding="16"
      class="w-62.5 max-w-[calc(100vw-2rem)] rounded-[10px]"
    >
      <div
        role="tooltip"
        :aria-label="`/${skill.name}`"
        class="flex flex-col gap-0.5 text-xs/4 font-normal wrap-anywhere"
      >
        <span class="text-base-foreground">{{ `/${skill.name}` }}</span>
        <span class="whitespace-pre-wrap text-muted-foreground">{{
          skill.description
        }}</span>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
