<template>
  <IconField :class="props.class">
    <InputIcon :class="props.icon" />
    <InputText
      class="search-box-input"
      @input="handleInput"
      :modelValue="props.modelValue"
      :placeholder="props.placeholder"
    />
  </IconField>
</template>

<script setup lang="ts">
import { debounce } from 'lodash'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'

interface Props {
  class?: string
  modelValue: string
  placeholder?: string
  icon?: string
  debounceTime?: number
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search...',
  icon: 'pi pi-search',
  debounceTime: 300
})

const emit = defineEmits(['update:modelValue', 'search'])

const emitSearch = debounce((value: string) => {
  emit('search', value)
}, props.debounceTime)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  emitSearch(target.value)
}
</script>

<style scoped>
.search-box-input {
  width: 100%;
}
</style>
