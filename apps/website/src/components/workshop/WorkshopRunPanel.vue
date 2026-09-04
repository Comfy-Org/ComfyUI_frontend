<script setup lang="ts">
import { Play } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'

import type {
  WorkshopDetailModel,
  WorkshopFormValues
} from '../../config/workshop-detail'
import { useWorkshopCredentials } from '../../config/workshop-credentials-state'
import type {
  WorkshopRunErrorType,
  WorkshopRunResult
} from '../../config/workshop-run'
import { WORKSHOP_RUN_TIMEOUT_MS } from '../../config/workshop-run'
import {
  extractMediaUrls,
  mediaKindForModality
} from '../../config/workshop-results'
import { runTargetFor } from '../../config/workshop-run-target'
import WorkshopSignInDialog from './WorkshopSignInDialog.vue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  model,
  values,
  locale = 'en'
} = defineProps<{
  model: WorkshopDetailModel
  values: WorkshopFormValues
  locale?: Locale
}>()

const { credentials } = useWorkshopCredentials()
const running = ref(false)
const signInOpen = ref(false)
const elapsedMs = ref(0)
let ticker: number | undefined

/**
 * How long this kind of model usually takes. There is no progress signal to
 * report — the partner polls internally — so the honest thing is to set an
 * expectation rather than imply precision we do not have.
 */
const expectation = computed(() => {
  if (model.modality === 'video') return t('workshop.run.wait.video', locale)
  if (model.modality === '3d') return t('workshop.run.wait.slow', locale)
  return t('workshop.run.wait.default', locale)
})

const elapsedLabel = computed(() => {
  const total = Math.floor(elapsedMs.value / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
})
// shallowRef: this holds a partner's JSON document of unknown size and we
// only ever replace it wholesale, so there is nothing to gain from making
// every node in it reactive.
const result = shallowRef<WorkshopRunResult | undefined>(undefined)
const mediaUrls = shallowRef<readonly string[]>([])
let controller: AbortController | undefined

const mediaKind = mediaKindForModality(model.modality)

/**
 * Headings for the failures a visitor can act on. Everything else falls back
 * to a generic heading with Router's own `detail` underneath, rather than us
 * inventing prose for a bucket we have nothing useful to say about.
 */
const errorHeadings: Partial<Record<WorkshopRunErrorType, TranslationKey>> = {
  unauthorized: 'workshop.run.error.unauthorized',
  forbidden: 'workshop.run.error.unauthorized',
  insufficient_credits: 'workshop.run.error.insufficientCredits',
  rate_limited: 'workshop.run.error.rateLimited',
  concurrency_limit_exceeded: 'workshop.run.error.rateLimited',
  content_policy_violation: 'workshop.run.error.contentPolicy',
  not_enabled: 'workshop.run.error.notEnabled',
  invalid_input: 'workshop.run.error.invalidInput',
  deadline_exceeded: 'workshop.run.error.timeout',
  provider_timeout: 'workshop.run.error.timeout',
  network_error: 'workshop.run.error.network'
}

function headingFor(errorType: WorkshopRunErrorType): string {
  return t(errorHeadings[errorType] ?? 'workshop.run.error.generic', locale)
}

async function run() {
  if (credentials.value === '' || running.value) return
  running.value = true
  result.value = undefined
  mediaUrls.value = []
  elapsedMs.value = 0
  const startedAt = Date.now()
  ticker = window.setInterval(() => {
    elapsedMs.value = Date.now() - startedAt
  }, 1000)

  controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller?.abort(),
    WORKSHOP_RUN_TIMEOUT_MS
  )
  try {
    const outcome = await runTargetFor(model).run(model, values, {
      credentials: credentials.value,
      signal: controller.signal
    })
    result.value = outcome
    if (outcome.status === 'ok') {
      mediaUrls.value = extractMediaUrls(outcome.output)
    }
  } finally {
    window.clearTimeout(timeout)
    if (ticker !== undefined) window.clearInterval(ticker)
    ticker = undefined
    controller = undefined
    running.value = false
  }
}

function cancel() {
  controller?.abort()
}

onBeforeUnmount(() => {
  if (ticker !== undefined) window.clearInterval(ticker)
  controller?.abort()
})
</script>

<template>
  <!--
    INPUT left / OUTPUT right at 5:7 on a twelve-column grid, matching the
    Workshop prototype (PR #16556). The run control sits at the foot of the
    input card, where the prototype puts it.
  -->
  <div class="grid items-start gap-6 lg:grid-cols-12">
    <section
      class="flex flex-col overflow-hidden rounded-2xl border border-primary-comfy-canvas/10 bg-primary-comfy-canvas/4 lg:col-span-5"
    >
      <header
        class="border-b border-primary-comfy-canvas/10 px-5 py-3 text-xs tracking-wider text-primary-comfy-canvas/55 uppercase"
      >
        {{ t('workshop.card.input', locale) }}
      </header>

      <div class="flex flex-col gap-6 p-5">
        <slot name="form" />

        <button
          v-if="!running"
          type="button"
          class="hover:bg-primary-comfy-yellow/90 group bg-primary-comfy-yellow flex h-13 w-full items-center justify-center gap-2.5 rounded-xl text-sm font-semibold tracking-wider text-primary-comfy-ink uppercase transition-colors"
          @click="credentials === '' ? (signInOpen = true) : run()"
        >
          <Play
            aria-hidden="true"
            class="size-4 fill-current transition-transform group-hover:scale-110"
          />
          {{
            credentials === ''
              ? t('workshop.auth.cta', locale)
              : t('workshop.run.button', locale)
          }}
        </button>
        <button
          v-else
          type="button"
          class="flex h-13 w-full items-center justify-center rounded-xl border border-primary-comfy-canvas/25 text-sm tracking-wider text-primary-comfy-canvas uppercase transition-colors hover:border-primary-comfy-canvas/40"
          @click="cancel"
        >
          {{ t('workshop.run.cancel', locale) }}
        </button>
      </div>
    </section>

    <section
      class="overflow-hidden rounded-2xl border border-primary-comfy-canvas/10 bg-primary-comfy-canvas/4 lg:col-span-7"
    >
      <header
        class="flex items-center justify-between border-b border-primary-comfy-canvas/10 px-5 py-3"
      >
        <span
          class="text-xs tracking-wider text-primary-comfy-canvas/55 uppercase"
        >
          {{ t('workshop.card.output', locale) }}
        </span>
      </header>

      <div class="p-5">
        <!--
          No progress signal exists: the partner polls internally and reports
          only a terminal state. So this sets an expectation and shows elapsed
          time rather than animating a percentage we would be inventing.
        -->
        <div v-if="running" aria-live="polite">
          <div
            class="workshop-shimmer relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-primary-comfy-canvas/10"
          >
            <div
              class="relative z-10 flex flex-col items-center gap-3 px-6 text-center"
            >
              <span
                class="border-primary-comfy-yellow/70 size-8 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
              />
              <p class="text-sm text-primary-comfy-canvas">
                {{ t('workshop.run.running', locale) }}
              </p>
              <p class="text-xs text-primary-comfy-canvas/55">
                {{ expectation }}
              </p>
              <p
                class="font-mono text-xs text-primary-comfy-canvas/45 tabular-nums"
              >
                {{ elapsedLabel }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-else-if="result?.status === 'error'"
          class="rounded-xl border border-red-500/30 bg-red-500/5 p-5"
          role="alert"
        >
          <p class="font-medium text-primary-comfy-canvas">
            {{ headingFor(result.errorType) }}
          </p>
          <p
            class="mt-2 text-sm whitespace-pre-line text-primary-comfy-canvas/70"
          >
            {{ result.detail }}
          </p>
          <p
            v-if="result.requestId"
            class="mt-3 font-mono text-xs text-primary-comfy-canvas/45"
          >
            {{ t('workshop.run.requestId', locale) }} {{ result.requestId }}
          </p>
        </div>

        <div v-else-if="result?.status === 'ok'">
          <ul v-if="mediaUrls.length > 0" class="grid list-none gap-4 p-0">
            <li
              v-for="url in mediaUrls"
              :key="url"
              class="overflow-hidden rounded-xl border border-primary-comfy-canvas/10"
            >
              <img
                v-if="mediaKind === 'image'"
                :src="url"
                :alt="model.displayName"
                class="w-full"
              />
              <video
                v-else-if="mediaKind === 'video'"
                :src="url"
                controls
                playsinline
                class="w-full"
              />
              <audio
                v-else-if="mediaKind === 'audio'"
                :src="url"
                controls
                class="w-full p-4"
              />
              <a
                v-else
                :href="url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-comfy-yellow block p-6 text-sm break-all hover:underline"
              >
                {{ url }}
              </a>
            </li>
          </ul>

          <p v-else class="text-sm text-primary-comfy-canvas/65">
            {{ t('workshop.run.noMedia', locale) }}
          </p>

          <!--
            Always available, never only. The output shape belongs to the
            partner, so whatever the list above found, the document itself is
            the record of what actually came back.
          -->
          <details class="mt-4">
            <summary
              class="cursor-pointer text-sm text-primary-comfy-canvas/65 hover:text-primary-comfy-canvas"
            >
              {{ t('workshop.run.rawOutput', locale) }}
            </summary>
            <pre
              class="mt-3 max-h-120 overflow-auto rounded-xl border border-primary-comfy-canvas/10 bg-black p-5 text-sm/relaxed text-primary-comfy-canvas"
            ><code>{{ JSON.stringify(result.output, null, 2) }}</code></pre>
          </details>
        </div>
      </div>
    </section>

    <WorkshopSignInDialog
      :open="signInOpen"
      :locale="locale"
      @close="signInOpen = false"
      @authenticated="run"
    />
  </div>
</template>

<style scoped>
/*
 * A slow sweep across the placeholder so a three-minute video run still looks
 * alive. Purely decorative, so it is dropped entirely under reduced motion.
 */
.workshop-shimmer {
  background: rgb(255 255 255 / 4%);
}

.workshop-shimmer::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 20%,
    rgb(255 255 255 / 7%) 50%,
    transparent 80%
  );
  animation: workshop-sweep 2.4s ease-in-out infinite;
  content: '';
}

@keyframes workshop-sweep {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .workshop-shimmer::after {
    animation: none;
  }
}
</style>
