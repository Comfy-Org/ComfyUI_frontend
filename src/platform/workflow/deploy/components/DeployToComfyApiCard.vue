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
          <p
            class="my-0 text-sm/5 text-muted-foreground"
            data-testid="deploy-to-comfy-api-summary"
          >
            {{ summary }}
          </p>
          <ReuseDocsLink class="@xl:hidden" />
        </div>

        <footer
          class="flex flex-col-reverse gap-2.5 @xl:flex-row @xl:items-center @xl:justify-end"
        >
          <ReuseDocsLink class="hidden @xl:mr-auto @xl:inline-flex" />
          <Button
            ref="agentButton"
            variant="secondary"
            size="lg"
            class="w-full @xl:w-auto"
            :style="{ minWidth: lockedWidth }"
            data-testid="deploy-to-comfy-api-agent"
            :loading="isCopying"
            @click="copyHandoff"
          >
            <template v-if="copiedLabel">
              <i class="icon-[lucide--check] size-4" aria-hidden="true" />
              {{ copiedLabel }}
            </template>
            <template v-else>
              <i class="icon-[lucide--copy] size-4" aria-hidden="true" />
              {{ $t('deployToComfyApi.deployWithAgent') }}
            </template>
          </Button>
          <Button
            variant="inverted"
            size="lg"
            class="w-full @xl:w-auto"
            data-testid="deploy-to-comfy-api-platform"
            @click="openPlatform"
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
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useExternalLink } from '@/composables/useExternalLink'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { BuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'

const {
  inputs,
  handoff,
  requiresExport,
  videoSrc = ''
} = defineProps<{
  inputs: BuildInputs
  handoff: string
  requiresExport: boolean
  titleId?: string
  videoSrc?: string
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

defineOptions({ inheritAttrs: false })

const ICON_WITH_GAP_PX = 24

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()
const { buildDocsUrl } = useExternalLink()
const workflowService = useWorkflowService()
const [DefineDocsLink, ReuseDocsLink] = createReusableTemplate()
const agentButton = useTemplateRef('agentButton')
const isCopying = ref(false)
const videoFailed = ref(false)
const lockedWidth = ref<string>()
const copiedLabel = ref<string>()

const docsUrl = buildDocsUrl('/development/overview', { includeLocale: true })

const summary = computed(() =>
  [
    t('deployToComfyApi.summaryPacks', inputs.nodePacks.length),
    t('deployToComfyApi.summaryModels', inputs.models.length),
    t('deployToComfyApi.summaryClasses', inputs.nodeClasses.length)
  ].join(' · ')
)

function labelThatFits(button: HTMLElement) {
  const full = t('deployToComfyApi.copied')
  const short = t('deployToComfyApi.copiedShort')
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return short
  const style = getComputedStyle(button)
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const available =
    button.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight) -
    ICON_WITH_GAP_PX
  return context.measureText(full).width <= available ? full : short
}

function agentButtonElement(): HTMLElement | undefined {
  const el = agentButton.value?.$el
  return el instanceof HTMLElement ? el : undefined
}

async function copyHandoff() {
  if (isCopying.value) return
  const button = agentButtonElement()
  if (button) lockedWidth.value = `${button.getBoundingClientRect().width}px`
  const label = button
    ? labelThatFits(button)
    : t('deployToComfyApi.copiedShort')
  isCopying.value = true
  try {
    if (requiresExport) {
      await workflowService.exportWorkflow(inputs.workflowName, 'workflow')
    }
    if (await copyToClipboard(handoff, { toastOnSuccess: false })) {
      copiedLabel.value = label
    }
  } finally {
    isCopying.value = false
  }
}

function openPlatform() {
  window.open(getComfyPlatformBaseUrl(), '_blank', 'noopener')
  emit('done')
}
</script>
