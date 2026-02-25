<template>
  <div
    class="inline-flex items-center gap-0.5"
    role="img"
    :aria-label="ariaLabel"
  >
    <div v-for="i in 5" :key="i" class="relative" :class="starSizeClass">
      <i
        :class="
          cn('icon-[lucide--star]', starSizeClass, 'text-muted-foreground')
        "
      />
      <div
        v-if="fillWidth(i) > 0"
        class="absolute inset-0 overflow-hidden"
        :style="{ width: `${fillWidth(i)}%` }"
      >
        <i
          :class="cn('icon-[lucide--star]', starSizeClass, 'text-amber-400')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

const { rating, size = 'md' } = defineProps<{
  /** Star rating value from 0 to 5, supporting 0.5 increments. */
  rating: number
  /** Visual size variant. */
  size?: 'sm' | 'md'
}>()

const { t } = useI18n()

const starSizeClass = computed(() => (size === 'sm' ? 'size-3.5' : 'size-4'))

const ariaLabel = computed(
  () => t('developerProfile.rating') + ': ' + String(rating) + '/5'
)

/**
 * Returns the fill percentage (0, 50, or 100) for the star at position `i`.
 * @param i - 1-indexed star position.
 */
function fillWidth(i: number): number {
  if (rating >= i) return 100
  if (rating >= i - 0.5) return 50
  return 0
}
</script>
