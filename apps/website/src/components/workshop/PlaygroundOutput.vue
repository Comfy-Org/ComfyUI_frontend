<script setup lang="ts">
import { Download, Loader2 } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { Modality } from '../../config/workshop'
import type { RunFailure, RunState } from '../../config/workshop-run'
import { formatElapsed } from '../../config/workshop-run'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  state,
  now,
  modality,
  exampleUrl,
  locale = 'en'
} = defineProps<{
  state: RunState
  now: number
  modality?: Modality
  exampleUrl?: string
  locale?: Locale
}>()

const revealed = defineModel<boolean>('revealed', { default: false })

const emit = defineEmits<{
  cancel: []
  retry: []
  useInCode: []
}>()

const elapsed = computed(() =>
  state.status === 'running' ? formatElapsed(now - state.startedAt) : '0:00'
)

const failureKey: Record<RunFailure, TranslationKey> = {
  validation: 'workshop.error.validation',
  provider: 'workshop.error.provider',
  rateLimit: 'workshop.error.rateLimit',
  policy: 'workshop.error.policy',
  noCredits: 'workshop.error.noCredits',
  unavailable: 'workshop.error.unavailable'
}

const blurred = computed(
  () => state.status === 'succeeded' && state.nsfw && !revealed.value
)
</script>

<template>
  <section
    class="bg-transparency-white-t4 flex min-h-96 flex-col overflow-hidden rounded-2xl border border-transparency-white-t8"
    aria-live="polite"
    data-testid="playground-output"
    :data-state="state.status"
  >
    <header
      class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
    >
      <span>{{ t('workshop.output.title', locale) }}</span>
      <span
        v-if="state.status === 'running'"
        class="text-primary-warm-white tabular-nums"
        data-testid="run-elapsed"
      >
        {{ elapsed }}
      </span>
      <span
        v-else-if="state.status === 'succeeded'"
        class="text-primary-comfy-yellow"
        data-testid="run-credits-used"
      >
        {{ state.creditsUsed }} {{ t('nav.credits', locale) }}
      </span>
    </header>

    <!-- Idle: example output -->
    <div
      v-if="state.status === 'idle'"
      class="relative flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <video
        v-if="exampleUrl && modality === 'video'"
        :src="exampleUrl"
        class="absolute inset-0 size-full object-cover opacity-20"
        autoplay
        muted
        loop
        playsinline
      />
      <img
        v-else-if="exampleUrl"
        :src="exampleUrl"
        alt=""
        class="absolute inset-0 size-full object-cover opacity-20"
      />
      <p class="relative text-sm text-primary-comfy-canvas">
        {{ t('workshop.output.placeholder', locale) }}
      </p>
      <p
        v-if="exampleUrl"
        class="relative text-xs tracking-wider text-primary-warm-gray uppercase"
      >
        {{ t('workshop.output.example', locale) }}
      </p>
    </div>

    <!-- Running -->
    <div
      v-else-if="state.status === 'running'"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <Loader2
        class="text-primary-comfy-yellow size-8 animate-spin"
        aria-hidden="true"
      />
      <p class="text-sm text-primary-warm-white">
        {{ t('workshop.run.running', locale) }}
      </p>
      <p
        v-if="modality === 'video'"
        class="max-w-xs text-xs text-primary-warm-gray"
      >
        {{ t('workshop.run.videoHint', locale) }}
      </p>
      <Button
        variant="outline"
        size="sm"
        data-testid="run-cancel"
        @click="emit('cancel')"
      >
        {{ t('workshop.run.cancel', locale) }}
      </Button>
    </div>

    <!-- Cancelled -->
    <div
      v-else-if="state.status === 'cancelled'"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <p class="text-sm text-primary-comfy-canvas">
        {{ t('workshop.output.cancelled', locale) }}
      </p>
      <Button variant="outline" size="sm" @click="emit('retry')">
        {{ t('workshop.output.runAgain', locale) }}
      </Button>
    </div>

    <!-- Failed -->
    <div
      v-else-if="state.status === 'failed'"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
      data-testid="run-error"
      :data-reason="state.reason"
    >
      <p class="text-primary-comfy-orange text-sm">
        {{ t(failureKey[state.reason], locale) }}
      </p>
      <Button
        v-if="state.reason !== 'validation'"
        variant="outline"
        size="sm"
        @click="emit('retry')"
      >
        {{ t('workshop.error.retry', locale) }}
      </Button>
    </div>

    <!-- Succeeded -->
    <template v-else>
      <div class="relative flex-1 bg-primary-comfy-ink">
        <div
          :class="blurred ? 'blur-2xl select-none' : ''"
          class="size-full transition-[filter]"
        >
          <img
            v-if="state.output.kind === 'image' || state.output.kind === '3d'"
            :src="state.output.url"
            :alt="t('workshop.output.title', locale)"
            class="size-full max-h-128 object-contain"
          />
          <video
            v-else-if="state.output.kind === 'video'"
            :src="state.output.url"
            class="size-full max-h-128 object-contain"
            autoplay
            muted
            loop
            playsinline
            controls
          />
          <pre
            v-else-if="state.output.kind === 'text'"
            class="p-5 font-mono text-sm whitespace-pre-wrap text-primary-warm-white"
            >{{ state.output.text }}</pre>
          <div
            v-else
            class="flex h-full min-h-48 items-end justify-center gap-1 p-8"
            aria-hidden="true"
          >
            <span
              v-for="bar in 32"
              :key="bar"
              class="bg-primary-comfy-yellow/70 w-1.5 rounded-full"
              :style="{ height: `${20 + ((bar * 37) % 60)}%` }"
            />
          </div>
        </div>
        <button
          v-if="blurred"
          type="button"
          class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 text-center"
          data-testid="output-reveal"
          @click="revealed = true"
        >
          <span class="text-sm text-primary-warm-white">
            {{ t('workshop.output.nsfw', locale) }}
          </span>
          <span
            class="text-primary-comfy-yellow text-xs font-bold tracking-wider uppercase"
          >
            {{ t('workshop.output.reveal', locale) }}
          </span>
        </button>
      </div>

      <p
        class="border-t border-transparency-white-t8 px-5 py-2 text-xs text-primary-warm-gray"
      >
        {{ t('workshop.output.expires', locale) }}
      </p>
      <div
        class="flex flex-wrap items-center gap-2 border-t border-transparency-white-t8 p-4"
      >
        <Button
          as="a"
          :href="state.output.url || undefined"
          :download="state.output.fileName"
          :prepend-icon="Download"
          size="sm"
          data-testid="output-download"
        >
          {{ t('workshop.output.download', locale) }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="output-use-in-code"
          @click="emit('useInCode')"
        >
          {{ t('workshop.output.useInCode', locale) }}
        </Button>
        <Button variant="link" size="sm" @click="emit('retry')">
          {{ t('workshop.output.runAgain', locale) }}
        </Button>
      </div>
    </template>
  </section>
</template>
