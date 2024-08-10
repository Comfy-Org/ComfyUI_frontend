<template>
  <IconField :class="props.class">
    <InputIcon class="pi pi-search" />
    <InputText
      class="search-box-input"
      v-model="searchQuery"
      :placeholder="$t('searchSettings') + '...'"
      @input="emitSearch"
    />
  </IconField>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { debounce } from 'lodash'

const searchQuery = ref<string>('')

const props = defineProps<{
  class?: string
}>()
const emit = defineEmits(['search'])
const emitSearch = debounce(() => {
  emit('search', searchQuery.value)
}, 300)
</script>

<style scoped>
.search-box-input {
  width: 100%;
}
</style>
