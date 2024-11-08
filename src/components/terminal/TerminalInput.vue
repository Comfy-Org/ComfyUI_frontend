<template>
  <form @submit.stop.prevent="submit" ref="root">
    <AutoComplete
      class="w-full font-mono"
      v-model="command"
      autoOptionFocus
      :suggestions="items"
      :pt="{
        overlay: {
          class: {
            'pointer-events-none': !items.length,
            'opacity-0': !items.length
          }
        }
      }"
      @option-select="selected"
      @complete="search"
    >
      <template #option="slotProps">
        {{ slotProps.option.substring(1) }}
      </template>
    </AutoComplete>
  </form>
</template>

<script setup lang="ts">
import AutoComplete from 'primevue/autocomplete'
import { ref } from 'vue'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
const root = ref<HTMLFormElement>()
const command = ref('')
const items = ref([])
const emit = defineEmits<{
  output: [string]
  execute: [string]
}>()

const search = (event: { query: string }) => {
  if (event.query?.startsWith('!')) {
    const term = event.query.substring(1).toLocaleLowerCase()
    items.value = commandStore.commands
      .filter(
        (cmd) =>
          cmd.label.toLocaleLowerCase().includes(term) ||
          cmd.id.toLocaleLowerCase().includes(term)
      )
      .map((cmd) => '!' + cmd.id)
      .sort()
  } else {
    items.value = []
  }
}

const submit = () => {
  if (command.value?.trim()) {
    exec(command.value)
  }
}

const exec = (cmd: string) => {
  command.value = ''
  if (cmd.startsWith('!')) {
    const id = cmd.substring(1)
    const comfyCommand = commandStore.getCommand(id)
    if (comfyCommand) {
      commandStore.execute(id)
      emit('output', cmd)
      return
    }
  }

  emit('execute', cmd)
}

const selected = () => {
  exec(command.value)
}

const focus = () => {
  ;(
    root.value.querySelector('.p-autocomplete-input') as HTMLInputElement
  ).focus()
}

defineExpose({ focus })
</script>

<style>
.empty .p-autocomplete-list {
  display: none;
}
</style>
