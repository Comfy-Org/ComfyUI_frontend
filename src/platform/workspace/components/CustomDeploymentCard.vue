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
        playback-control
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
        <p
          v-if="pitch.note"
          data-testid="custom-deployment-note"
          class="my-0 flex items-start gap-2 text-sm/5 text-foreground/75"
        >
          <i
            class="mt-0.75 icon-[lucide--info] size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          {{ pitch.note }}
        </p>
        <p class="my-0 text-sm/5 text-muted-foreground">
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
        <Button
          variant="secondary"
          size="lg"
          :class="cn('w-full @xl:w-auto', !copied && 'gap-3')"
          data-testid="custom-deployment-agent"
          :loading="isCopying"
          @click="copy(pitch.brief)"
        >
          <template v-if="copied">
            <i class="icon-[lucide--check]" aria-hidden="true" />
            {{ $t('deployToComfyApi.copied') }}
          </template>
          <template v-else>
            <AgentMarks />
            {{ $t('deployToComfyApi.deployWithAgent') }}
          </template>
        </Button>
        <Button
          variant="inverted"
          size="lg"
          class="w-full no-underline @xl:w-auto"
          as="a"
          :href="createDeploymentUrl"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="custom-deployment-platform"
          @click="emit('done')"
        >
          {{ pitch.platformLabel }}
          <i
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
import type { ComponentProps } from 'vue-component-type-helpers'

import Video from '@comfyorg/design-system/media/Video'
import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import AgentMarks from '@/platform/workflow/deploy/components/AgentMarks.vue'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'
import DeploymentDocsLink from '@/platform/workspace/components/DeploymentDocsLink.vue'
import MissingItemsTable from '@/platform/workspace/components/MissingItemsTable.vue'
import { useBriefCopy } from '@/platform/workspace/composables/useBriefCopy'
import { customDeploymentCreateUrl } from '@/platform/workspace/customDeploymentPitch'
import type { CustomDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'

const {
  pitch,
  videoSources = [],
  posterSrc = ''
} = defineProps<{
  pitch: CustomDeploymentPitch
  videoSources?: ComponentProps<typeof Video>['sources']
  posterSrc?: string
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

defineOptions({ inheritAttrs: false })

const { isCopying, copied, copy } = useBriefCopy()

const createDeploymentUrl = customDeploymentCreateUrl()
</script>
