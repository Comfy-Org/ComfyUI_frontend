<template>
  <DeploymentDialogFrame
    data-testid="deploy-setup-card"
    @dismiss="emit('dismiss')"
  >
    <div class="p-2">
      <Video
        :sources="videoSources"
        :poster-src="posterSrc"
        autoplay
        muted
        loop
        plays-inline
        :playback-labels="{ play: $t('g.play'), pause: $t('g.pause') }"
        class="aspect-video w-full rounded-lg object-cover"
      >
        <template #fallback>
          <div
            class="grid aspect-video w-full place-items-center rounded-lg bg-secondary"
          >
            <span
              class="grid size-16 place-items-center rounded-full border border-foreground/30 bg-foreground/10"
              aria-hidden="true"
            >
              <i class="icon-[lucide--play] size-6" />
            </span>
          </div>
        </template>
      </Video>
    </div>

    <section class="flex flex-col gap-7 px-6 pt-5 pb-6 @xl:px-9 @xl:pb-8">
      <div class="flex flex-col gap-3">
        <DialogTitle class="my-0 text-xl @xl:text-2xl">
          {{ $t('openOnCloud.deploySetupDialog.title') }}
        </DialogTitle>
        <div
          :id="dialogRoot?.descriptionId"
          class="flex flex-col gap-3 text-sm/5 text-muted-foreground"
          aria-live="polite"
        >
          <p class="my-0">
            {{ body ?? $t('openOnCloud.deploySetupDialog.body') }}
          </p>
          <ul class="my-0 flex list-none flex-col gap-2 p-0">
            <li
              v-for="point in points ?? buildPoints"
              :key="point"
              class="flex items-start gap-2.5 text-foreground/75"
            >
              <i
                class="mt-0.75 icon-[lucide--check] size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              {{ point }}
            </li>
          </ul>
          <p v-if="note" class="my-0">
            {{ note }}
          </p>
        </div>
        <DeploymentDocsLink class="@xl:hidden" />
      </div>

      <footer
        class="flex flex-col-reverse gap-2.5 @xl:flex-row @xl:items-center @xl:justify-end"
      >
        <DeploymentDocsLink class="hidden @xl:mr-auto @xl:inline-flex" />
        <slot name="actions">
          <Button
            variant="secondary"
            size="lg"
            class="w-full no-underline @xl:w-auto"
            as="a"
            :href="platformUrl"
            target="_blank"
            :rel="platformLinkRel()"
            @click="openPlatform"
            @auxclick.middle="openPlatform($event, false)"
          >
            {{ $t('deployToComfyApi.deployOnPlatform') }}
            <i
              class="icon-[lucide--square-arrow-out-up-right]"
              aria-hidden="true"
            />
          </Button>
          <DeploySetupAgentMenu @done="emit('done')" />
        </slot>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import { injectDialogRootContext } from 'reka-ui'
import { computed, onScopeDispose } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import Video from '@comfyorg/design-system/media/Video'
import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import { useTelemetry } from '@comfyorg/telemetry'
import { handsPopupsToSystemBrowser } from '@/platform/distribution/desktopBrowser'
import DeploySetupAgentMenu from '@/platform/openOnCloud/components/DeploySetupAgentMenu.vue'
import { useRunOnCloudHandoff } from '@/platform/openOnCloud/useRunOnCloudHandoff'
import { useToast } from '@/components/ui/toast/toastStore'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'
import DeploymentDocsLink from '@/platform/workspace/components/DeploymentDocsLink.vue'
import {
  platformSurfaceLink,
  platformLinkRel,
  platformLinkWindowFeatures
} from '@/platform/workspace/utils/platformLink'

const {
  videoSources = [],
  posterSrc = '',
  body,
  points,
  note
} = defineProps<{
  videoSources?: ComponentProps<typeof Video>['sources']
  posterSrc?: string
  body?: string
  points?: string[]
  note?: string
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

const { t } = useI18n()
const dialogRoot = injectDialogRootContext(null)
const buildPoints = [
  t('openOnCloud.deploySetupDialog.pointNodes'),
  t('openOnCloud.deploySetupDialog.pointGpu'),
  t('openOnCloud.deploySetupDialog.pointPricing')
]
const platformUrl = computed(() =>
  platformSurfaceLink(
    '/profile/deploy?onboarding=custom_comfy_cloud',
    'deploy-setup-card'
  )
)

function trackPlatformClick() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'run_on_cloud_platform_clicked',
    element_group: 'run_on_cloud'
  })
}

const { needsSave, saveActiveWorkflow } = useRunOnCloudHandoff()

const toast = useToast()
let isActive = true
onScopeDispose(() => {
  isActive = false
})

function openSavedPlatform(): boolean {
  if (handsPopupsToSystemBrowser()) {
    window.open(platformUrl.value, '_blank', platformLinkWindowFeatures())
    return true
  }
  const tab = window.open('', '_blank')
  if (!tab) return false
  tab.opener = null
  const link = tab.document.createElement('a')
  link.href = platformUrl.value
  link.rel = platformLinkRel()
  tab.document.body.append(link)
  link.click()
  return true
}

async function openPlatform(event: MouseEvent, closes = true) {
  trackPlatformClick()
  if (!needsSave()) {
    if (closes) emit('done')
    return
  }
  event.preventDefault()
  if (!(await saveActiveWorkflow()) || !isActive) return
  if (!openSavedPlatform()) {
    toast.info(t('openOnCloud.deploySetupDialog.platformTabBlocked'))
    return
  }
  if (closes) emit('done')
}
</script>
