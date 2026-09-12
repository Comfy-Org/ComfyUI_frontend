<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { autoUpdate, offset, shift, useFloating } from '@floating-ui/vue'
import type { Middleware } from '@floating-ui/vue'
import {
  useElementBounding,
  useEventListener,
  useWindowSize
} from '@vueuse/core'
import { FocusScope } from 'reka-ui'
import { computed, nextTick, ref, useId, watch } from 'vue'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import Button from '@/components/ui/button/Button.vue'
import { clampSpotlight } from '@/platform/onboarding/coachmarkLayout'
import type { CoachStep } from '../../composables/agent/useOnboarding'
import { useOnboarding } from '../../composables/agent/useOnboarding'

const { steps, storageKey } = defineProps<{
  steps: CoachStep[]
  storageKey?: string
}>()

const { active, index, step, isLast, next, finish } = useOnboarding(
  () => steps,
  storageKey
)
const titleId = useId()
const bodyId = useId()
const target = ref<HTMLElement | null>(null)
const toolbar = ref<HTMLElement | null>(null)
const card = ref<HTMLElement | null>(null)
const bounds = useElementBounding(target)
const toolbarBounds = useElementBounding(toolbar)
const { width, height } = useWindowSize()

watch(
  [active, step],
  async () => {
    await nextTick()
    target.value = active.value
      ? document.querySelector(step.value.target)
      : null
    toolbar.value =
      active.value && step.value.toolbarTarget
        ? document.querySelector(step.value.toolbarTarget)
        : null
    bounds.update()
    toolbarBounds.update()
  },
  { immediate: true, flush: 'post' }
)

const middleware = computed<Middleware[]>(() => {
  const result = [
    offset({
      mainAxis: 16,
      crossAxis: step.value?.placement === 'left-start' ? -16 : 0
    })
  ]
  if (step.value?.placement === 'graph-bottom') {
    const bottom = toolbar.value ? toolbarBounds.top.value : bounds.bottom.value
    result.push({
      name: 'graphBottom',
      fn: ({ rects }) => ({
        x:
          rects.reference.x +
          (rects.reference.width - rects.floating.width) / 2,
        y:
          Math.min(bottom, rects.reference.y + rects.reference.height) -
          16 -
          rects.floating.height
      })
    })
  }
  return [...result, shift({ padding: 8, crossAxis: true })]
})

const { floatingStyles, isPositioned } = useFloating(target, card, {
  strategy: 'fixed',
  transform: false,
  placement: () =>
    step.value?.placement === 'left-center'
      ? 'left'
      : step.value?.placement === 'left-end'
        ? 'left-end'
        : 'left-start',
  middleware,
  whileElementsMounted: autoUpdate
})

const spotlightStyle = computed(() =>
  clampSpotlight(
    new DOMRect(
      bounds.left.value,
      bounds.top.value,
      bounds.width.value,
      bounds.height.value
    ),
    0,
    { width: width.value, height: height.value }
  )
)

useEventListener(
  document,
  'keydown',
  (event) => {
    if (!active.value || event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    finish()
  },
  { capture: true }
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="active && target"
      v-reka-z-index
      class="agent-scope fixed inset-0"
    >
      <div class="absolute inset-0" />
      <div
        aria-hidden="true"
        data-testid="agent-coach-spotlight"
        :style="{ ...spotlightStyle }"
        class="pointer-events-none absolute rounded-lg shadow-[0_0_0_9999px_var(--color-coach-scrim)]"
      />
      <FocusScope as-child trapped loop>
        <div
          ref="card"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="bodyId"
          tabindex="-1"
          :style="{
            ...floatingStyles,
            opacity: isPositioned ? 1 : 0
          }"
          :class="
            cn(
              'fixed box-border flex max-h-[calc(100vh-16px)] w-[307px] max-w-[calc(100vw-16px)] flex-col gap-3 overflow-y-auto rounded-2xl border bg-base-background p-4 font-inter text-base-foreground shadow-lg',
              index < 2
                ? 'border-secondary-background'
                : 'border-alpha-smoke-500-20'
            )
          "
        >
          <video
            v-if="step.videoUrl"
            :src="step.videoUrl"
            :aria-label="step.title"
            controls
            playsinline
            preload="metadata"
            class="h-[146px] w-full rounded-xl object-cover"
          />
          <div class="flex flex-col gap-6">
            <div class="flex flex-col gap-2">
              <p class="m-0 text-xs/normal opacity-50">
                {{
                  $t('agent.coachProgress', {
                    current: index + 1,
                    total: steps.length
                  })
                }}
              </p>
              <h3 :id="titleId" class="m-0 text-base/normal font-semibold">
                {{ step.title }}
              </h3>
              <p :id="bodyId" class="m-0 text-sm/normal text-muted-foreground">
                {{ step.body }}
              </p>
            </div>
            <div class="flex justify-end gap-3">
              <Button variant="secondary" size="md" @click="finish">{{
                $t('agent.skip')
              }}</Button>
              <Button variant="inverted" size="md" @click="next">{{
                $t(isLast ? 'onboardingCoachmarks.done' : 'g.next')
              }}</Button>
            </div>
          </div>
        </div>
      </FocusScope>
    </div>
  </Teleport>
</template>
