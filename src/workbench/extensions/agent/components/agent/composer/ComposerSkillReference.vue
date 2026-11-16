<script setup lang="ts">
import type { ComposerReference } from '@/workbench/extensions/agent/types/composerPrompt'
import CatalogSkillReference from '@/workbench/extensions/agent/components/agent/CatalogSkillReference.vue'

const { skill } = defineProps<{
  skill: Extract<ComposerReference, { kind: 'skill' }>
}>()
</script>

<template>
  <CatalogSkillReference :skill :scope="skill.scope" />
</template>
