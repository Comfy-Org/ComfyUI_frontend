<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  create: [data: { name: string; description: string }]
}>()

const newProject = ref({ name: '', description: '' })

watch(() => newProject.value.name, () => {
  // Reset on close
})

function handleCreate(): void {
  if (!newProject.value.name.trim()) return
  emit('create', { ...newProject.value })
  emit('update:visible', false)
  newProject.value = { name: '', description: '' }
}

function handleClose(): void {
  emit('update:visible', false)
  newProject.value = { name: '', description: '' }
}
</script>

<template>
  <Dialog
    :visible="visible"
    :modal="true"
    :draggable="false"
    :closable="true"
    :style="{ width: '420px' }"
    :pt="{
      root: { class: 'dialog-root' },
      mask: { class: 'dialog-mask' },
      header: { class: 'dialog-header' },
      title: { class: 'dialog-title' },
      headerActions: { class: 'dialog-header-actions' },
      content: { class: 'dialog-content' },
      footer: { class: 'dialog-footer' }
    }"
    @update:visible="$emit('update:visible', $event)"
  >
    <template #header>
      <span class="dialog-title-text">Create Project</span>
    </template>

    <div class="dialog-form">
      <div class="dialog-field">
        <label class="dialog-label">Name</label>
        <InputText
          v-model="newProject.name"
          placeholder="Project name"
          class="dialog-input"
          :pt="{
            root: { class: 'dialog-input-root' }
          }"
          @keyup.enter="handleCreate"
        />
      </div>
      <div class="dialog-field">
        <label class="dialog-label">Description</label>
        <Textarea
          v-model="newProject.description"
          placeholder="Optional description"
          rows="3"
          class="dialog-textarea"
          :pt="{
            root: { class: 'dialog-textarea-root' }
          }"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <button
          class="dialog-btn dialog-btn-secondary"
          @click="handleClose"
        >
          Cancel
        </button>
        <button
          :disabled="!newProject.name.trim()"
          :class="[
            'dialog-btn',
            newProject.name.trim() ? 'dialog-btn-primary' : 'dialog-btn-disabled'
          ]"
          @click="handleCreate"
        >
          Create
        </button>
      </div>
    </template>
  </Dialog>
</template>
