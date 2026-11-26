<template>
  <Dialog
    v-if="session"
    :open="!isHidden"
    :unmount-on-hide="false"
    @update:open="dismissWhenClosed"
  >
    <DialogPortal>
      <DialogOverlay v-if="!isHidden" />
      <DialogContent
        :key="session.id"
        :aria-describedby="undefined"
        size="full"
        :class="
          cn(
            'overflow-hidden',
            isPreinstall
              ? 'max-h-130 max-w-180'
              : 'inset-6 m-auto size-auto max-h-256 max-w-280 translate-none'
          )
        "
        data-testid="platform-frame-host"
        @pointer-down-outside="keepOpenOnOutsidePointer"
      >
        <DialogTitle class="sr-only">
          {{ title }}
        </DialogTitle>
        <iframe
          ref="frame"
          :src="session.url"
          :title="title"
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
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

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

watch(
  () => store.isResumable(),
  (resumable) => {
    if (resumable) store.resume()
  },
  { immediate: true }
)

function dismissWhenClosed(open: boolean) {
  if (!open) store.dismiss()
}

function keepOpenOnOutsidePointer(event: Event) {
  event.preventDefault()
}

const handsOverToNewBuild = computed(() => {
  const request = session.value?.request
  return !!request?.handsOverWorkflow && !request.deploymentId
})

function openOnPlatform(event: MouseEvent) {
  if (handsOverToNewBuild.value)
    handOverWorkflowOnClick(event, 'custom-deployment-card')
  store.dismiss()
}
</script>
