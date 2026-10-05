<template>
  <TagsInputRoot
    :model-value="[...emails]"
    add-on-paste
    add-on-blur
    :delimiter="EMAIL_DELIMITER"
    :convert-value="normalizeEmail"
    :class="
      cn(
        'group relative flex flex-wrap items-center gap-2 rounded-lg bg-transparent p-2 text-xs text-base-foreground',
        'focus-within:bg-tertiary-background hover:bg-tertiary-background',
        'max-h-48 overflow-y-auto',
        inputClass
      )
    "
    @update:model-value="emit('update:emails', $event)"
  >
    <TagsInputItem
      v-for="email in emails"
      :key="email"
      :value="email"
      :class="cn(tagVariants({ removable: true }), itemClass(email))"
    >
      <TagsInputItemText class="min-w-0 truncate bg-transparent text-xs" />
      <TagsInputItemDelete as-child>
        <button
          type="button"
          :aria-label="removeLabel"
          :class="
            cn(
              buttonVariants({ variant: 'textonly', size: 'icon-sm' }),
              tagRemoveButtonVariants(),
              'opacity-60'
            )
          "
        >
          <i class="icon-[lucide--x] size-4" />
        </button>
      </TagsInputItemDelete>
    </TagsInputItem>
    <TagsInputInput
      class="min-h-6 min-w-0 flex-1 appearance-none border-none bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
      :aria-label="placeholder"
      :aria-describedby="describedBy"
      :placeholder="emails.length === 0 ? placeholder : undefined"
    />
  </TagsInputRoot>
</template>

<script setup lang="ts">
/**
 * The cloud app's always-editing email tags input, as the team invite uses
 * it: an address is a tag, an invalid one is marked, pasting a list splits it.
 */
import {
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
  TagsInputRoot
} from 'reka-ui'

import { buttonVariants } from '@comfyorg/design-system/button.variants'
import {
  tagRemoveButtonVariants,
  tagVariants
} from '@comfyorg/design-system/tag.variants'
import { cn } from '@comfyorg/tailwind-utils'

import { EMAIL_DELIMITER, isValidEmail, normalizeEmail } from './inviteEmails'

const { emails, placeholder, removeLabel, inputClass, describedBy } =
  defineProps<{
    emails: readonly string[]
    placeholder: string
    removeLabel: string
    inputClass: string
    describedBy?: string
  }>()

const emit = defineEmits<{
  'update:emails': [emails: string[]]
}>()

function itemClass(email: string): string {
  return cn(
    'rounded-full',
    !isValidEmail(email) &&
      'bg-destructive-background/20 text-destructive-background'
  )
}
</script>
