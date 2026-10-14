<script setup lang="ts">
import { X } from '@lucide/vue'
import {
  TagsInputInput,
  TagsInputItem,
  TagsInputItemText,
  TagsInputRoot
} from 'reka-ui'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  label,
  disabled = false,
  locale = 'en'
} = defineProps<{
  label: string
  disabled?: boolean
  locale?: Locale
}>()
const tags = defineModel<string[]>({ required: true })
const { t } = translationsFor(locale)
function update(value: (string | number)[]) {
  if (!disabled && value.every((tag): tag is string => typeof tag === 'string'))
    tags.value = value
}
function keydown(event: KeyboardEvent) {
  if (
    event.key !== 'Enter' ||
    event.isComposing ||
    !(event.target instanceof HTMLInputElement)
  )
    return
  // Reka waits a tick before preventing Enter, after a native form can submit.
  event.preventDefault()
  const tag = event.target.value.trim()
  if (!disabled && tag && !tags.value.includes(tag)) {
    update([...tags.value, tag])
    event.target.value = ''
  }
}
</script>

<template>
  <TagsInputRoot
    :model-value="tags"
    :disabled
    add-on-paste
    add-on-blur
    delimiter=","
    class="flex min-h-9.5 flex-wrap items-center gap-1.5 rounded-lg border border-admin-field bg-admin-page px-2 py-1.5 text-admin-fg focus-within:border-primary-comfy-yellow data-disabled:opacity-50"
    @update:model-value="update"
    @keydown="keydown"
  >
    <TagsInputItem
      v-for="tag in tags"
      :key="tag"
      :value="tag"
      class="inline-flex h-6 items-center gap-1 rounded-md bg-admin-line pr-1 pl-2 text-xs text-admin-fg data-[state=active]:outline-1 data-[state=active]:outline-admin-control"
    >
      <TagsInputItemText />
      <button
        type="button"
        :disabled
        :aria-label="t('cmsEditor.removeTag', { tag })"
        class="flex cursor-pointer rounded-sm text-admin-muted hover:text-admin-fg disabled:cursor-not-allowed"
        @click="update(tags.filter((other) => other !== tag))"
      >
        <X class="size-3" aria-hidden="true" />
      </button>
    </TagsInputItem>
    <TagsInputInput
      :aria-label="label"
      :placeholder="tags.length ? '' : t('cmsEditor.tagsPlaceholder')"
      class="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-admin-subtle"
    />
  </TagsInputRoot>
</template>
