<template>
  <Teleport v-if="showOverlay" to="body">
    <div class="pointer-events-none fixed inset-0 z-3000" aria-live="polite">
      <!-- Dim everything except soft cutouts around the lit target(s). -->
      <svg class="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <mask id="onboarding-spotlight">
            <rect width="100%" height="100%" fill="white" />
            <rect
              v-for="(hole, i) in litRects"
              :key="i"
              :x="hole.left - 10"
              :y="hole.top - 10"
              :width="hole.width + 20"
              :height="hole.height + 20"
              rx="16"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(10, 12, 16, 0.66)"
          mask="url(#onboarding-spotlight)"
        />
      </svg>

      <!-- Emerald outline around each lit target. -->
      <div
        v-for="(hole, i) in litRects"
        :key="i"
        class="absolute rounded-2xl ring-2 ring-emerald-400/80 transition-all duration-500 ease-out"
        :style="rectStyle(hole)"
      />

      <!-- Ghost drag line for connect steps. -->
      <svg
        v-if="dragPath"
        class="absolute inset-0 size-full"
        fill="none"
        aria-hidden="true"
      >
        <path
          :d="dragPath"
          stroke="#34d399"
          stroke-width="3"
          stroke-linecap="round"
          stroke-dasharray="7 9"
          class="onboarding-drag-line"
        />
        <circle r="7" fill="#34d399">
          <animateMotion dur="1.5s" repeatCount="indefinite" :path="dragPath" />
        </circle>
      </svg>

      <!-- Agent cursor + speech bubble, pointing at the target. -->
      <div
        v-if="cursorPos"
        class="pointer-events-auto absolute transition-all duration-500 ease-out"
        :style="cursorStyle"
      >
        <i
          class="icon-[lucide--mouse-pointer-2] size-5 rotate-[-8deg] text-emerald-400 drop-shadow-[0_1px_4px_rgba(52,211,153,0.5)]"
          aria-hidden="true"
        />
        <div
          class="absolute top-4 left-5 w-64 rounded-2xl rounded-tl-md border border-emerald-400/25 bg-neutral-900/85 p-3 text-white shadow-2xl backdrop-blur-md"
        >
          <div class="mb-2 flex items-center gap-1.5">
            <span class="size-1.5 rounded-full bg-emerald-400" />
            <span
              class="text-[11px] font-semibold tracking-wide text-emerald-400/90 uppercase"
            >
              {{ t('onboardingTour.guide') }}
            </span>
          </div>
          <p class="text-sm/relaxed text-white/90">{{ hintLabel }}</p>

          <!-- Live progress while the image generates -->
          <div
            v-if="currentStep?.kind === 'generating'"
            class="mt-3"
            aria-hidden="true"
          >
            <div class="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full rounded-full bg-emerald-400 transition-all duration-300"
                :style="{ width: `${Math.max(executionProgress, 6)}%` }"
              />
            </div>
          </div>

          <!-- The result the user created -->
          <img
            v-if="currentStep?.kind === 'result' && resultImageUrl"
            :src="resultImageUrl"
            class="mt-3 aspect-square w-full rounded-lg object-cover"
            alt=""
          />

          <!-- Result step: a prominent CTA to explore more workflows -->
          <button
            v-if="currentStep?.kind === 'result'"
            type="button"
            class="group mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            @click="openExplore"
          >
            {{ t('onboardingTour.exploreCta') }}
            <i
              class="icon-[lucide--arrow-right] size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>

          <div v-else class="mt-3 flex items-center justify-between">
            <button
              v-if="canGoBack"
              type="button"
              class="text-xs text-white/45 transition-colors hover:text-white/80"
              @click="back"
            >
              {{ t('onboardingTour.back') }}
            </button>
            <span v-else />
            <button
              v-if="canGoNext"
              type="button"
              class="group flex items-center gap-1 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300"
              @click="next"
            >
              {{
                isLast ? t('onboardingTour.finish') : t('onboardingTour.next')
              }}
              <i
                class="icon-[lucide--arrow-right] size-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Progress dots + skip -->
      <div
        class="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <div class="flex items-center gap-1.5">
          <span
            v-for="i in totalSteps"
            :key="i"
            :class="
              cn(
                'h-1.5 rounded-full transition-all duration-300',
                i - 1 === stepIndex ? 'w-6 bg-emerald-400' : 'w-1.5 bg-white/25'
              )
            "
          />
        </div>
        <button
          type="button"
          class="pointer-events-auto text-xs text-white/45 transition-colors hover:text-white/80"
          @click="stop"
        >
          {{ t('onboardingTour.skip') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useRafFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

import type { ConnectStep } from './tourSteps'
import { useOnboardingTour } from './useOnboardingTour'

const { t } = useI18n()
const {
  isActive,
  stepIndex,
  totalSteps,
  currentStep,
  isLast,
  focusNode,
  litNodes,
  domTargetSelector,
  canGoNext,
  canGoBack,
  resultImageUrl,
  executionProgress,
  resolveNode,
  next,
  back,
  stop,
  openExplore
} = useOnboardingTour()

const showOverlay = computed(() => isActive.value && !!currentStep.value)

interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

const litRects = ref<ScreenRect[]>([])
const cursorPos = ref<{ x: number; y: number } | null>(null)
const dragPath = ref('')

/** Client-space origin of the litegraph canvas (nodes live in canvas coords). */
function canvasFrame() {
  const canvas = app.canvas
  if (!canvas) return null
  const rect = canvas.canvas.getBoundingClientRect()
  const { offset, scale } = canvas.ds
  return { rect, offset, scale }
}

/** Node canvas coords -> client (viewport) coords. */
function nodeClientRect(node: LGraphNode): ScreenRect | null {
  const f = canvasFrame()
  if (!f) return null
  const [bx, by, bw, bh] = node.boundingRect
  return {
    left: f.rect.left + (bx + f.offset[0]) * f.scale,
    top: f.rect.top + (by + f.offset[1]) * f.scale,
    width: bw * f.scale,
    height: bh * f.scale
  }
}

function domClientRect(selector: string): ScreenRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

function slotClient(pos: [number, number]): [number, number] {
  const f = canvasFrame()
  if (!f) return [0, 0]
  return [
    f.rect.left + (pos[0] + f.offset[0]) * f.scale,
    f.rect.top + (pos[1] + f.offset[1]) * f.scale
  ]
}

useRafFn(() => {
  const step = currentStep.value
  if (!step) return

  const domSel = domTargetSelector.value
  if (domSel) {
    const r = domClientRect(domSel)
    litRects.value = r ? [r] : []
    cursorPos.value = r
      ? { x: r.left + r.width / 2, y: r.top + r.height + 6 }
      : null
    dragPath.value = ''
    return
  }

  litRects.value = litNodes.value
    .map((n) => nodeClientRect(n))
    .filter((r): r is ScreenRect => !!r)

  if (step.kind === 'connect') {
    // Point the cursor right at the output slot the user drags from.
    const from = resolveNode(step.targetNodeType, step.targetNodeOccurrence)
    const slot = from ? slotClient(from.getOutputPos(step.fromSlot)) : null
    cursorPos.value = slot ? { x: slot[0] + 6, y: slot[1] + 6 } : null
    // Hide the guide line the moment the user grabs a link, so their real drag
    // line is the only one visible.
    const dragging = app.canvas?.linkConnector.isConnecting ?? false
    dragPath.value = dragging ? '' : buildDragPath(step)
    return
  }

  const focus = focusNode.value
  const fr = focus ? nodeClientRect(focus) : null
  cursorPos.value = fr
    ? { x: fr.left + fr.width * 0.5, y: fr.top + fr.height + 8 }
    : null
  dragPath.value = ''
})

function buildDragPath(step: ConnectStep): string {
  const fromNode = resolveNode(step.targetNodeType, step.targetNodeOccurrence)
  const toNode = resolveNode(step.toNodeType, step.toNodeOccurrence)
  if (!fromNode || !toNode) return ''
  const [x1, y1] = slotClient(fromNode.getOutputPos(step.fromSlot))
  const [x2, y2] = slotClient(toNode.getInputPos(step.toSlot))
  const cx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
}

function rectStyle(r: ScreenRect) {
  return {
    left: `${r.left - 8}px`,
    top: `${r.top - 8}px`,
    width: `${r.width + 16}px`,
    height: `${r.height + 16}px`
  }
}

const cursorStyle = computed(() => {
  const c = cursorPos.value
  if (!c) return {}
  return { left: `${c.x}px`, top: `${c.y}px` }
})

const hintLabel = computed(() => {
  const step = currentStep.value
  return step ? t(`onboardingTour.hint.${step.key}`) : ''
})
</script>

<style scoped>
.onboarding-drag-line {
  animation: onboarding-dash 0.6s linear infinite;
}
@keyframes onboarding-dash {
  to {
    stroke-dashoffset: -16;
  }
}
</style>
