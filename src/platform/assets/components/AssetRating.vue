<template>
  <div
    role="group"
    :aria-label="accessibleLabel"
    :class="
      cn(
        'inline-flex items-center',
        disabled && 'opacity-60',
        readOnly && 'cursor-default'
      )
    "
  >
    <div class="inline-flex items-center">
      <button
        v-for="value in ratingValues"
        :key="value"
        type="button"
        :disabled="isInteractionDisabled"
        :aria-label="getRatingLabel(value)"
        :aria-pressed="selectedRating === value"
        :class="
          cn(
            'group/rating-star flex touch-manipulation appearance-none items-center justify-center rounded-sm border-none bg-transparent p-0 transition-transform',
            'focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none',
            sizeClasses.button,
            isInteractionDisabled
              ? 'cursor-default'
              : 'cursor-pointer hover:scale-110 hover:bg-secondary-background-hover active:scale-95'
          )
        "
        @click="toggleRating(value)"
        @focus="previewRating(value)"
        @mouseenter="previewRating(value)"
        @mouseleave="clearPreview"
        @blur="clearPreview"
        @keydown="handleKeydown"
      >
        <i
          aria-hidden="true"
          :class="
            cn(
              'shrink-0 transition-colors',
              sizeClasses.icon,
              getRatingGlyphClass(value),
              !isInteractionDisabled &&
                'group-hover/rating-star:text-warning-background'
            )
          "
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type RatingSize = 'sm' | 'md' | 'lg'
type RatingVariant = 'stars' | 'paintbrushes' | 'comfy'

const ratingGlyphClasses: Record<
  RatingVariant,
  { filled: string; empty: string }
> = {
  stars: {
    filled: 'icon-[ph--star-fill] text-warning-background',
    empty: 'icon-[lucide--star] text-muted-foreground'
  },
  paintbrushes: {
    filled: 'icon-[lucide--paintbrush] text-warning-background',
    empty: 'icon-[lucide--paintbrush] text-muted-foreground'
  },
  comfy: {
    filled: 'icon-[comfy--comfy-c] text-warning-background',
    empty: 'icon-[comfy--comfy-c] text-muted-foreground'
  }
}

const {
  max = 5,
  disabled = false,
  readOnly = false,
  size = 'md',
  variant = 'stars',
  ariaLabel
} = defineProps<{
  max?: number
  disabled?: boolean
  readOnly?: boolean
  size?: RatingSize
  variant?: RatingVariant
  ariaLabel?: string
}>()

const emit = defineEmits<{
  change: [rating: number | null]
}>()

// Local interaction only; asset persistence belongs to the owning surface.
const rating = defineModel<number | null>({ default: null })

const { t } = useI18n()
const previewedRating = ref<number | null>(null)

const ratingMax = computed(() => normalizeMax(max))

const ratingValues = computed(() =>
  Array.from({ length: ratingMax.value }, (_, index) => index + 1)
)

const selectedRating = computed(() =>
  normalizeRating(rating.value, ratingMax.value)
)

const visibleRating = computed(
  () => previewedRating.value ?? selectedRating.value
)

const isInteractionDisabled = computed(() => disabled || readOnly)

const accessibleLabel = computed(() => ariaLabel ?? t('assetRating.label'))

const sizeClasses = computed(() => {
  switch (size) {
    case 'sm':
      return { button: 'size-4', icon: 'size-3' }
    case 'lg':
      return { button: 'size-8', icon: 'size-5' }
    case 'md':
    default:
      return { button: 'size-6', icon: 'size-3.5' }
  }
})

function normalizeMax(value: number): number {
  if (!Number.isFinite(value)) return 5
  return Math.max(1, Math.trunc(value))
}

function normalizeRating(
  value: number | null | undefined,
  maxValue: number
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const integerValue = Math.trunc(value)
  if (integerValue < 1) return null

  return Math.min(maxValue, integerValue)
}

function getRatingLabel(value: number): string {
  if (selectedRating.value === value) {
    return t('assetRating.clearRating', {
      rating: value,
      max: ratingMax.value
    })
  }

  return t('assetRating.rateAsset', {
    rating: value,
    max: ratingMax.value
  })
}

function isRatingFilled(value: number): boolean {
  return visibleRating.value !== null && value <= visibleRating.value
}

function getRatingGlyphClass(value: number): string {
  const glyphClass = ratingGlyphClasses[variant]
  return isRatingFilled(value) ? glyphClass.filled : glyphClass.empty
}

function previewRating(value: number) {
  if (isInteractionDisabled.value) return
  previewedRating.value = value
}

function clearPreview() {
  previewedRating.value = null
}

function commitRating(value: number | null) {
  if (isInteractionDisabled.value) return

  const nextRating = normalizeRating(value, ratingMax.value)
  if (nextRating === rating.value) return

  clearPreview()
  rating.value = nextRating
  emit('change', nextRating)
}

function toggleRating(value: number) {
  const nextRating = selectedRating.value === value ? null : value
  commitRating(nextRating)
}

function nudgeRating(delta: 1 | -1) {
  const currentRating = selectedRating.value ?? 0
  commitRating(currentRating + delta)
}

function handleKeydown(event: KeyboardEvent) {
  if (isInteractionDisabled.value) return

  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      event.preventDefault()
      nudgeRating(1)
      return
    case 'ArrowLeft':
    case 'ArrowDown':
      event.preventDefault()
      nudgeRating(-1)
      return
    case 'Home':
    case 'Backspace':
    case 'Delete':
      event.preventDefault()
      commitRating(null)
      return
    case 'End':
      event.preventDefault()
      commitRating(ratingMax.value)
      return
  }

  const numericKey = Number(event.key)
  if (
    Number.isInteger(numericKey) &&
    numericKey >= 1 &&
    numericKey <= ratingMax.value
  ) {
    event.preventDefault()
    commitRating(numericKey)
  }
}
</script>
