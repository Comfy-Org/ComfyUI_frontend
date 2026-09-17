<template>
  <DefineDocsLink>
    <Button
      variant="link"
      size="unset"
      class="w-fit gap-1 px-0 py-2 text-sm/5 font-normal hover:underline"
      as="a"
      :href="docsUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ $t('deployToComfyApi.readDocs') }}
      <span class="icon-[lucide--square-arrow-out-up-right] size-4" />
    </Button>
  </DefineDocsLink>

  <div class="@container w-full max-w-[640px]">
    <div
      data-testid="deploy-to-comfy-api-card"
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
        <video
          v-if="videoSrc && !videoFailed"
          :src="videoSrc"
          data-testid="deploy-to-comfy-api-video"
          class="aspect-video w-full rounded-lg object-cover"
          autoplay
          muted
          loop
          playsinline
          @error="videoFailed = true"
        />
        <div
          v-else
          data-testid="deploy-to-comfy-api-video-placeholder"
          class="grid aspect-video w-full place-items-center rounded-lg bg-secondary-background"
        >
          <span
            class="grid size-16 place-items-center rounded-full border border-base-foreground/30 bg-base-foreground/10 text-base-foreground"
            aria-hidden="true"
          >
            <i class="icon-[lucide--play] size-6" />
          </span>
        </div>
      </div>

      <section class="flex flex-col gap-9 p-6 @xl:gap-6 @xl:p-9">
        <div class="flex flex-col gap-4">
          <h2
            :id="titleId"
            class="my-0 text-xl font-semibold text-base-foreground @xl:text-2xl"
          >
            {{ $t('deployToComfyApi.title') }}
          </h2>
          <p class="my-0 text-sm/5 text-muted-foreground">
            {{ $t('deployToComfyApi.body') }}
          </p>
          <ReuseDocsLink class="@xl:hidden" />
        </div>

        <footer
          class="flex flex-col gap-2.5 @xl:flex-row @xl:items-center @xl:justify-end"
        >
          <ReuseDocsLink class="hidden @xl:mr-auto @xl:inline-flex" />
          <Button
            variant="inverted"
            size="lg"
            class="w-full @xl:w-auto"
            data-testid="deploy-to-comfy-api-platform"
            @click="deployOnPlatform"
          >
            {{ $t('deployToComfyApi.deployOnPlatform') }}
          </Button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useExternalLink } from '@/composables/useExternalLink'
import { usePlatformBuildHandoff } from '@/platform/workflow/deploy/composables/usePlatformBuildHandoff'

const { videoSrc = '' } = defineProps<{
  titleId?: string
  videoSrc?: string
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

defineOptions({ inheritAttrs: false })

const { buildDocsUrl } = useExternalLink()
const { open: openPlatformBuild } = usePlatformBuildHandoff()
const [DefineDocsLink, ReuseDocsLink] = createReusableTemplate()
const videoFailed = ref(false)

const docsUrl = buildDocsUrl('/development/overview', { includeLocale: true })

async function deployOnPlatform() {
  await openPlatformBuild()
  emit('done')
}
</script>
