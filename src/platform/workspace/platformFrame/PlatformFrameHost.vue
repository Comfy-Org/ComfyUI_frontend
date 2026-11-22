<template>
  <div
    v-if="session"
    :key="session.id"
    class="fixed inset-0 z-overlay flex items-center justify-center bg-black/50 p-4"
    data-testid="platform-frame-host"
  >
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="$t('platformFrame.title')"
      class="relative flex h-[min(760px,calc(100dvh-2rem))] w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
    >
      <iframe
        ref="frame"
        :src="session.url"
        :title="$t('platformFrame.title')"
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
        @click="store.close()"
      >
        <i class="icon-[lucide--x]" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { customDeploymentCreateUrl } from '@/platform/workspace/customDeploymentPitch'
import {
  PLATFORM_FRAME_SANDBOX,
  usePlatformFrameStore
} from '@/platform/workspace/platformFrame/platformFrameStore'
import { handOverWorkflowOnClick } from '@/platform/workspace/platformWorkflowHandoff'
import { platformLinkRel } from '@/platform/workspace/utils/platformLink'

const store = usePlatformFrameStore()
const { session, isUnanswered } = storeToRefs(store)
const frame = useTemplateRef<HTMLIFrameElement>('frame')
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
  if (event.key === 'Escape' && session.value) store.close()
})

function openOnPlatform(event: MouseEvent) {
  if (session.value?.request.handsOverWorkflow)
    handOverWorkflowOnClick(event, 'custom-deployment-card')
  store.close()
}
</script>
