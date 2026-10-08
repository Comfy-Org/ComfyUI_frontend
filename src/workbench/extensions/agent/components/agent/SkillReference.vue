<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import type { SkillReferenceMetadata } from '../../types/skillReference'
import SkillHoverPreview from './SkillHoverPreview.vue'

const { skill, unavailable = false } = defineProps<{
  skill: SkillReferenceMetadata
  unavailable?: boolean
}>()
const { t } = useI18n()
</script>

<template>
  <SkillHoverPreview :description="skill.description" :unavailable>
    <span
      data-testid="skill-reference"
      data-comfy-skill="1"
      :data-skill-name="skill.name"
      :data-skill-description="skill.description"
      tabindex="0"
      :aria-description="unavailable ? t('agent.skillNotAvailable') : undefined"
      :class="
        cn(
          'cursor-pointer underline underline-offset-2',
          unavailable ? 'text-muted-foreground' : 'text-warning-background'
        )
      "
      >{{ `/${skill.name}` }}</span
    >
  </SkillHoverPreview>
</template>
