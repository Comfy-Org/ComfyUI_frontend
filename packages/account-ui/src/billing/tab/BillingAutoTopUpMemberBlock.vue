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
    <h3
      :class="
        cn(
          'm-0 flex items-center gap-2 text-sm font-medium text-foreground',
          classes?.title
        )
      "
    >
      {{ copy.title }}
      <span
        v-if="memberView"
        :class="
          cn(
            'flex items-center gap-1 text-xs font-normal',
            DANGER.has(memberView.status)
              ? 'text-destructive'
              : 'text-muted-foreground',
            classes?.status
          )
        "
        data-testid="billing-auto-top-up-status"
      >
        <span
          :class="cn('size-1.75 rounded-full', DOT[memberView.status])"
          aria-hidden="true"
        />
        {{ copy.status[memberView.status] }}
      </span>
    </h3>
    <p :class="cn('m-0 text-sm text-muted-foreground', classes?.body)">
      {{ memberView?.line ?? copy.body }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AutoTopUpStatusLabel } from './autoTopUpCardView'
import { autoTopUpMemberView } from './autoTopUpMemberView'
import type {
  AutoTopUpMemberBlockCopy,
  AutoTopUpMemberView
} from './autoTopUpMemberView'

const DOT: Record<AutoTopUpStatusLabel, string> = {
  failed: 'bg-destructive',
  turnedOff: 'bg-destructive-background',
  off: 'bg-muted-foreground',
  onHold: 'bg-warning-background',
  limitReached: 'bg-warning-background',
  maximumReached: 'bg-warning-background',
  on: 'bg-success-background'
}

const DANGER: ReadonlySet<AutoTopUpStatusLabel> = new Set([
  'failed',
  'turnedOff'
])

const { copy, view, locale, classes } = defineProps<{
  copy: AutoTopUpMemberBlockCopy
  view?: AutoTopUpMemberView | null
  locale: string
  classes?: Partial<Record<'root' | 'title' | 'status' | 'body', string>>
}>()

const memberView = computed(() => autoTopUpMemberView(view, copy, locale))
</script>
