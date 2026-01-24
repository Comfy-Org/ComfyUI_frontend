<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import type { FeatureSurveyConfig } from './useSurveyEligibility'
import { useSurveyEligibility } from './useSurveyEligibility'

const { config } = defineProps<{
  config: FeatureSurveyConfig
}>()

const emit = defineEmits<{
  shown: []
  dismissed: []
  optedOut: []
}>()

const { t } = useI18n()

const { isEligible, delayMs, markSurveyShown, optOut } = useSurveyEligibility(
  () => config
)

const isVisible = ref(false)
const isTypeformLoaded = ref(false)
const typeformError = ref(false)
const typeformRef = useTemplateRef('typeformRef')

let showTimeout: ReturnType<typeof setTimeout> | null = null

const typeformId = computed(() => config.typeformId)

watch(
  isEligible,
  (eligible) => {
    if (eligible && !isVisible.value) {
      showTimeout = setTimeout(() => {
        isVisible.value = true
        emit('shown')
      }, delayMs.value)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (showTimeout) {
    clearTimeout(showTimeout)
  }
})

whenever(typeformRef, () => {
  const scriptEl = document.createElement('script')
  scriptEl.src = '//embed.typeform.com/next/embed.js'
  scriptEl.onload = () => {
    isTypeformLoaded.value = true
  }
  scriptEl.onerror = () => {
    typeformError.value = true
  }
  typeformRef.value?.appendChild(scriptEl)
})

function handleAccept() {
  markSurveyShown()
}

function handleDismiss() {
  isVisible.value = false
  emit('dismissed')
}

function handleOptOut() {
  optOut()
  isVisible.value = false
  emit('optedOut')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-in">
      <div
        v-if="isVisible"
        class="fixed bottom-4 right-4 z-[10000] w-80 rounded-lg border border-border-subtle bg-base-background p-4 shadow-lg"
      >
        <div class="mb-3 flex items-start justify-between">
          <h3 class="text-sm font-medium text-text-primary">
            {{ t('nightlySurvey.title') }}
          </h3>
          <button
            class="text-text-muted hover:text-text-primary"
            :aria-label="t('g.close')"
            @click="handleDismiss"
          >
            <i class="icon-[lucide--x] size-4" />
          </button>
        </div>

        <p class="mb-4 text-sm text-text-secondary">
          {{ t('nightlySurvey.description') }}
        </p>

        <div v-if="typeformError" class="mb-4 text-sm text-danger">
          {{ t('nightlySurvey.loadError') }}
        </div>

        <div
          v-show="isVisible && !typeformError"
          ref="typeformRef"
          data-tf-auto-resize
          :data-tf-widget="typeformId"
          class="min-h-[300px]"
        />

        <div class="mt-4 flex flex-col gap-2">
          <Button variant="primary" class="w-full" @click="handleAccept">
            {{ t('nightlySurvey.accept') }}
          </Button>
          <div class="flex gap-2">
            <Button
              variant="textonly"
              class="flex-1 text-xs"
              @click="handleDismiss"
            >
              {{ t('nightlySurvey.notNow') }}
            </Button>
            <Button
              variant="muted-textonly"
              class="flex-1 text-xs"
              @click="handleOptOut"
            >
              {{ t('nightlySurvey.dontAskAgain') }}
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.slide-in-enter-active,
.slide-in-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.slide-in-enter-from,
.slide-in-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.slide-in-enter-to,
.slide-in-leave-from {
  transform: translateX(0);
  opacity: 1;
}
</style>
