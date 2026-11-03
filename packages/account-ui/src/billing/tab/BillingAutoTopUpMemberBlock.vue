<template>
  <div
    :class="
      cn(
        'flex flex-col gap-1 rounded-xl border border-card px-5 py-4',
        classes?.root
      )
    "
    data-testid="billing-auto-top-up-member-card"
  >
    <h3 :class="cn('m-0 text-sm font-medium text-foreground', classes?.title)">
      {{ copy.title }}
    </h3>
    <p :class="cn('m-0 text-sm text-muted-foreground', classes?.body)">
      {{ copy.body }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The Billing tab auto top-up block for a member the server denies
 * management to; the host shows it for a `memberBlock` section.
 */
import { cn } from '@comfyorg/tailwind-utils'

/** Host-translated strings for the auto top-up member block. */
export interface AutoTopUpMemberBlockCopy {
  readonly title: string
  readonly body: string
}

const { copy, classes } = defineProps<{
  copy: AutoTopUpMemberBlockCopy
  classes?: Partial<Record<'root' | 'title' | 'body', string>>
}>()
</script>
