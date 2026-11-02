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
      <i class="icon-[lucide--square-arrow-out-up-right]" aria-hidden="true" />
    </Button>
  </DefineDocsLink>

  <DeploymentDialogFrame
    wide
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
        playback-control
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
        <h2
          :id="titleId"
          class="my-0 text-xl font-semibold text-foreground @xl:text-2xl"
        >
          {{ $t('openOnCloud.deploySetup') }}
        </h2>
        <p class="my-0 text-sm/5 text-muted-foreground">
          {{ $t('openOnCloud.deploySetupDialog.body') }}
        </p>
        <ul class="my-0 flex list-none flex-col gap-2 p-0">
          <li
            v-for="point in points"
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
        <ReuseDocsLink class="@xl:hidden" />
      </div>

      <footer
        class="flex flex-col-reverse gap-2.5 @xl:flex-row @xl:items-center @xl:justify-end"
      >
        <ReuseDocsLink class="hidden @xl:mr-auto @xl:inline-flex" />
        <Button
          variant="secondary"
          size="lg"
          class="w-full no-underline @xl:w-auto"
          as="a"
          :href="platformUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click="emit('done')"
        >
          {{ $t('deployToComfyApi.deployOnPlatform') }}
          <i
            class="icon-[lucide--square-arrow-out-up-right]"
            aria-hidden="true"
          />
        </Button>
        <DeploySetupAgentMenu />
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import Video from '@comfyorg/design-system/media/Video'
import Button from '@comfyorg/design-system/button/Button'
import { useExternalLink } from '@/composables/useExternalLink'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import DeploySetupAgentMenu from '@/platform/openOnCloud/components/DeploySetupAgentMenu.vue'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

const { videoSources = [], posterSrc = '' } = defineProps<{
  titleId?: string
  videoSources?: ComponentProps<typeof Video>['sources']
  posterSrc?: string
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

defineOptions({ inheritAttrs: false })

const { t } = useI18n()
const { buildDocsUrl } = useExternalLink()
const [DefineDocsLink, ReuseDocsLink] = createReusableTemplate()

const docsUrl = buildDocsUrl('/development/overview', { includeLocale: true })
const platformUrl = getComfyPlatformBaseUrl()
const points = [
  t('openOnCloud.deploySetupDialog.pointGpu'),
  t('openOnCloud.deploySetupDialog.pointApi'),
  t('openOnCloud.deploySetupDialog.pointNodes')
]
</script>
