<script setup lang="ts">
import type { ComponentProps } from 'vue-component-type-helpers'

import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'

type AsyncSearchInputProps = ComponentProps<typeof AsyncSearchInput>

const { searcher, updateKey } = defineProps<{
  searcher?: AsyncSearchInputProps['searcher']
  updateKey?: AsyncSearchInputProps['updateKey']
}>()

const query = defineModel<string>({ default: '' })
</script>

<template>
  <div
    class="flex items-center border-b border-interface-stroke px-4 pt-1 pb-4"
  >
    <AsyncSearchInput
      v-model="query"
      :searcher
      :update-key="updateKey"
      class="flex-1"
    />
    <slot />
  </div>
</template>
