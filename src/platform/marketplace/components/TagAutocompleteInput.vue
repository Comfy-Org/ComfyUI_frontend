<template>
  <ComboboxRoot
    v-model="modelValue"
    v-model:search-term="searchTerm"
    multiple
    :filter-function="filterFunction"
    :display-value="() => searchTerm"
    class="relative"
  >
    <TagsInput
      v-slot="{ isEmpty }"
      v-model="modelValue"
      :disabled="false"
      class="rounded-lg bg-secondary-background"
    >
      <TagsInputItem v-for="tag in modelValue" :key="tag" :value="tag">
        <TagsInputItemText />
        <TagsInputItemDelete />
      </TagsInputItem>
      <ComboboxInput as-child>
        <TagsInputInput :is-empty="isEmpty" :placeholder="placeholder" />
      </ComboboxInput>
    </TagsInput>

    <ComboboxContent
      :class="
        cn(
          'absolute z-10 mt-1 w-full rounded-lg py-1',
          'bg-base-background',
          'border border-solid border-border-default',
          'shadow-lg'
        )
      "
    >
      <ComboboxViewport class="max-h-40 overflow-y-auto">
        <ComboboxEmpty class="px-3 py-2 text-sm text-muted-foreground">
          {{ searchTerm ? t('g.noResults') : '' }}
        </ComboboxEmpty>
        <ComboboxItem
          v-for="suggestion in suggestions"
          :key="suggestion"
          :value="suggestion"
          :class="
            cn(
              'flex cursor-pointer items-center px-3 py-1.5 text-sm',
              'data-[highlighted]:bg-secondary-background-hover',
              'rounded-md mx-1'
            )
          "
        >
          {{ suggestion }}
        </ComboboxItem>
      </ComboboxViewport>
    </ComboboxContent>
  </ComboboxRoot>
</template>

<script setup lang="ts">
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxViewport
} from 'reka-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import { cn } from '@/utils/tailwindUtil'

import { suggestTags } from '../services/tagApi'

const { placeholder = '' } = defineProps<{
  placeholder?: string
}>()

const modelValue = defineModel<string[]>({ required: true })

const { t } = useI18n()
const searchTerm = ref('')
const suggestions = ref<string[]>([])

watch(searchTerm, async (query) => {
  const { tags } = await suggestTags(query)
  suggestions.value = tags.filter((tag) => !modelValue.value.includes(tag))
})

function filterFunction(options: string[]) {
  return options
}
</script>
