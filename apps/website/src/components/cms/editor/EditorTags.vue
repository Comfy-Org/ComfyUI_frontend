<script setup lang="ts">
import { X } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import {
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
  TagsInputRoot
} from 'reka-ui'
import { computed } from 'vue'

import { fieldClass } from '@/components/cms/ui/field'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** Tags as chips: Enter or a comma adds one, Backspace removes the last. */
const { label, locale = 'en' } = defineProps<{
  label: string
  locale?: Locale
}>()
const tags = defineModel<string>({ required: true })
const { t } = translationsFor(locale)
const list = computed({
  get: () =>
    tags.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  set: (value: string[]) => {
    tags.value = value.join(', ')
  }
})
</script>

<template>
  <TagsInputRoot
    v-model="list"
    add-on-paste
    add-on-blur
    delimiter=","
    :class="
      cn(
        fieldClass,
        'flex min-h-9.5 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-admin-control'
      )
    "
  >
    <TagsInputItem
      v-for="tag in list"
      :key="tag"
      :value="tag"
      class="inline-flex h-6 items-center gap-1 rounded-md bg-admin-line pr-1 pl-2 text-xs text-admin-fg data-[state=active]:outline-1 data-[state=active]:outline-admin-control"
    >
      <TagsInputItemText />
      <TagsInputItemDelete
        :aria-label="t('cmsAdmin.editor.removeTag', { tag })"
        class="flex cursor-pointer rounded-sm text-admin-muted hover:text-admin-fg"
      >
        <X class="size-3" />
      </TagsInputItemDelete>
    </TagsInputItem>
    <TagsInputInput
      :aria-label="label"
      :placeholder="list.length ? '' : t('cmsAdmin.editor.tagsPlaceholder')"
      class="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-admin-subtle"
    />
  </TagsInputRoot>
</template>
