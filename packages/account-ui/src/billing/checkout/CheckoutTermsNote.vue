<template>
  <p class="m-0 text-center text-xs text-muted-foreground">
    <span>
      <template v-for="(segment, index) in segments" :key="index">
        <template v-if="segment.kind === 'text'">{{ segment.text }}</template>
        <a
          v-else
          :href="LINKS[segment.key]"
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-base-foreground"
        >
          {{ segment.key === 'terms' ? copy.terms : copy.privacyPolicy }}
        </a>
      </template>
    </span>
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { CheckoutTermsCopy } from './checkoutCopy'
import { splitPlaceholders } from './checkoutCopy'

const { copy } = defineProps<{ copy: CheckoutTermsCopy }>()

const LINKS = {
  terms: 'https://comfy.org/terms-of-service/',
  privacy: 'https://comfy.org/privacy-policy/'
} as const

const segments = computed(() =>
  splitPlaceholders(copy.agreement, ['terms', 'privacy'] as const)
)
</script>
