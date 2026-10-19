<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { hubCreatorUrl } from '@/lib/hub/routes'
import type { HubTemplate } from '@/lib/hub/types'
import type { Locale } from '@/i18n/translations'
import HubWorkflowThumbnail from './HubWorkflowThumbnail.vue'
import TagRow from './TagRow.vue'

const {
  template,
  href,
  tryNowLabel,
  locale = 'en',
  creatorDisplayName,
  creatorAvatarUrl,
  showTypeBadge = true,
  showAuthor = true,
  showAction = true,
  providerBadgeAtTop = false
} = defineProps<{
  template: HubTemplate
  href: string
  tryNowLabel: string
  locale?: Locale
  creatorDisplayName?: string
  creatorAvatarUrl?: string
  showTypeBadge?: boolean
  showAuthor?: boolean
  showAction?: boolean
  providerBadgeAtTop?: boolean
}>()

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  '3d': '3D'
}

const authorName = computed(() => template.username || 'ComfyUI')
const creatorUrl = computed(() => hubCreatorUrl(authorName.value))
const external = computed(() => href.startsWith('http'))

const showCreatorRow = computed(() => showAuthor || showAction)
const creatorName = computed(() => creatorDisplayName ?? authorName.value)
const mediaTypeLabel = computed(
  () => MEDIA_TYPE_LABELS[template.mediaType] ?? ''
)
const linkAttributes = computed(() => {
  if (external.value) return { target: '_blank', rel: 'noopener' }
  return {}
})

function openCard() {
  if (external.value) window.open(href, '_blank', 'noopener')
  else window.location.href = href
}
</script>

<template>
  <div
    class="group/pill-trigger group flex cursor-pointer flex-col gap-4 overflow-hidden rounded-4xl bg-hub-surface px-2 pt-2 pb-6 transition-colors duration-200 content-auto hover:bg-hub-surface-hover"
    data-testid="hub-card"
    :data-app="template.isApp"
    @click="openCard"
  >
    <HubWorkflowThumbnail
      :template
      :href
      :locale
      :show-type-badge="showTypeBadge"
      :provider-badge-at-top="providerBadgeAtTop"
    />

    <div class="flex flex-col gap-4 px-4">
      <div
        v-if="showCreatorRow"
        class="flex items-center justify-between gap-2"
      >
        <a
          v-if="showAuthor"
          :href="creatorUrl"
          target="_blank"
          rel="noopener"
          class="flex w-fit min-w-0 items-center gap-2 text-content-secondary hover:text-content"
          @click.stop
        >
          <img
            v-if="creatorAvatarUrl"
            :src="creatorAvatarUrl"
            :alt="creatorName"
            loading="lazy"
            class="size-5 shrink-0 rounded-full object-cover"
          />
          <span
            v-else
            class="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-2xs font-bold text-page"
            aria-hidden="true"
          >
            {{ authorName.charAt(0).toUpperCase() }}
          </span>
          <span class="truncate text-sm">{{ creatorName }}</span>
        </a>
        <a
          v-if="showAction"
          :href="href"
          v-bind="linkAttributes"
          :aria-label="template.title"
          class="relative isolate ml-auto inline-flex h-10 w-fit shrink-0 cursor-pointer items-center overflow-hidden rounded-2xl bg-transparent ps-9 pe-0 text-sm font-bold tracking-wider text-nowrap text-content uppercase transition-all duration-500 group-hover/pill-trigger:bg-primary-comfy-yellow group-hover/pill-trigger:pe-5 group-hover/pill-trigger:text-primary-comfy-ink"
          @click.stop
        >
          <span
            class="grid grid-cols-[0fr] transition-[grid-template-columns] duration-500 group-hover/pill-trigger:grid-cols-[1fr]"
          >
            <span class="overflow-hidden">
              <span class="relative inline-block leading-none">{{
                tryNowLabel
              }}</span>
            </span>
          </span>
          <span
            class="absolute top-1/2 left-1 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl bg-white/20 text-white transition-all duration-500 group-hover/pill-trigger:bg-primary-comfy-yellow group-hover/pill-trigger:text-primary-comfy-ink"
            aria-hidden="true"
          >
            <ChevronRight class="size-4" :stroke-width="2" />
          </span>
        </a>
      </div>
      <TagRow :tags="template.tags" :fallback-label="mediaTypeLabel" />
    </div>
  </div>
</template>
