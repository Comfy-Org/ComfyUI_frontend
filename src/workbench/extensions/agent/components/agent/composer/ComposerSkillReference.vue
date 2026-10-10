<script setup lang="ts">
import type { ComposerReference } from '../../../types/composerPrompt'
import CatalogSkillReference from '../CatalogSkillReference.vue'

const { skill } = defineProps<{
  skill: Extract<ComposerReference, { kind: 'skill' }>
}>()
</script>

<template>
  <CatalogSkillReference :skill :scope="skill.scope" />
</template>
