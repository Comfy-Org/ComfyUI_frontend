<script setup lang="ts">
import type { SkillReferenceMetadata } from '../../types/skillReference'
import SkillHoverPreview from './SkillHoverPreview.vue'

const { skill } = defineProps<{ skill: SkillReferenceMetadata }>()
</script>

<template>
  <SkillHoverPreview :skill>
    <span
      data-testid="skill-reference"
      tabindex="0"
      class="cursor-pointer text-warning-background underline underline-offset-2"
      >{{ `/${skill.name}` }}</span
    >
  </SkillHoverPreview>
</template>
