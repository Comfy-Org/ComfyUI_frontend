<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useElementHover } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'
import type { HTMLAttributes, Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  clampRating,
  getDefaultRevealForPresentation,
  getDisplayRating,
  getRatingFromDigitKey,
  getRatingFromStarClick,
  getStarRatingRevealState,
  isStarFilled
} from './starRating'
import type { StarRatingReveal } from './starRating'
import { useStarRatingHost } from './starRatingHost'

const modelValue = defineModel<number>({ default: 0 })

const {
  disabled = false,
  readonly: explicitlyReadonly = false,
  showCount = false,
  max = 5,
  presentation = 'inline',
  reveal: revealProp,
  hostRef: hostRefProp,
  class: className
} = defineProps<{
  disabled?: boolean
  readonly?: boolean
  showCount?: boolean
  max?: number
  presentation?: 'inline' | 'overlay'
  reveal?: StarRatingReveal
  hostRef?: Ref<HTMLElement | undefined>
  class?: HTMLAttributes['class']
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement>()
const hoverRating = ref<number | null>(null)

const effectiveReveal = computed(
  () => revealProp ?? getDefaultRevealForPresentation(presentation)
)

const injectedHostRef = useStarRatingHost()

const isSelfHovered = useElementHover(rootRef)
const isHostHovered = useElementHover(
  computed(() => {
    if (effectiveReveal.value !== 'host-hover') return null
    return toValue(hostRefProp ?? injectedHostRef) ?? null
  })
)

const revealState = computed(() =>
  getStarRatingRevealState({
    reveal: effectiveReveal.value,
    hostHovered: isHostHovered.value,
    selfHovered: isSelfHovered.value,
    rating: modelValue.value,
    disabled,
    explicitlyReadonly
  })
)

const effectivelyReadonly = computed(
  () => revealState.value.effectivelyReadonly
)

const isInteractive = computed(() => !disabled && !effectivelyReadonly.value)

const starIndices = computed(() =>
  Array.from({ length: max }, (_, index) => index + 1)
)

const displayRating = computed(() =>
  getDisplayRating(modelValue.value, hoverRating.value)
)

const groupTabIndex = computed(() => (isInteractive.value ? 0 : undefined))

function commitRating(next: number) {
  if (!isInteractive.value) return
  modelValue.value = clampRating(next, max)
}

function handleStarClick(starIndex: number) {
  commitRating(getRatingFromStarClick(modelValue.value, starIndex))
}

function handleStarPointerEnter(starIndex: number) {
  if (!isInteractive.value) return
  hoverRating.value = starIndex
}

function handleGroupPointerLeave() {
  hoverRating.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (!isInteractive.value) return

  const digitRating = getRatingFromDigitKey(event.key, max)
  if (digitRating !== null) {
    event.preventDefault()
    commitRating(digitRating)
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    commitRating(modelValue.value - 1)
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    commitRating(modelValue.value + 1)
  }
}

function starAriaLabel(starIndex: number) {
  return t('starRating.rateStars', { count: starIndex })
}

function handleRootClick(event: MouseEvent) {
  if (presentation === 'overlay') event.stopPropagation()
}
</script>

<template>
  <div
    v-show="revealState.visible"
    ref="rootRef"
    role="group"
    :aria-label="t('starRating.groupLabel')"
    :aria-valuenow="modelValue"
    :aria-valuemin="0"
    :aria-valuemax="max"
    :tabindex="groupTabIndex"
    :class="
      cn(
        'inline-flex items-center transition-opacity duration-150 ease-out',
        showCount && 'gap-2',
        revealState.opacityClass,
        revealState.pointerEventsClass,
        isInteractive && 'focus-visible:outline-none',
        disabled && 'opacity-50',
        className
      )
    "
    @click="handleRootClick"
    @pointerleave="handleGroupPointerLeave"
    @keydown="handleKeydown"
  >
    <div class="inline-flex items-center gap-px">
      <button
        v-for="starIndex in starIndices"
        :key="starIndex"
        type="button"
        :disabled="!isInteractive"
        :tabindex="isInteractive ? -1 : undefined"
        :aria-label="starAriaLabel(starIndex)"
        :class="
          cn(
            'inline-flex appearance-none items-center justify-center border-0 bg-transparent p-0 shadow-none outline-none',
            isInteractive && 'cursor-pointer',
            !isInteractive && 'cursor-default'
          )
        "
        @click="handleStarClick(starIndex)"
        @pointerenter="handleStarPointerEnter(starIndex)"
      >
        <i
          :class="
            cn(
              'size-4',
              isStarFilled(starIndex, displayRating)
                ? 'icon-[ph--star-fill] text-warning-background'
                : 'icon-[lucide--star] text-muted-foreground'
            )
          "
        />
      </button>
    </div>
    <span
      v-if="showCount"
      aria-hidden="true"
      class="min-w-3 text-sm text-muted-foreground tabular-nums"
    >
      {{ displayRating }}
    </span>
  </div>
</template>
