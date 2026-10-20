<script setup lang="ts">
import { ArrowUpRight, Download } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, useTemplateRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useStickyFooterScrollPadding } from '@/composables/useStickyFooterScrollPadding'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphInputMedia } from '@/lib/hub/node-graph-inputs'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

const {
  workflow,
  cloudHref,
  active,
  showAction = true,
  locale = 'en'
} = defineProps<{
  workflow: NodeGraphWorkflow
  cloudHref?: string
  active: boolean
  showAction?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const footer = useTemplateRef<HTMLElement>('footer')
useStickyFooterScrollPadding(footer, () => active && showAction)

const mediaLabels = {
  image: 'workshop.output.kindImage',
  video: 'workshop.output.kindVideo',
  audio: 'workshop.output.kindAudio'
} as const satisfies Record<NodeGraphInputMedia, string>

const expanded = ref(false)
const lead = computed(() => workflow.description[0])
const more = computed(() => workflow.description.slice(1))
</script>

<template>
  <section
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    aria-labelledby="workflow-about-heading"
    data-testid="node-graph-about"
  >
    <h2
      id="workflow-about-heading"
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.nodeGraph.about') }}
    </h2>
    <div class="space-y-6 p-5">
      <div class="space-y-3 text-sm/relaxed text-primary-comfy-canvas">
        <p>{{ lead }}</p>
        <template v-if="expanded">
          <p v-for="paragraph in more" :key="paragraph">{{ paragraph }}</p>
        </template>
        <button
          v-if="more.length"
          type="button"
          class="cursor-pointer text-sm text-primary-warm-gray underline underline-offset-4 hover:text-primary-comfy-yellow"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{
            t(
              expanded
                ? 'workshop.nodeGraph.readLess'
                : 'workshop.nodeGraph.readMore'
            )
          }}
        </button>
      </div>

      <div v-if="workflow.inputs.length" data-testid="node-graph-inputs">
        <h3
          class="text-2xs font-bold tracking-wider text-primary-warm-gray uppercase"
        >
          {{ t('workshop.nodeGraph.provide') }}
        </h3>
        <ul class="mt-3 flex flex-wrap gap-2">
          <li
            v-for="(input, index) in workflow.inputs"
            :key="index"
            class="inline-flex h-8 items-center rounded-lg border border-transparency-white-t8 bg-transparency-white-t4 px-3 text-sm text-primary-comfy-canvas"
          >
            {{ input.title ?? t(mediaLabels[input.media]) }}
          </li>
        </ul>
      </div>
    </div>

    <div
      ref="footer"
      :class="
        cn(
          'mt-auto space-y-3 rounded-b-2xl border-t border-transparency-white-t8 p-3',
          showAction && 'sticky bottom-0 z-10 bg-page/85 backdrop-blur-sm'
        )
      "
      data-testid="node-graph-footer"
    >
      <p class="px-1 text-sm text-primary-warm-gray">
        <span class="font-bold text-primary-comfy-canvas"
          >{{ t('workshop.nodeGraph.runsHereTitle') }}.</span
        >
        {{
          t(
            cloudHref
              ? 'workshop.nodeGraph.runsHereCloud'
              : 'workshop.nodeGraph.runsHereLocal'
          )
        }}
      </p>
      <template v-if="showAction">
        <Button
          v-if="cloudHref"
          as="a"
          :href="cloudHref"
          target="_blank"
          rel="noopener"
          class="min-h-11 w-full font-bold tracking-wider"
          >{{ t('workshop.workflow.tryCloud') }}
          <template #append>
            <ArrowUpRight aria-hidden="true" />
          </template>
        </Button>
        <Button
          v-else
          as="a"
          :href="workflow.downloadUrl"
          download
          class="min-h-11 w-full"
          >{{ t('workshop.workflow.downloadShort') }}
          <template #append>
            <Download aria-hidden="true" />
          </template>
        </Button>
      </template>
    </div>
  </section>
</template>
