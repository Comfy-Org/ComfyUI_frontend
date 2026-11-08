<script setup lang="ts">
import { uniqBy } from 'es-toolkit'
import {
  computed,
  defineAsyncComponent,
  onBeforeUpdate,
  onUpdated,
  ref,
  toValue,
  useId,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { useOutputStacks } from '@/platform/assets/composables/useOutputStacks'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'
import {
  getAssetContentId,
  getAssetFileUrl
} from '@/platform/assets/utils/assetUrlUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import { LOAD3D_VIEWER_DIALOG_PROPS } from '@/extensions/core/load3d/components/load3dViewerDialog'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentOutputsTrayStore } from '@/workbench/extensions/agent/stores/agent/agentOutputsTrayStore'
import {
  asFileSelection,
  outputAttachment,
  outputGalleryItem,
  outputTileKey,
  outputTileKind
} from '@/workbench/extensions/agent/utils/outputTiles'
import OutputTile from './OutputTile.vue'
import OutputsTrayActions from './OutputsTrayActions.vue'

const emit = defineEmits<{ attached: [count: number] }>()

const { t } = useI18n()
const tray = useAgentOutputsTrayStore()
const assetsStore = useAssetsStore()
const composerStore = useAgentComposerStore()
const toast = useToast()
const { downloadAssets } = useMediaAssetActions()

const MediaLightbox = defineAsyncComponent(
  () => import('@/components/sidebar/tabs/queue/MediaLightbox.vue')
)
const Load3dViewerContent = defineAsyncComponent(
  () => import('@/extensions/core/load3d/components/Load3dViewerContent.vue')
)

const SKELETON_COUNT = 9
const GRID_CLASS =
  'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2 p-0'

const titleId = useId()

const loadedAssets = computed(() => toValue(assetsStore.outputAssets.items))
const loading = computed(() => toValue(assetsStore.outputAssets.isLoading))
const hasMoreOnServer = computed(() =>
  toValue(assetsStore.outputAssets.hasMore)
)

const revealed = computed(() =>
  tray.state.phase === 'open' ? tray.state.revealed : 0
)
const more = computed(() =>
  tray.state.phase === 'open' ? tray.state.more : 'idle'
)
const revealedAssets = computed(() =>
  loadedAssets.value.slice(0, revealed.value)
)
const hasHiddenLoaded = computed(
  () => loadedAssets.value.length > revealed.value
)
const canShowMore = computed(
  () => hasHiddenLoaded.value || hasMoreOnServer.value || more.value !== 'idle'
)

const { assetItems, isStackExpanded, toggleStack } = useOutputStacks({
  assets: revealedAssets
})
const stackLoadingKeys = ref<ReadonlySet<string>>(new Set())

const representativeIds = computed(
  () => new Set(revealedAssets.value.map(getAssetContentId))
)
const attachedIds = computed(
  () => new Set(composerStore.attachments.map(({ id }) => id))
)

const tiles = computed(() =>
  assetItems.value
    .filter(
      ({ asset, isChild }) => !isChild || !representativeIds.value.has(asset.id)
    )
    .map(({ asset, isChild }) => {
      const attachment = outputAttachment(asset)
      return {
        key: outputTileKey(asset),
        asset,
        kind: outputTileKind(asset),
        name: getAssetDisplayName(asset),
        attachment,
        inMessage:
          attachment !== undefined && attachedIds.value.has(attachment.id),
        stackCount: isChild
          ? undefined
          : getOutputAssetMetadata(asset.user_metadata)?.outputCount
      }
    })
)
type Tile = (typeof tiles.value)[number]

const selectedTiles = computed(() =>
  tiles.value.filter(({ key }) => tray.selectedKeys.has(key))
)
const attachable = computed(() =>
  uniqBy(
    selectedTiles.value.flatMap(({ attachment, inMessage }) =>
      attachment && !inMessage ? [attachment] : []
    ),
    ({ id }) => id
  )
)
const downloadOnlyCount = computed(
  () => selectedTiles.value.filter(({ attachment }) => !attachment).length
)

const galleryTiles = computed(() =>
  tiles.value.filter(
    ({ kind }) => kind === 'image' || kind === 'video' || kind === 'audio'
  )
)
const galleryItems = computed(() =>
  galleryTiles.value.map(({ asset }) => outputGalleryItem(asset))
)
const previewedKey = ref<string | null>(null)
const galleryIndex = computed(() =>
  galleryTiles.value.findIndex(({ key }) => key === previewedKey.value)
)

watch(galleryIndex, (index) => {
  if (index === -1) previewedKey.value = null
})

watch(
  () => tray.isOpen,
  (open) => {
    if (open) void assetsStore.outputAssets.loadNew()
  },
  { immediate: true }
)

const trayElement = useTemplateRef<HTMLElement>('trayElement')
let focusWasInside = false

onBeforeUpdate(() => {
  focusWasInside = trayElement.value?.contains(document.activeElement) ?? false
})

onUpdated(() => {
  if (!focusWasInside) return
  const active = document.activeElement
  if (active === document.body || active?.matches(':disabled'))
    trayElement.value?.focus({ preventScroll: true })
})

function close(): void {
  tray.dispatch({ type: 'closed' })
}

function refresh(): void {
  void assetsStore.outputAssets.invalidate()
}

async function showMore(): Promise<void> {
  if (hasHiddenLoaded.value) {
    tray.dispatch({ type: 'moreRevealed' })
    return
  }
  if (!hasMoreOnServer.value && more.value !== 'failed') return
  tray.dispatch({ type: 'moreRequested' })
  const advanced = await assetsStore.outputAssets.loadMore().catch(() => false)
  if (more.value === 'loading') tray.dispatch({ type: 'moreLoaded', advanced })
}

async function onToggleStack(asset: AssetItem): Promise<void> {
  const key = outputTileKey(asset)
  if (stackLoadingKeys.value.has(key)) return
  stackLoadingKeys.value = new Set(stackLoadingKeys.value).add(key)
  try {
    await toggleStack(asset)
  } finally {
    stackLoadingKeys.value = new Set(
      [...stackLoadingKeys.value].filter((loadingKey) => loadingKey !== key)
    )
  }
}

function preview(tile: Tile): void {
  if (tile.kind !== '3D') {
    previewedKey.value = tile.key
    return
  }
  useDialogStore().showDialog({
    key: 'asset-3d-viewer',
    title: tile.name,
    component: Load3dViewerContent,
    props: { modelUrl: getAssetFileUrl(tile.asset) },
    dialogComponentProps: LOAD3D_VIEWER_DIALOG_PROPS
  })
}

function onGalleryIndex(index: number): void {
  previewedKey.value = galleryTiles.value[index]?.key ?? null
}

function addToConversation(): void {
  const attachments = attachable.value
  const added = attachments.filter((attachment) =>
    composerStore.addAttachment(attachment)
  ).length
  const failed = attachments.length - added
  tray.dispatch({ type: 'added' })
  emit('attached', added)
  if (failed > 0)
    toast.warning(t('agent.outputs.addFailed', failed), { duration: 5000 })
}

function downloadSelected(): void {
  downloadAssets(selectedTiles.value.map(({ asset }) => asFileSelection(asset)))
  tray.dispatch({ type: 'downloaded' })
}
</script>

<template>
  <section
    v-if="tray.isOpen"
    ref="trayElement"
    data-testid="agent-outputs-tray"
    tabindex="-1"
    :aria-labelledby="titleId"
    class="flex min-h-0 flex-col gap-2 rounded-2xl border border-border/50 bg-secondary p-3 outline-none"
    @keydown.escape.stop.prevent="close"
  >
    <div class="flex shrink-0 items-center justify-between gap-2">
      <p :id="titleId" class="m-0 text-sm font-medium text-foreground">
        {{ t('agent.outputs.title') }}
      </p>
      <Button
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.outputs.close')"
        @click="close"
      >
        <i aria-hidden="true" class="icon-[lucide--x]" />
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <ul v-if="tiles.length > 0" :class="GRID_CLASS">
        <OutputTile
          v-for="tile in tiles"
          :key="tile.key"
          :asset="tile.asset"
          :kind="tile.kind"
          :name="tile.name"
          :selected="tray.selectedKeys.has(tile.key)"
          :in-message="tile.inMessage"
          :stack-count="tile.stackCount"
          :stack-expanded="isStackExpanded(tile.asset)"
          :stack-loading="stackLoadingKeys.has(tile.key)"
          @toggle="tray.dispatch({ type: 'tileToggled', key: tile.key })"
          @preview="preview(tile)"
          @toggle-stack="onToggleStack(tile.asset)"
        />
      </ul>
      <div v-else-if="loading" :class="GRID_CLASS">
        <Skeleton
          v-for="index in SKELETON_COUNT"
          :key="index"
          data-testid="agent-outputs-skeleton"
          class="aspect-square rounded-lg bg-accent"
        />
        <span role="status" class="sr-only">
          {{ t('agent.outputs.loading') }}
        </span>
      </div>
      <div
        v-else
        class="flex flex-col items-center gap-2 px-4 py-6 text-center"
      >
        <p class="m-0 text-sm text-foreground">
          {{ t('agent.outputs.emptyTitle') }}
        </p>
        <p class="m-0 text-xs text-muted-foreground">
          {{ t('agent.outputs.emptyBody') }}
        </p>
        <Button type="button" variant="outline" size="md" @click="refresh">
          {{ t('agent.outputs.refresh') }}
        </Button>
      </div>

      <div
        v-if="tiles.length > 0 && canShowMore"
        class="flex flex-col items-center gap-1 pt-2"
      >
        <p
          v-if="more === 'failed' && !hasHiddenLoaded"
          role="alert"
          class="m-0 text-xs text-muted-foreground"
        >
          {{ t('agent.outputs.loadMoreFailed') }}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="rounded-full border-border"
          :aria-busy="more === 'loading' || undefined"
          @click="showMore"
        >
          {{
            more === 'loading'
              ? t('agent.outputs.loadingMore')
              : t('agent.showMore')
          }}
        </Button>
      </div>
    </div>

    <OutputsTrayActions
      v-if="tiles.length > 0"
      class="shrink-0"
      :selected-count="selectedTiles.length"
      :attachable-count="attachable.length"
      :download-only-count
      @add="addToConversation"
      @download="downloadSelected"
      @clear="tray.dispatch({ type: 'selectionCleared' })"
    />

    <MediaLightbox
      v-if="galleryIndex !== -1"
      :all-gallery-items="galleryItems"
      :active-index="galleryIndex"
      @update:active-index="onGalleryIndex"
    />
  </section>
</template>
