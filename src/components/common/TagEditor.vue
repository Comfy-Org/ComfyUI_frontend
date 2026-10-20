<script setup lang="ts">
import type { TagsInputRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import TagsInput from '@comfyorg/design-system/tags-input/TagsInput'
import TagsInputInput from '@comfyorg/design-system/tags-input/TagsInputInput'
import TagsInputItem from '@comfyorg/design-system/tags-input/TagsInputItem'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@comfyorg/design-system/tags-input/TagsInputItemText'

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
