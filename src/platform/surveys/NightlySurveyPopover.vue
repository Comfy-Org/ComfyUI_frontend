<template>
  <Teleport v-if="hasOpenedOnce" to="body">
    <Transition
      appear
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-x-full opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition duration-300 ease-in"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-full opacity-0"
    >
      <div
        v-show="openModel"
        data-testid="nightly-survey-popover"
        class="fixed right-4 bottom-4 z-10000 w-80 rounded-lg border border-border-subtle bg-base-background p-4 shadow-lg"
      >
        <div class="mb-2 flex items-center justify-end">
          <Button
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="t('g.close')"
            @click="handleDismiss"
          >
            <i class="icon-[lucide--x] size-4" />
          </Button>
        </div>

        <div class="min-h-75">
          <TypeformEmbed :typeform-id="config.typeformId" auto-resize />
        </div>

        <div
          class="mt-3 flex items-center gap-2"
          :class="mode === 'eligible' ? 'justify-center' : 'justify-end'"
        >
          <Button
            v-if="mode === 'eligible'"
            variant="textonly"
            size="sm"
            @click="handleDismiss"
          >
            {{ t('nightlySurvey.notNow') }}
          </Button>
          <Button variant="muted-textonly" size="sm" @click="handleOptOut">
            {{ t('nightlySurvey.dontAskAgain') }}
          </Button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import TypeformEmbed from './TypeformEmbed.vue'
import type { FeatureSurveyConfig } from './useSurveyEligibility'
import { useSurveyEligibility } from './useSurveyEligibility'
import { isTypeformIdValid } from './useTypeformEmbed'

const { config, mode = 'eligible' } = defineProps<{
  config: FeatureSurveyConfig
  /**
   * `eligible` (default): auto-opens after threshold + delay, marks seen on
   * show, renders "Not Now" button. Used by the global controller for
   * floating surveys.
   * `manual`: parent drives visibility via `v-model:open`. Feature site
   * decides when to mark seen / dismiss. Used by inline-CTA surveys.
   */
  mode?: 'eligible' | 'manual'
}>()

const openModel = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  shown: []
  dismissed: []
  optedOut: []
}>()

const { t } = useI18n()

const { isEligible, delayMs, markSurveyShown, optOut } = useSurveyEligibility(
  () => config
)

const hasOpenedOnce = ref(openModel.value)

// Teleport stays mounted after the first open so the Typeform iframe
// persists across consumer-side lifecycle changes.
watch(openModel, (open) => {
  if (open) hasOpenedOnce.value = true
})

let showTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  isEligible,
  (eligible) => {
    if (mode !== 'eligible') return
    if (!eligible) {
      if (showTimeout) {
        clearTimeout(showTimeout)
        showTimeout = null
      }
      return
    }

    if (openModel.value || showTimeout) return

    showTimeout = setTimeout(() => {
      showTimeout = null
      if (!isTypeformIdValid(config.typeformId)) return
      if (openModel.value) return
      openModel.value = true
      markSurveyShown()
      emit('shown')
    }, delayMs.value)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (showTimeout) {
    clearTimeout(showTimeout)
  }
})

function handleDismiss() {
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = null
  }
  openModel.value = false
  emit('dismissed')
}

function handleOptOut() {
  optOut()
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = null
  }
  openModel.value = false
  emit('optedOut')
}
</script>
