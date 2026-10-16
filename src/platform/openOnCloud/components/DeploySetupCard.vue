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
      data-testid="deploy-setup-card"
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

      <section class="flex flex-col gap-7 px-6 pt-5 pb-6 @xl:px-9 @xl:pb-8">
        <div class="flex flex-col gap-3">
          <h2
            :id="titleId"
            class="my-0 text-xl font-semibold text-base-foreground @xl:text-2xl"
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
            class="w-full no-underline @xl:w-auto"
            as="a"
            :href="platformUrl"
            target="_blank"
            rel="noopener noreferrer"
            @click="emit('done')"
          >
            {{ $t('deployToComfyApi.deployOnPlatform') }}
            <i
              class="icon-[lucide--square-arrow-out-up-right] size-4"
              aria-hidden="true"
            />
          </Button>
          <Button
            variant="inverted"
            size="lg"
            :class="cn('w-full @xl:w-auto', !copied && 'gap-3')"
            data-testid="deploy-setup-agent"
            :loading="isCopying"
            @click="copyHandoff"
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
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { createReusableTemplate } from '@vueuse/core'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import Video from '@/components/common/Video.vue'
import Button from '@/components/ui/button/Button.vue'
import { useExternalLink } from '@/composables/useExternalLink'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import AgentMarks from '@/platform/openOnCloud/components/AgentMarks.vue'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'

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
const { copyBrief } = useAgentHandoff()
const [DefineDocsLink, ReuseDocsLink] = createReusableTemplate()
const isCopying = ref(false)
const copied = ref(false)

const docsUrl = buildDocsUrl('/development/overview', { includeLocale: true })
const platformUrl = getComfyPlatformBaseUrl()
const points = [
  t('openOnCloud.deploySetupDialog.pointGpu'),
  t('openOnCloud.deploySetupDialog.pointApi'),
  t('openOnCloud.deploySetupDialog.pointNodes')
]

async function copyHandoff() {
  if (isCopying.value) return
  isCopying.value = true
  copied.value = false
  try {
    copied.value = await copyBrief()
  } finally {
    isCopying.value = false
  }
}
</script>
