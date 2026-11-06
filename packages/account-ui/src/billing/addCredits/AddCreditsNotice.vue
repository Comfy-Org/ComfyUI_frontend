<template>
  <div
    :role="copy.tone === 'warning' ? 'alert' : 'status'"
    :class="
      cn(
        'flex gap-2 rounded-lg border border-solid p-3',
        copy.tone === 'warning'
          ? 'border-warning/60 bg-warning/10'
          : 'border-border',
        noticeClass
      )
    "
    data-testid="add-credits-notice"
    :data-notice="kind"
  >
    <i
      :class="
        cn(
          'mt-0.5 icon-[lucide--circle-alert]',
          copy.tone === 'warning' ? 'text-warning' : 'text-muted-foreground'
        )
      "
      aria-hidden="true"
    />
    <div class="flex flex-col">
      <span class="text-foreground">{{ copy.title }}</span>
      <span class="text-muted-foreground">
        <template v-for="(part, index) in copy.body" :key="index">
          <a
            v-if="part === SUPPORT_TOKEN"
            :href="supportUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-inherit underline"
            >{{ supportLabel }}</a
          >
          <template v-else>{{ part }}</template>
        </template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { AddCreditsNoticeCopy } from './addCreditsPresentation'
import { SUPPORT_TOKEN } from './addCreditsPresentation'

const { copy, kind, supportUrl, supportLabel, noticeClass } = defineProps<{
  copy: AddCreditsNoticeCopy
  kind?: string
  supportUrl: string
  supportLabel: string
  noticeClass?: string
}>()
</script>
