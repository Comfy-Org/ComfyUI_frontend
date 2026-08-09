<template>
  <div class="flex w-full flex-col">
    <header
      class="flex h-12 items-center justify-between gap-2 border-b border-border-default px-4"
    >
      <div class="flex items-center gap-2">
        <i class="icon-[comfy--extensions-blocks]" />
        <h2 class="text-neutral m-0 text-base">
          {{ $t('manager.survey.title') }}
        </h2>
      </div>
      <Button size="icon" :aria-label="$t('g.close')" @click="onClose">
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </header>

    <main class="px-5 py-4">
      <p
        v-if="status !== 'error'"
        class="mt-1 mb-4 text-sm text-muted-foreground"
      >
        {{ $t('manager.survey.intro') }}
      </p>
      <div class="relative">
        <iframe
          v-if="surveyUrl && status !== 'error'"
          :src="surveyUrl"
          :title="$t('manager.survey.title')"
          :style="{ height: `${iframeHeight}px` }"
          sandbox="allow-scripts allow-same-origin allow-forms"
          data-testid="manager-survey-iframe"
          class="w-full rounded-lg border-0"
          @load="onIframeLoad"
        />
        <div
          v-if="status === 'loading'"
          data-testid="manager-survey-loading"
          class="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <i
            class="icon-[lucide--loader-2] size-6 animate-spin text-muted-foreground"
          />
        </div>
        <div
          v-else-if="status === 'error'"
          data-testid="manager-survey-error"
          class="flex min-h-56 flex-col items-center justify-center gap-2 text-center"
        >
          <i
            class="icon-[lucide--triangle-alert] size-6 text-muted-foreground"
          />
          <p class="m-0 text-sm text-muted-foreground">
            {{ $t('manager.survey.error') }}
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

const DEFAULT_IFRAME_HEIGHT = 460
const MAX_IFRAME_HEIGHT = 10000
const SURVEY_LOAD_TIMEOUT_MS = 8000

defineProps<{
  onClose: () => void
}>()

const { resolvedUserInfo } = useCurrentUser()

// The hosted (external) survey URL is provided per environment by cloud config.
const surveyUrl = computed(() => {
  const base = remoteConfig.value.manager_survey_url
  if (!base) return undefined
  try {
    const url = new URL(base)
    // Link responses to the logged-in user; omit for anonymous responses.
    const distinctId = resolvedUserInfo.value?.id
    if (distinctId) url.searchParams.set('distinct_id', distinctId)
    return url.toString()
  } catch {
    // A malformed configured URL falls back to the error state.
    return undefined
  }
})

const parsedSurveyUrl = computed(() =>
  surveyUrl.value ? new URL(surveyUrl.value) : undefined
)
const surveyOrigin = computed(() => parsedSurveyUrl.value?.origin)
// filter(Boolean) tolerates a trailing slash in the configured URL.
const surveyId = computed(() =>
  parsedSurveyUrl.value?.pathname.split('/').filter(Boolean).pop()
)

const status = ref<'loading' | 'ready' | 'error'>('loading')
const iframeHeight = ref(DEFAULT_IFRAME_HEIGHT)

const { start: startLoadTimeout, stop: stopLoadTimeout } = useTimeoutFn(
  () => {
    if (status.value === 'loading') status.value = 'error'
  },
  SURVEY_LOAD_TIMEOUT_MS,
  { immediate: false }
)

// Re-derive load state whenever the survey URL changes — e.g. cloud config or
// the user identity arriving after the dialog opens — so a late URL recovers
// from the error state instead of staying stuck.
watch(
  surveyUrl,
  (url) => {
    if (!url) {
      stopLoadTimeout()
      status.value = 'error'
      return
    }
    status.value = 'loading'
    startLoadTimeout()
  },
  { immediate: true }
)

const onIframeLoad = () => {
  if (status.value === 'loading') status.value = 'ready'
  stopLoadTimeout()
}

// PostHog's embedded survey posts its content height for auto-resizing.
useEventListener(window, 'message', (event: MessageEvent) => {
  if (event.origin !== surveyOrigin.value) return
  const data = event.data
  if (
    data?.type === 'posthog:survey:height' &&
    data?.surveyId === surveyId.value
  ) {
    const height = Number.parseInt(data.height, 10)
    if (height > 0 && height < MAX_IFRAME_HEIGHT) iframeHeight.value = height
  }
})
</script>
