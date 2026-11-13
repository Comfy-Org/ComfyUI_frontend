<script setup lang="ts">
import { ref, watch } from 'vue'

import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'

import AgentSkillForm from './AgentSkillForm.vue'
import AgentSkillList from './AgentSkillList.vue'

type ListFocus = 'add' | { pack: string }

const emit = defineEmits<{ back: [] }>()

const skills = useSkillPacksStore()

const editing = ref<{ skill?: SkillPack }>()
const listFocus = ref<ListFocus>()

function closeFormByUser(savedName?: string): void {
  if (!editing.value) return
  const editedName = editing.value.skill?.name
  if (savedName) listFocus.value = { pack: savedName }
  else if (editedName) listFocus.value = { pack: editedName }
  else listFocus.value = 'add'
  editing.value = undefined
}

watch([() => skills.scope, () => skills.enabled], () => {
  listFocus.value = undefined
  editing.value = undefined
})
</script>

<template>
  <AgentSkillForm
    v-if="editing"
    :skill="editing.skill"
    @close="closeFormByUser"
  />
  <AgentSkillList
    v-else
    :initial-focus="listFocus"
    @back="emit('back')"
    @add="editing = {}"
    @edit="(skill) => (editing = { skill })"
  />
</template>
