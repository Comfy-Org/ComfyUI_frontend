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
          v-if="surveyUrl"
          :name="IFRAME_NAME"
          :src="surveyUrl"
          :title="$t('manager.survey.title')"
          :style="{ height: `${iframeHeight}px` }"
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
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

const IFRAME_NAME = 'comfy-manager-survey'
const DEFAULT_IFRAME_HEIGHT = 460
const SURVEY_LOAD_TIMEOUT_MS = 8000

defineProps<{
  onClose: () => void
}>()

const { resolvedUserInfo } = useCurrentUser()

// The hosted (external) survey URL is provided per environment by cloud config.
const surveyUrl = computed(() => {
  const base = remoteConfig.value.manager_survey_url
  if (!base) return undefined
  const url = new URL(base)
  // Link responses to the logged-in user; omit for anonymous responses.
  const distinctId = resolvedUserInfo.value?.id
  if (distinctId) url.searchParams.set('distinct_id', distinctId)
  return url.toString()
})

const surveyOrigin = computed(() =>
  surveyUrl.value ? new URL(surveyUrl.value).origin : undefined
)

const status = ref<'loading' | 'ready' | 'error'>(
  surveyUrl.value ? 'loading' : 'error'
)
const iframeHeight = ref(DEFAULT_IFRAME_HEIGHT)

const { stop: stopLoadTimeout } = useTimeoutFn(() => {
  if (status.value === 'loading') status.value = 'error'
}, SURVEY_LOAD_TIMEOUT_MS)

const onIframeLoad = () => {
  if (status.value === 'loading') status.value = 'ready'
  stopLoadTimeout()
}

// PostHog's embedded survey posts its content height for auto-resizing.
useEventListener(window, 'message', (event: MessageEvent) => {
  if (event.origin !== surveyOrigin.value) return
  const data = event.data
  if (
    data?.event === 'posthog:dimensions' &&
    data?.name === IFRAME_NAME &&
    typeof data.height === 'number'
  ) {
    iframeHeight.value = data.height
  }
})
</script>
