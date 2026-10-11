<script setup lang="ts">
import { computed } from 'vue'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillReferenceMetadata } from '../../types/skillReference'
import SkillReference from './SkillReference.vue'

const { skill, scope } = defineProps<{
  skill: SkillReferenceMetadata
  scope?: string
}>()
const skills = useSkillPacksStore()
const unavailable = computed(
  () =>
    (scope === undefined || scope === skills.scope) &&
    skills.enabled &&
    skills.catalogConfirmed &&
    !skills.packs.some((pack) => pack.name === skill.name)
)
</script>

<template>
  <SkillReference :skill :unavailable />
</template>
