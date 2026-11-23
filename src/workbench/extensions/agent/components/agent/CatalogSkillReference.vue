<script setup lang="ts">
import { computed } from 'vue'
import { useBuiltinSkillsStore } from '@/platform/skills/stores/builtinSkillsStore'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillReferenceMetadata } from '@/workbench/extensions/agent/types/skillReference'
import SkillReference from './SkillReference.vue'

const { skill, scope } = defineProps<{
  skill: SkillReferenceMetadata
  scope?: string
}>()
const skills = useSkillPacksStore()
const builtinSkills = useBuiltinSkillsStore()
const builtinCatalogSettled = computed(
  () =>
    !builtinSkills.routesAvailable ||
    builtinSkills.catalogConfirmed ||
    (!builtinSkills.catalogRequested &&
      !builtinSkills.loading &&
      !builtinSkills.loadFailed)
)
const unavailable = computed(
  () =>
    (scope === undefined || scope === skills.scope) &&
    skills.enabled &&
    skills.catalogConfirmed &&
    builtinCatalogSettled.value &&
    !skills.packs.some((pack) => pack.name === skill.name) &&
    !builtinSkills.skills.some((item) => item.name === skill.name)
)
</script>

<template>
  <SkillReference :skill :unavailable />
</template>
