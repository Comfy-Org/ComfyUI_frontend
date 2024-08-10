<template>
  <IconField :class="props.class">
    <InputIcon class="pi pi-search" />
    <InputText
      class="search-box-input"
      @input="handleInput"
      :modelValue="props.modelValue"
      :placeholder="$t('searchSettings') + '...'"
    />
  </IconField>
</template>

<script setup lang="ts">
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { debounce } from 'lodash'

const props = defineProps<{
  class?: string
  modelValue: string
}>()
const emit = defineEmits(['update:modelValue', 'search'])
const emitSearch = debounce((event: KeyboardEvent) => {
  const target = event.target as HTMLInputElement
  emit('search', target.value)
}, 300)

const handleInput = (event: KeyboardEvent) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  emitSearch(event)
}
</script>

<style scoped>
.search-box-input {
  width: 100%;
}
</style>
