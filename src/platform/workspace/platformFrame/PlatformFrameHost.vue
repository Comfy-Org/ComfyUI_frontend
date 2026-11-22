<template>
  <div
    v-if="session"
    :key="session.id"
    :class="
      cn(
        'fixed inset-0 z-overlay flex items-center justify-center bg-black/50 p-4',
        isHidden && 'pointer-events-none invisible'
      )
    "
    :aria-hidden="isHidden || undefined"
    data-testid="platform-frame-host"
  >
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      :class="
        cn(
          'relative flex size-full flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl',
          isPreinstall ? 'max-h-130 max-w-180' : 'max-h-190 max-w-240'
        )
      "
      data-testid="platform-frame-dialog"
    >
      <iframe
        ref="frame"
        :src="session.url"
        :title="title"
        :sandbox="PLATFORM_FRAME_SANDBOX"
        class="size-full border-0"
        data-testid="platform-frame"
      />
      <div
        v-show="isUnanswered"
        role="status"
        class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background p-6 text-center"
        data-testid="platform-frame-unanswered"
      >
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('platformFrame.unanswered') }}
        </p>
        <Button
          variant="inverted"
          size="lg"
          as="a"
          :href="platformUrl"
          target="_blank"
          :rel="platformLinkRel()"
          class="no-underline"
          @click="openOnPlatform"
        >
          {{ $t('platformFrame.openOnPlatform') }}
          <i
            class="icon-[lucide--square-arrow-out-up-right]"
            aria-hidden="true"
          />
        </Button>
      </div>
      <Button
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.close')"
        class="absolute top-3 right-3 z-20"
        @click="store.dismiss()"
      >
        <i class="icon-[lucide--x]" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { customDeploymentCreateUrl } from '@/platform/workspace/customDeploymentPitch'
import {
  PLATFORM_FRAME_SANDBOX,
  usePlatformFrameStore
} from '@/platform/workspace/platformFrame/platformFrameStore'
import { handOverWorkflowOnClick } from '@/platform/workspace/platformWorkflowHandoff'
import { platformLinkRel } from '@/platform/workspace/utils/platformLink'

const store = usePlatformFrameStore()
const { session, isUnanswered, isHidden } = storeToRefs(store)
const frame = useTemplateRef<HTMLIFrameElement>('frame')
const { t } = useI18n()
const isPreinstall = computed(
  () => session.value?.request.step === 'preinstall'
)
const title = computed(() =>
  isPreinstall.value
    ? t('platformFrame.preinstallTitle')
    : t('platformFrame.title')
)
const platformUrl = computed(() =>
  customDeploymentCreateUrl('custom-deployment-card')
)

watch(
  frame,
  (element) => {
    const frameWindow = element?.contentWindow
    if (frameWindow) store.attach(frameWindow)
  },
  { flush: 'post' }
)

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && session.value && !isHidden.value)
    store.dismiss()
})

function openOnPlatform(event: MouseEvent) {
  if (session.value?.request.handsOverWorkflow)
    handOverWorkflowOnClick(event, 'custom-deployment-card')
  store.close()
}
</script>
