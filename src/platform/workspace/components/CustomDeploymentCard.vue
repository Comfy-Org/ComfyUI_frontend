<template>
  <DeploymentDialogFrame
    data-testid="custom-deployment-card"
    @dismiss="emit('dismiss')"
  >
    <div
      v-if="videoSources.length > 0"
      data-testid="custom-deployment-video"
      class="p-2"
    >
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
              class="grid size-16 place-items-center rounded-full border border-foreground/30 bg-foreground/10 text-foreground"
              aria-hidden="true"
            >
              <i class="icon-[lucide--play] size-6" />
            </span>
          </div>
        </template>
      </Video>
    </div>

    <section
      :class="
        cn(
          'flex flex-col gap-7 px-6 pt-5 pb-6 @xl:px-9 @xl:pb-8',
          videoSources.length === 0 && 'pt-9'
        )
      "
    >
      <div class="flex flex-col gap-3">
        <DialogTitle class="my-0 pr-8 text-xl @xl:text-2xl">
          {{ pitch.title }}
        </DialogTitle>
        <MissingItemsTable
          v-if="pitch.missing?.length"
          data-testid="custom-deployment-missing"
          :rows="pitch.missing"
        />
        <p v-if="pitch.body" class="my-0 text-sm/5 text-muted-foreground">
          {{ pitch.body }}
        </p>
        <ul class="my-0 flex list-none flex-col gap-2 p-0">
          <li
            v-for="point in pitch.points"
            :key="point"
            class="flex items-start gap-2.5 text-sm/5 text-foreground/75"
          >
            <i
              class="mt-0.75 icon-[lucide--check] size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            {{ point }}
          </li>
        </ul>
        <DeploymentDocsLink class="@xl:hidden" />
      </div>

      <footer
        class="flex flex-col-reverse gap-2.5 @xl:flex-row @xl:items-center @xl:justify-end"
      >
        <DeploymentDocsLink class="hidden @xl:mr-auto @xl:inline-flex" />
        <AgentMenu
          v-if="offersAgent"
          variant="secondary"
          data-testid="custom-deployment-agent"
          :copy-brief="copyBrief"
          @open-in="openBriefIn"
        >
          <template #label>
            <AgentMarks />
            {{ $t('deployToComfyApi.deployWithAgent') }}
          </template>
        </AgentMenu>
        <Button
          variant="inverted"
          size="lg"
          class="w-full no-underline @xl:w-auto"
          as="a"
          :href="createDeploymentUrl"
          target="_blank"
          :rel="platformLinkRel()"
          data-testid="custom-deployment-platform"
          @click="createOnPlatform"
        >
          {{ pitch.platformLabel }}
          <i
            v-if="!opensInEditor"
            class="icon-[lucide--square-arrow-out-up-right]"
            aria-hidden="true"
          />
        </Button>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { CustomDeploymentEntry } from '@comfyorg/telemetry/types'
import { computed } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import Video from '@comfyorg/design-system/media/Video'
import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import AgentMenu from '@/platform/workflow/deploy/components/AgentMenu.vue'
import AgentMarks from '@/platform/workflow/deploy/components/AgentMarks.vue'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'
import DeploymentDocsLink from '@/platform/workspace/components/DeploymentDocsLink.vue'
import MissingItemsTable from '@/platform/workspace/components/MissingItemsTable.vue'
import { useDeploymentBriefHandoff } from '@/platform/workspace/composables/useDeploymentBriefHandoff'
import { customDeploymentCreateUrl } from '@/platform/workspace/customDeploymentPitch'
import type { CustomDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import type { PlatformFrameRequest } from '@/platform/workspace/platformFrame/platformFrameUrl'
import { openPlatformFrameOnClick } from '@/platform/workspace/platformFrame/platformFrameWaysIn'
import { handOverWorkflowOnClick } from '@/platform/workspace/platformWorkflowHandoff'
import { platformLinkRel } from '@/platform/workspace/utils/platformLink'

const {
  pitch,
  videoSources = [],
  posterSrc = '',
  handsOverWorkflow = false,
  offersAgent = true,
  frameRequest,
  frameEntry
} = defineProps<{
  pitch: CustomDeploymentPitch
  handsOverWorkflow?: boolean
  offersAgent?: boolean
  frameRequest?: PlatformFrameRequest
  frameEntry?: CustomDeploymentEntry
  videoSources?: ComponentProps<typeof Video>['sources']
  posterSrc?: string
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
  platformClicked: []
}>()

defineOptions({ inheritAttrs: false })

const { copyBrief, openBriefIn } = useDeploymentBriefHandoff(() => pitch)

const createDeploymentUrl = computed(() =>
  customDeploymentCreateUrl('custom-deployment-card')
)

const frames = usePlatformFrameStore()
const opensInEditor = computed(
  () =>
    frameRequest !== undefined &&
    frameEntry !== undefined &&
    frames.isAvailable()
)

function createOnPlatform(event: MouseEvent) {
  emit('platformClicked')
  const openedHere =
    frameRequest !== undefined &&
    frameEntry !== undefined &&
    openPlatformFrameOnClick(event, frameRequest, frameEntry)
  if (!openedHere && handsOverWorkflow)
    handOverWorkflowOnClick(event, 'custom-deployment-card')
  emit('done')
}
</script>
