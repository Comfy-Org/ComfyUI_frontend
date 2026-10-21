<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ArrowUpRight, Download } from '@lucide/vue'
import { useTemplateRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useStickyFooterScrollPadding } from '@/composables/useStickyFooterScrollPadding'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  cloudHref,
  downloadUrl,
  downloadName = true,
  worksOnCloud,
  active,
  locale = 'en'
} = defineProps<{
  cloudHref?: string
  downloadUrl?: string
  downloadName?: string | boolean
  worksOnCloud?: boolean
  /** Whether the Overview tab is showing, so the footer pads the scroll. */
  active: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ download: []; tryCloud: [] }>()
const { t } = translationsFor(locale)

const footer = useTemplateRef<HTMLElement>('footer')
useStickyFooterScrollPadding(
  footer,
  () => active && Boolean(cloudHref || downloadUrl)
)
</script>

<template>
  <div
    ref="footer"
    :class="
      cn(
        'mt-auto space-y-3 rounded-b-2xl border-t border-transparency-white-t8 p-3',
        (cloudHref || downloadUrl) &&
          'sticky bottom-0 z-10 bg-page/85 backdrop-blur-sm'
      )
    "
    data-testid="node-graph-footer"
  >
    <p
      v-if="cloudHref || downloadUrl"
      class="px-1 text-sm text-primary-warm-gray"
    >
      <span class="font-bold text-primary-comfy-canvas">{{
        t('workshop.nodeGraph.runsHereTitle')
      }}</span>
      {{
        t(
          cloudHref
            ? 'workshop.nodeGraph.runsHereCloud'
            : worksOnCloud === false
              ? 'workshop.nodeGraph.runsHereLocal'
              : 'workshop.nodeGraph.runsHereDownload'
        )
      }}
    </p>
    <Button
      v-if="cloudHref"
      as="a"
      :href="cloudHref"
      target="_blank"
      rel="noopener"
      class="min-h-11 w-full font-bold tracking-wider"
      @click="emit('tryCloud')"
      >{{ t('workshop.workflow.tryCloud') }}
      <template #append>
        <ArrowUpRight aria-hidden="true" />
      </template>
    </Button>
    <Button
      v-else-if="downloadUrl"
      as="a"
      :href="downloadUrl"
      :download="downloadName === true ? '' : downloadName"
      class="min-h-11 w-full"
      @click="emit('download')"
      >{{ t('workshop.workflow.downloadShort') }}
      <template #append>
        <Download aria-hidden="true" />
      </template>
    </Button>
  </div>
</template>
