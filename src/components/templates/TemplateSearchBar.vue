<template>
  <div class="relative w-full p-4">
    <div class="h-12 flex items-center gap-4 justify-between">
      <div class="flex-1 max-w-md">
        <AutoComplete
          v-model.lazy="searchQuery"
          :placeholder="$t('templateWorkflows.searchPlaceholder')"
          :complete-on-focus="false"
          :delay="200"
          class="w-full"
          :pt="{
            pcInputText: {
              root: {
                class: 'w-full rounded-2xl'
              }
            },
            loader: {
              style: 'display: none'
            }
          }"
          :show-empty-message="false"
          @complete="() => {}"
        />
      </div>
    </div>

    <div class="flex items-center gap-4 mt-2">
      <small
        v-if="searchQuery && filteredCount !== null"
        class="text-color-secondary"
      >
        {{ $t('g.resultsCount', { count: filteredCount }) }}
      </small>
      <Button
        v-if="searchQuery"
        text
        size="small"
        icon="pi pi-times"
        :label="$t('g.clearFilters')"
        @click="clearFilters"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'

const { filteredCount } = defineProps<{
  filteredCount?: number | null
}>()

const searchQuery = defineModel<string>('searchQuery', { default: '' })

const emit = defineEmits<{
  clearFilters: []
}>()

const clearFilters = () => {
  searchQuery.value = ''
  emit('clearFilters')
}
</script>
