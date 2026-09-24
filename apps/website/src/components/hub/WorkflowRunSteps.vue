<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { tHub } from '../../i18n/hub'

// The wait, as the steps it actually has, with the one it has got to lit. The
// lit step is the panel's headline, which is why it carries the weight a
// model's playground gives its one line: there, the wait is a single step.
const {
  steps,
  reached,
  locale = 'en'
} = defineProps<{
  steps: readonly HubKey[]
  reached: number
  locale?: Locale
}>()

const done = (index: number) => index <= reached
</script>

<template>
  <ol class="flex flex-col items-center gap-2" data-testid="workflow-run-steps">
    <li
      v-for="(step, index) in steps"
      :key="step"
      class="flex items-center gap-2"
      :class="
        index === reached
          ? 'text-sm text-primary-warm-white'
          : 'text-xs text-primary-warm-gray'
      "
    >
      <span
        class="size-1.5 shrink-0 rounded-full"
        :class="done(index) ? 'bg-primary-comfy-yellow' : 'bg-hub-muted'"
      />
      {{ tHub(step, locale) }}
    </li>
  </ol>
</template>
