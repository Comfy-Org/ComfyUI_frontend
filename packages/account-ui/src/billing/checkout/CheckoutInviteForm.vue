<template>
  <div class="flex flex-col gap-2">
    <CheckoutInviteEmails
      :emails
      :placeholder="copy.placeholder"
      :remove-label="copy.removeTag"
      :input-class
      :described-by="describedBy"
      @update:emails="emit('update:emails', $event)"
    />
    <p
      v-for="hint in hints"
      :id="hint.id"
      :key="hint.id"
      :role="hint.role"
      :aria-live="hint.role ? undefined : 'polite'"
      :class="hint.class"
    >
      {{ hint.text }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The team invite's email field with the hints the app shows under it:
 * invalid addresses, addresses already invited, and the seat cap.
 */
import { computed, useId } from 'vue'

import CheckoutInviteEmails from './CheckoutInviteEmails.vue'
import type { CheckoutInviteCopy } from './checkoutCopy'

const {
  emails,
  copy,
  inputClass,
  invalidCount,
  alreadyInvitedCount,
  maxSeats,
  seatOverage
} = defineProps<{
  emails: readonly string[]
  copy: CheckoutInviteCopy
  inputClass: string
  invalidCount: number
  alreadyInvitedCount: number
  maxSeats: number | null
  seatOverage: number
}>()

const emit = defineEmits<{
  'update:emails': [emails: string[]]
}>()

const ids = { invalid: useId(), pending: useId(), seats: useId() }
const ERROR = 'm-0 text-xs text-destructive-background'

const hints = computed(() => [
  ...(invalidCount > 0
    ? [
        {
          id: ids.invalid,
          role: 'alert',
          class: ERROR,
          text: copy.invalidEmailCount(invalidCount)
        }
      ]
    : []),
  ...(alreadyInvitedCount > 0
    ? [
        {
          id: ids.pending,
          role: undefined,
          class: 'm-0 text-xs text-warning-background',
          text:
            alreadyInvitedCount === 1
              ? copy.pendingInviteSingle
              : copy.pendingInviteCount(alreadyInvitedCount)
        }
      ]
    : []),
  ...(seatOverage > 0
    ? [
        {
          id: ids.seats,
          role: 'alert',
          class: ERROR,
          text: copy.seatLimitExceeded(maxSeats ?? 0, seatOverage)
        }
      ]
    : [])
])

const describedBy = computed(
  () => hints.value.map((hint) => hint.id).join(' ') || undefined
)
</script>
