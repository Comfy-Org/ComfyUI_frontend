<template>
  <div
    class="flex w-96 flex-col gap-2 overflow-hidden rounded-2xl border border-border-default bg-comfy-menu-bg p-4 text-sm text-base-foreground shadow-lg"
  >
    <!-- Header -->
    <div class="flex w-full items-start gap-2 pb-1">
      <div class="flex min-w-0 flex-1 flex-col items-start gap-2">
        <div
          class="flex w-full flex-col gap-1.5 pr-2 leading-tight wrap-break-word"
        >
          <span class="font-medium">{{ displayName }}</span>
          <span
            v-if="filename"
            class="font-normal break-all text-muted-foreground"
          >
            {{ filename }}
          </span>
        </div>
        <div
          v-if="baseModels.length || sourceUrl"
          class="flex w-full flex-wrap items-start gap-2 pb-1"
        >
          <span
            v-for="baseModel in baseModels"
            :key="baseModel"
            class="inline-flex h-6 max-w-full items-center rounded-full bg-secondary-background px-2 py-1 text-xs text-base-foreground"
          >
            <span class="truncate">{{ baseModel }}</span>
          </span>
          <Button
            v-if="sourceUrl"
            v-tooltip.bottom="$t('cloudModelLibrary.preview.openUrl')"
            variant="secondary"
            size="sm"
            class="h-6 shrink-0 gap-1 rounded-full px-2 font-normal text-base-foreground"
            :aria-label="$t('cloudModelLibrary.preview.openUrl')"
            @click="openSourceUrl"
          >
            {{ $t('cloudModelLibrary.preview.url') }}
            <i class="icon-[lucide--external-link] size-3.5" />
          </Button>
        </div>
      </div>
      <div
        v-if="isCloud"
        class="relative size-27 shrink-0 overflow-hidden rounded-sm bg-muted-background"
      >
        <template v-if="thumbnail">
          <Skeleton v-if="!thumbnailLoaded" class="absolute inset-0" />
          <img
            :src="thumbnail.src"
            :alt="displayName"
            class="size-full object-cover transition-opacity duration-150"
            :class="thumbnailLoaded ? 'opacity-100' : 'opacity-0'"
            @load="thumbnailLoaded = true"
            @error="onMediaError"
          />
        </template>
        <CategoryPlaceholder v-else :category="placeholderCategory" />
      </div>
    </div>

    <!-- Divider: header / description -->
    <div v-if="description" class="-mx-4 border-t border-border-default" />

    <!-- Description -->
    <div v-if="description" class="flex w-full flex-col gap-2 py-2">
      <span
        class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
      >
        {{ $t('cloudModelLibrary.preview.description') }}
      </span>
      <p
        class="max-h-24 scrollbar-thin overflow-y-auto wrap-break-word text-muted-foreground"
      >
        {{ description }}
      </p>
    </div>

    <!-- Trigger words -->
    <div v-if="triggerPhrases.length" class="flex w-full flex-col gap-2 pb-2">
      <div class="flex items-center gap-2.5">
        <span
          class="flex-1 text-xs font-bold tracking-wide text-muted-foreground uppercase"
        >
          {{ $t('cloudModelLibrary.preview.triggerWords') }}
        </span>
        <Button
          v-tooltip.top="$t('g.copyAll')"
          variant="muted-textonly"
          size="icon"
          class="rounded-lg"
          :aria-label="$t('g.copyAll')"
          @click="copyText(triggerPhrases.join(', '))"
        >
          <i class="icon-[lucide--copy] size-4" />
        </Button>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="phrase in triggerPhrases"
          :key="phrase"
          v-tooltip.bottom="
            copiedPhrase === phrase ? $t('g.copied') : $t('g.copyToClipboard')
          "
          variant="secondary"
          size="sm"
          class="h-6 rounded-full px-2 font-normal text-base-foreground"
          @click="copyTriggerPhrase(phrase, $event)"
        >
          {{ truncatePhrase(phrase) }}
        </Button>
      </div>
    </div>

    <!-- Divider: metadata / node preview -->
    <div v-if="previewNodeDef" class="-mx-4 border-t border-border-default" />

    <!-- Node preview -->
    <div v-if="previewNodeDef" class="flex w-full flex-col gap-2">
      <span
        class="mt-2 text-xs font-bold tracking-wide text-muted-foreground uppercase"
      >
        {{ $t('cloudModelLibrary.preview.nodePreview') }}
      </span>
      <div class="flex w-full justify-center py-2.5">
        <div
          ref="previewContainerRef"
          class="overflow-hidden"
          :style="{ width: `${NODE_PREVIEW_WIDTH_PX}px` }"
        >
          <div
            ref="previewWrapperRef"
            class="origin-top-left"
            :style="{ transform: `scale(${nodePreviewScale})` }"
          >
            <LGraphNodePreview :node-def="previewNodeDef" position="relative" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import CategoryPlaceholder from '@/components/sidebar/tabs/cloudModelLibrary/CategoryPlaceholder.vue'
import { formatRowDisplayName } from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { placeholderCategoryForAsset } from '@/composables/sidebarTabs/useCategoryPlaceholder'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetBaseModels,
  getAssetDisplayName,
  getAssetFilename,
  getAssetModelType,
  getAssetSourceUrl,
  getAssetTriggerPhrases,
  getAssetUserDescription
} from '@/platform/assets/utils/assetMetadataUtils'
import { isCloud } from '@/platform/distribution/types'
import LGraphNodePreview from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

const { asset } = defineProps<{ asset: AssetItem }>()

const rawDisplayName = computed(() => getAssetDisplayName(asset))
const displayName = computed(() => formatRowDisplayName(rawDisplayName.value))
const filename = computed(() => {
  const value = getAssetFilename(asset)
  return value && value !== rawDisplayName.value ? value : ''
})

const baseModels = computed(() => getAssetBaseModels(asset))
const description = computed(() => getAssetUserDescription(asset))
const triggerPhrases = computed(() => getAssetTriggerPhrases(asset))

const nativePreviewUrl = computed(
  () => asset.preview_url ?? asset.thumbnail_url ?? ''
)
const nativeErrored = ref(false)
watch(nativePreviewUrl, () => {
  nativeErrored.value = false
})
const thumbnail = computed(() =>
  nativePreviewUrl.value && !nativeErrored.value
    ? { src: nativePreviewUrl.value }
    : null
)
const thumbnailLoaded = ref(false)
watch(
  () => thumbnail.value?.src,
  () => {
    thumbnailLoaded.value = false
  }
)
const placeholderCategory = computed(() => placeholderCategoryForAsset(asset))
function onMediaError() {
  nativeErrored.value = true
}

const sourceUrl = computed(() => getAssetSourceUrl(asset))
function openSourceUrl() {
  if (!sourceUrl.value) return
  window.open(sourceUrl.value, '_blank', 'noopener,noreferrer')
}

// The plain Load node for the asset's category — surfaced as a live preview so
// the user sees the result before inserting.
const previewNodeDef = computed(() => {
  const category = getAssetModelType(asset)
  if (!category) return null
  return useModelToNodeStore().getNodeProvider(category)?.nodeDef ?? null
})

// LGraphNodePreview renders at a fixed 350px; scale it to the Figma node-preview
// width and compensate the container height so the CSS transform doesn't leave
// empty space below the node.
const NODE_PREVIEW_WIDTH_PX = 268
const NODE_BASE_WIDTH_PX = 350
const nodePreviewScale = NODE_PREVIEW_WIDTH_PX / NODE_BASE_WIDTH_PX
const previewContainerRef = ref<HTMLElement>()
const previewWrapperRef = ref<HTMLElement>()
useResizeObserver(previewWrapperRef, (entries) => {
  const entry = entries[0]
  if (entry && previewContainerRef.value) {
    previewContainerRef.value.style.height = `${entry.contentRect.height * nodePreviewScale}px`
  }
})

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

// Tracks the trigger word most recently copied so its tooltip can flip to
// "Copied" as confirmation.
const copiedPhrase = ref<string | null>(null)
let copiedResetTimer: ReturnType<typeof setTimeout> | null = null
const COPIED_FEEDBACK_MS = 1500

async function copyTriggerPhrase(phrase: string, event: MouseEvent) {
  const target = event.currentTarget
  await copyText(phrase)
  copiedPhrase.value = phrase
  // PrimeVue hides the tooltip on click and doesn't refresh a visible tooltip's
  // text, so re-trigger it to surface the updated "Copied" label in place.
  await nextTick()
  if (target instanceof HTMLElement)
    target.dispatchEvent(new MouseEvent('mouseenter'))
  if (copiedResetTimer) clearTimeout(copiedResetTimer)
  copiedResetTimer = setTimeout(() => {
    copiedPhrase.value = null
    copiedResetTimer = null
  }, COPIED_FEEDBACK_MS)
}

onBeforeUnmount(() => {
  if (copiedResetTimer) clearTimeout(copiedResetTimer)
})

const TRIGGER_PHRASE_MAX_LENGTH = 20
function truncatePhrase(phrase: string): string {
  return phrase.length > TRIGGER_PHRASE_MAX_LENGTH
    ? `${phrase.slice(0, TRIGGER_PHRASE_MAX_LENGTH)}…`
    : phrase
}
</script>
