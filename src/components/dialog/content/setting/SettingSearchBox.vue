<template>
  <IconField :class="props.class">
    <InputIcon class="pi pi-search" />
    <InputText
      class="search-box-input"
      v-model="searchQuery"
      :placeholder="$t('searchSettings')"
    />
  </IconField>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'

const searchQuery = ref<string>('')

const props = defineProps<{
  class?: string
}>()
</script>

<style scoped>
.search-box-input {
  width: 100%;
}
</style>
