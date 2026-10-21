<script setup lang="ts">
import type { TagsInputRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'

const { placeholder, itemClass, ...rootProps } = defineProps<
  Omit<TagsInputRootProps<string>, 'modelValue' | 'defaultValue'> & {
    alwaysEditing?: boolean
    placeholder?: string
    itemClass?:
      | HTMLAttributes['class']
      | ((value: string) => HTMLAttributes['class'])
  }
>()
const tags = defineModel<string[]>({ default: () => [] })
const { t } = useI18n()
</script>

<template>
  <TagsInput v-slot="{ isEmpty }" v-model="tags" v-bind="rootProps">
    <TagsInputItem
      v-for="tag in tags"
      :key="tag"
      :value="tag"
      :class="typeof itemClass === 'function' ? itemClass(tag) : itemClass"
    >
      <TagsInputItemText />
      <TagsInputItemDelete :aria-label="t('g.removeTag')" />
    </TagsInputItem>
    <slot name="input" :is-empty>
      <TagsInputInput :is-empty :placeholder />
    </slot>
  </TagsInput>
</template>
