<template>
  <div
    data-testid="point-at-it-companion"
    :data-frame="frame"
    :data-docked="docked"
    :data-reaction="reacting?.reaction.id"
    class="pointer-events-none absolute top-0 left-0 will-change-transform"
    :style="{
      width: `${COMPANION_SIZE.width}px`,
      height: `${COMPANION_SIZE.height}px`,
      transform: `translate(${position.x}px, ${position.y}px)`
    }"
  >
    <button
      ref="button"
      type="button"
      data-testid="point-at-it-companion-button"
      data-point-at-it-companion-button
      :tabindex="accessibleAs ? undefined : -1"
      :aria-hidden="accessibleAs ? undefined : 'true'"
      :aria-label="accessibleAs?.name"
      :aria-pressed="accessibleAs?.pressed"
      :aria-expanded="accessibleAs?.expanded"
      :title
      :disabled="!docked || disabled"
      :class="
        cn(
          'peer absolute inset-y-[3%] right-[22%] left-[27%] z-10 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring',
          docked ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
        )
      "
      @click="onClick"
      @pointerenter="onPointerEnter"
      @pointerleave="emit('leave')"
    />
    <div
      :class="
        cn(
          'size-full motion-safe:transition-transform motion-safe:peer-hover:-translate-y-1',
          travelling ? 'companion-flight' : 'companion-breathe'
        )
      "
    >
      <div
        data-testid="point-at-it-companion-motion"
        :data-motion="motion?.name"
        :style="motion && { '--companion-reaction-ms': `${motion.ms}ms` }"
        class="size-full"
      >
        <img
          v-for="name in COMPANION_FRAMES"
          :key="name"
          :src="COMPANION_ART[name]"
          alt=""
          draggable="false"
          :class="
            cn(
              'absolute inset-0 size-full select-none',
              name === frame ? 'opacity-100' : 'opacity-0'
            )
          "
        />
      </div>
    </div>
  </div>
  <CompanionBubble
    v-if="speech"
    role="status"
    data-testid="point-at-it-companion-speech"
    class="pointer-events-none w-max max-w-64"
    :anchor="head"
    :order="SPEECH_SIDES"
    :avoid
  >
    <span class="line-clamp-3">{{ speech }}</span>
  </CompanionBubble>
</template>

<script setup lang="ts">
import { usePreferredReducedMotion, useRafFn } from '@vueuse/core'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import CompanionBubble from './CompanionBubble.vue'
import {
  COMPANION_ART,
  COMPANION_FRAMES,
  COMPANION_SIZE,
  companionHead
} from './companionArt'
import { stepToward } from './companionMotion'
import { companionFrame, talkDuration } from './companionPose'
import type { CompanionLook } from './companionPose'
import {
  REACTION_COOLDOWN_MS,
  pickReaction,
  reactionDuration,
  reactionFrame
} from './companionReactions'
import type { CompanionReaction } from './companionReactions'
import type { Point, Pointing, Rect, Side } from './geometry'
import type { PressSource } from './useCompanionMenu'

const SPEECH_SIDES: Side[] = ['right', 'left', 'above', 'below']

const {
  look,
  dock,
  stand,
  points,
  speech,
  title,
  disabled,
  accessibleAs,
  avoid = null,
  reacts = true,
  random = Math.random
} = defineProps<{
  look: CompanionLook
  /** Her top-left corner at home. */
  dock: Point
  /** Her top-left corner beside what the answer points at; null when none. */
  stand: Point | null
  /** Which way she points once she is there. */
  points: Pointing
  /** The line she says, or null when she says nothing. */
  speech: string | null
  /** What a hover on her says: what pressing her does. None: she has no tooltip. */
  title?: string
  /** Pressing her does nothing right now, so she cannot be pressed. */
  disabled: boolean
  /**
   * What assistive technology sees her as. Null: nothing, because the Ask
   * strip is shown and its button is the control. Given: she is a button, so
   * she is named, says whether she is pressed or has something open, and can
   * be tabbed to.
   */
  accessibleAs: { name: string; pressed?: boolean; expanded?: boolean } | null
  /** What her speech should not sit on when it can go to another side: the ring she points at. */
  avoid?: Rect | null
  /** Whether she reacts when the pointer comes onto her at the dock. */
  reacts?: boolean
  /** Where the chance in her reactions comes from: a number from 0 up to, not including, 1. */
  random?: () => number
}>()

const emit = defineEmits<{
  /** She was pressed, by a pointer or from the keyboard. */
  press: [source: PressSource]
  /** A pointer came onto her at the dock, where she can be pressed; `pointerType` is the pointer's own ('mouse', 'pen', 'touch'). */
  enter: [pointerType: string]
  /** The pointer left her. */
  leave: []
}>()

const button = useTemplateRef('button')

/**
 * A click with the pointer leaves no focus on her. The browser focuses a
 * button that is clicked, and the next key pressed (Esc to close the tips, Q, a
 * screenshot shortcut) would then bring up the focus ring meant for the
 * keyboard on a button that was only ever clicked. A click from the keyboard
 * has no pointer (`detail` is 0): focus stays on her, and so does the ring.
 */
function onClick(event: MouseEvent) {
  emit('press', event.detail > 0 ? 'pointer' : 'keyboard')
  if (event.detail > 0 && event.currentTarget instanceof HTMLElement)
    event.currentTarget.blur()
}

/** Gives the keyboard back to her, when she is a button for it and can be pressed. */
function focusButton(): void {
  if (accessibleAs) button.value?.focus({ preventScroll: true })
}

defineExpose({ focusButton })

const reduced = usePreferredReducedMotion()
const reducedMotion = computed(() => reduced.value === 'reduce')

const position = shallowRef<Point>(dock)
const travelling = shallowRef(false)
/** How long she has been saying the line on show; null when she is done. */
const speakingMs = shallowRef<number | null>(null)

const goal = computed<Point | null>(() => {
  if (look.goes === 'dock') return dock
  return look.goes === 'target' ? stand : null
})

const docked = computed(
  () =>
    look.goes === 'dock' &&
    Math.hypot(position.value.x - dock.x, position.value.y - dock.y) < 1
)

/** Where her speech comes from: it goes wherever she is, and follows her flight. */
const head = computed(() => companionHead(position.value))

/** At the dock with nothing to do: not flying, pointing or thinking, and no line to say. */
const atRest = computed(
  () => docked.value && look.pose === 'resting' && speakingMs.value === null
)

/** The reaction she is playing and for how long; null when she is not reacting. */
const playing = shallowRef<{ reaction: CompanionReaction; ms: number } | null>(
  null
)
/** What she does on show: a reaction is only ever shown at rest, and ends when she is not. */
const reacting = computed(() => (atRest.value ? playing.value : null))
let lastReaction: string | null = null
/** The pointer starts no reaction before this time: not while one plays, nor just after. */
let readyAt = 0

const reactingFrame = computed(() => {
  const current = reacting.value
  if (!current) return null
  return reactionFrame({
    reaction: current.reaction,
    elapsedMs: current.ms,
    reducedMotion: reducedMotion.value
  })
})

/** The movement that goes with the reaction, which lasts as long as it does; none for reduced motion. */
const motion = computed(() => {
  const current = reacting.value
  if (!current || reducedMotion.value) return null
  return {
    name: current.reaction.motion,
    ms: reactionDuration(current.reaction)
  }
})

const frame = computed(() =>
  companionFrame({
    pose: look.pose,
    points,
    travelling: travelling.value,
    speakingMs: speakingMs.value,
    reacting: reactingFrame.value,
    reducedMotion: reducedMotion.value
  })
)

/**
 * The pointer came onto her: she reacts, one that is not the last. A button
 * that cannot be pressed is not reliably told of the pointer (browsers
 * differ), so she does not react then, in any browser.
 */
function react(): void {
  const now = performance.now()
  if (!reacts || disabled || !atRest.value || now < readyAt) return
  const reaction = pickReaction({ roll: random(), last: lastReaction })
  lastReaction = reaction.id
  readyAt = now + reactionDuration(reaction) + REACTION_COOLDOWN_MS
  playing.value = { reaction, ms: 0 }
}

/** The pointer came onto her: she may react, and the layer is told, apart from that, when she can be pressed. */
function onPointerEnter(event: PointerEvent): void {
  react()
  if (docked.value && !disabled) emit('enter', event.pointerType)
}

watch(
  () => speech,
  (line) => {
    speakingMs.value = line === null ? null : 0
  },
  { immediate: true }
)

let lastFrameAt = performance.now()

useRafFn(() => {
  const now = performance.now()
  const delta = now - lastFrameAt
  lastFrameAt = now
  const to = goal.value
  if (to === null) {
    travelling.value = false
  } else {
    const step = reducedMotion.value
      ? { position: to, travelling: false }
      : stepToward(position.value, to, delta)
    const { x, y } = position.value
    if (step.position.x !== x || step.position.y !== y)
      position.value = step.position
    travelling.value = step.travelling
  }
  if (speakingMs.value !== null && speech !== null) {
    const elapsed = speakingMs.value + delta
    speakingMs.value = elapsed < talkDuration(speech) ? elapsed : null
  }
  const current = playing.value
  if (current) {
    const elapsed = current.ms + delta
    playing.value =
      atRest.value && elapsed < reactionDuration(current.reaction)
        ? { reaction: current.reaction, ms: elapsed }
        : null
  }
})
</script>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .companion-breathe {
    animation: companion-breathe 3.6s ease-in-out infinite;
  }

  .companion-flight {
    animation: companion-flight 0.5s ease-in-out infinite;
  }

  /* Her reaction to the pointer: one movement, as long as the reaction. */
  [data-motion] {
    transform-origin: 50% 100%;
    animation-duration: var(--companion-reaction-ms);
  }

  [data-motion='hop'] {
    animation-name: companion-hop;
  }

  [data-motion='lean'] {
    animation-name: companion-lean;
  }

  [data-motion='wiggle'] {
    animation-name: companion-wiggle;
  }

  [data-motion='tilt'] {
    animation-name: companion-tilt;
  }
}

@keyframes companion-breathe {
  50% {
    transform: translateY(-2px);
  }
}

@keyframes companion-flight {
  0%,
  100% {
    transform: rotate(-3deg);
  }

  50% {
    transform: translateY(-3px) rotate(3deg);
  }
}

@keyframes companion-hop {
  0% {
    transform: translateY(0);
    animation-timing-function: ease-out;
  }

  30% {
    transform: translateY(-8px);
    animation-timing-function: ease-in;
  }

  55% {
    transform: translateY(0);
    animation-timing-function: ease-out;
  }

  72% {
    transform: translateY(-2px);
    animation-timing-function: ease-in;
  }

  88%,
  100% {
    transform: translateY(0);
  }
}

@keyframes companion-lean {
  0% {
    transform: none;
    animation-timing-function: ease-out;
  }

  20%,
  65% {
    transform: translateY(2px) rotate(-4deg) scale(0.97);
  }

  100% {
    transform: none;
  }
}

@keyframes companion-wiggle {
  0%,
  100% {
    transform: rotate(0deg);
  }

  12% {
    transform: rotate(-3deg);
  }

  30% {
    transform: rotate(3deg);
  }

  48% {
    transform: rotate(-2.5deg);
  }

  66% {
    transform: rotate(2deg);
  }

  84% {
    transform: rotate(-1deg);
  }
}

@keyframes companion-tilt {
  0%,
  100% {
    transform: rotate(0deg);
  }

  22%,
  78% {
    transform: rotate(4deg);
  }
}
</style>
