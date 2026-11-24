<template>
  <Dialog :open="session !== null" @update:open="closeWhenDismissed">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent
        v-if="session"
        :key="session.id"
        :aria-describedby="undefined"
        size="full"
        class="max-h-190 max-w-240 overflow-hidden"
        data-testid="platform-frame-host"
        @pointer-down-outside="keepOpenOnOutsidePointer"
      >
        <DialogTitle class="sr-only">
          {{ $t('platformFrame.title') }}
        </DialogTitle>
        <iframe
          ref="frame"
          :src="session.url"
          :title="$t('platformFrame.title')"
          :sandbox="PLATFORM_FRAME_SANDBOX"
          autofocus
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
        <DialogClose>
          <Button
            variant="muted-textonly"
            size="icon"
            :aria-label="$t('g.close')"
            class="absolute top-3 right-3 z-20"
          >
            <i class="icon-[lucide--x]" aria-hidden="true" />
          </Button>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogClose from '@comfyorg/design-system/dialog/DialogClose'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import { customDeploymentCreateUrl } from '@/platform/workspace/customDeploymentPitch'
import {
  PLATFORM_FRAME_SANDBOX,
  usePlatformFrameStore
} from '@/platform/workspace/platformFrame/platformFrameStore'
import { handOverWorkflowOnClick } from '@/platform/workspace/platformWorkflowHandoff'
import {
  platformLinkRel,
  platformSurfaceLink
} from '@/platform/workspace/utils/platformLink'

const store = usePlatformFrameStore()
const { session, isUnanswered } = storeToRefs(store)
const frame = useTemplateRef<HTMLIFrameElement>('frame')
const platformUrl = computed(() => {
  const deploymentId = session.value?.request.deploymentId
  if (!deploymentId) return customDeploymentCreateUrl('custom-deployment-card')
  return platformSurfaceLink(
    `/profile/deployments/${encodeURIComponent(deploymentId)}`,
    'custom-deployment-card'
  )
})

watch(
  frame,
  (element) => {
    const frameWindow = element?.contentWindow
    if (frameWindow) store.attach(frameWindow)
  },
  { flush: 'post' }
)

function closeWhenDismissed(open: boolean) {
  if (!open) store.close()
}

function keepOpenOnOutsidePointer(event: Event) {
  event.preventDefault()
}

function openOnPlatform(event: MouseEvent) {
  if (session.value?.request.handsOverWorkflow)
    handOverWorkflowOnClick(event, 'custom-deployment-card')
  store.close()
}
</script>
