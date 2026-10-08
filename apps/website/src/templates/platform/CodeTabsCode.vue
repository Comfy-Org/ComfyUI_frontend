<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import type { CodeGroup } from './codeTokens'

const { groups, animated } = defineProps<{
  groups: readonly CodeGroup[]
  /** Crossfade a cycling value when it changes; a pinned value patches in place. */
  animated: boolean
}>()

// An emphasised value is drawn in one colour, so its tokens drop their own.
const rows = computed(() =>
  groups.map((group) => {
    const cycling = group.kind === 'cycle'
    const highlight = cycling && group.highlight
    return {
      key: cycling && animated ? group.value : undefined,
      highlight,
      tokens: group.tokens.map((token) => ({
        content: token.content,
        color: highlight ? undefined : token.color
      }))
    }
  })
)
</script>

<template>
  <template v-for="(row, index) in rows" :key="index"
    ><Transition name="crossfade" mode="out-in"
      ><span
        :key="row.key"
        :class="cn(row.highlight && 'text-primary-comfy-yellow')"
        ><span
          v-for="(token, tokenIndex) in row.tokens"
          :key="tokenIndex"
          :style="{ color: token.color }"
          >{{ token.content }}</span
        ></span
      ></Transition
    ></template
  >
</template>
