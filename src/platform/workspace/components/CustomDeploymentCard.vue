<template>
  <DefineDocsLink>
    <Button
      variant="link"
      size="link"
      class="w-fit"
      as="a"
      :href="docsUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ $t('deployToComfyApi.readDocs') }}
      <i
        class="icon-[lucide--square-arrow-out-up-right] size-4"
        aria-hidden="true"
      />
    </Button>
  </DefineDocsLink>

  <div class="@container w-[min(640px,calc(100vw-2rem))]">
    <div
      data-testid="custom-deployment-card"
      class="relative max-h-[85dvh] overflow-y-auto rounded-2xl border border-component-node-border bg-base-background shadow-[0_20px_24px_-4px_rgba(10,13,18,0.4),0_8px_8px_-4px_rgba(10,13,18,0.25),0_3px_3px_-1.5px_rgba(10,13,18,0.2)]"
    >
      <Button
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.close')"
        class="absolute top-3 right-3 z-20"
        @click="emit('dismiss')"
      >
        <i class="icon-[lucide--x]" />
      </Button>

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
              class="grid aspect-video w-full place-items-center rounded-lg bg-secondary-background"
            >
              <span
                class="grid size-16 place-items-center rounded-full border border-base-foreground/30 bg-base-foreground/10 text-base-foreground"
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
          <dl
            v-if="pitch.missing?.length"
            data-testid="custom-deployment-missing"
            class="my-1 flex flex-col divide-y divide-interface-stroke rounded-lg border border-interface-stroke bg-secondary-background/40"
          >
            <div
              v-for="row in pitch.missing"
              :key="row.label"
              class="flex flex-col gap-x-3 px-3.5 py-2 text-sm/5 @xl:flex-row"
            >
              <dt class="shrink-0 text-muted-foreground @xl:w-38">
                {{ row.label }}
              </dt>
              <dd class="m-0 min-w-0 wrap-break-word text-base-foreground">
                {{ row.names }}
              </dd>
            </div>
          </dl>
          <p class="my-0 text-sm/5 text-muted-foreground">
            {{ pitch.body }}
          </p>
          <ul class="my-0 flex list-none flex-col gap-2 p-0">
            <li
              v-for="point in pitch.points"
              :key="point"
              class="flex items-start gap-2.5 text-sm/5 text-base-foreground/75"
            >
              <i
                class="mt-0.75 icon-[lucide--check] size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              {{ point }}
            </li>
          </ul>
          <ReuseDocsLink class="@xl:hidden" />
        </div>

        <footer
          class="flex flex-col-reverse gap-2.5 @xl:flex-row @xl:items-center @xl:justify-end"
        >
          <ReuseDocsLink class="hidden @xl:mr-auto @xl:inline-flex" />
          <Button
            variant="secondary"
            size="lg"
            :class="cn('w-full @xl:w-auto', !copied && 'gap-3')"
            data-testid="custom-deployment-agent"
            :loading="isCopying"
            @click="copy(pitch.brief)"
          >
            <template v-if="copied">
              <i class="icon-[lucide--check] size-4" aria-hidden="true" />
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
              class="icon-[lucide--square-arrow-out-up-right] size-4"
              aria-hidden="true"
            />
          </Button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { createReusableTemplate } from '@vueuse/core'
import type { ComponentProps } from 'vue-component-type-helpers'

import Video from '@/components/common/Video.vue'
import Button from '@/components/ui/button/Button.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { useExternalLink } from '@/composables/useExternalLink'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import AgentMarks from '@/platform/workflow/deploy/components/AgentMarks.vue'
import { useBriefCopy } from '@/platform/workspace/composables/useBriefCopy'
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

const { buildDocsUrl } = useExternalLink()
const [DefineDocsLink, ReuseDocsLink] = createReusableTemplate()
const { isCopying, copied, copy } = useBriefCopy()

const docsUrl = buildDocsUrl('/development/overview', { includeLocale: true })
const createDeploymentUrl = `${getComfyPlatformBaseUrl()}/profile/deploy#builds`
</script>
