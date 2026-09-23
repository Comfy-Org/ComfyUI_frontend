<script setup lang="ts">
import type { ComponentProps } from 'vue-component-type-helpers'

import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'

type AsyncSearchInputProps = ComponentProps<typeof AsyncSearchInput>

const { searcher, updateKey } = defineProps<{
  searcher?: AsyncSearchInputProps['searcher']
  updateKey?: AsyncSearchInputProps['updateKey']
}>()

const emit = defineEmits<{
  enter: [event: KeyboardEvent]
}>()

const query = defineModel<string>({ default: '' })

defineOptions({ inheritAttrs: false })
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
      @enter="emit('enter', $event)"
    />
    <slot />
  </div>
</template>
