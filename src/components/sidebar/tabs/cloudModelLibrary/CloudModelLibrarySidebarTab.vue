<template>
  <SidebarTabTemplate
    :title="$t('sideToolbar.modelLibrary')"
    tool-buttons-always-visible
  >
    <template #tool-buttons>
      <div class="flex items-center gap-2">
        <Button
          v-tooltip.bottom="$t('g.refresh')"
          variant="muted-textonly"
          size="icon"
          :aria-label="$t('g.refresh')"
          @click="refreshAssets"
        >
          <i class="icon-[lucide--refresh-cw] size-4" />
        </Button>
        <Button
          v-if="isUploadButtonEnabled"
          variant="inverted"
          data-attr="model-library-import-button"
          @click="showUploadDialog"
        >
          <i class="icon-[lucide--folder-input] size-4" />
          <span>{{ $t('assetBrowser.uploadModel') }}</span>
        </Button>
      </div>
    </template>
    <template #header>
      <SidebarTopArea>
        <SearchInput
          v-model="searchQuery"
          :placeholder="$t('g.searchPlaceholder', { subject: '' })"
        />
        <template #actions>
          <Popover :show-arrow="false">
            <template #button>
              <Button
                v-tooltip.bottom="$t('assets.sort.tooltip')"
                variant="secondary"
                size="icon"
                :aria-label="$t('assets.sort.tooltip')"
              >
                <i class="icon-[lucide--arrow-down-up] size-4" />
              </Button>
            </template>
            <template #default>
              <div class="flex min-w-44 flex-col">
                <Button
                  v-for="option in SORT_OPTIONS"
                  :key="option.value"
                  variant="textonly"
                  class="w-full justify-between"
                  @click="sortMode = option.value"
                >
                  <span>{{ $t(option.labelKey) }}</span>
                  <i
                    class="ml-auto icon-[lucide--check] size-4"
                    :class="sortMode !== option.value && 'opacity-0'"
                  />
                </Button>
              </div>
            </template>
          </Popover>
        </template>
      </SidebarTopArea>
    </template>
    <template #body>
      <div
        v-if="isLoading"
        class="flex h-full items-center justify-center text-xs text-muted-foreground"
      >
        {{ $t('g.loading') }}
      </div>
      <div
        v-else-if="!sections.length"
        class="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground"
      >
        {{ $t('assetBrowser.noResultsCanImport') }}
      </div>
      <div v-else class="flex flex-col">
        <template v-for="(section, sectionIndex) in sections" :key="section.id">
          <button
            type="button"
            class="group/tree-node flex w-full min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-sm border-0 bg-transparent py-2 pl-2 text-left outline-none select-none hover:bg-comfy-input"
            :aria-expanded="isExpanded(section.id)"
            :aria-controls="`cloud-model-section-${section.id}`"
            @click="setExpanded(section.id, !isExpanded(section.id))"
          >
            <i
              :class="
                cn(
                  'icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground transition-transform',
                  !isExpanded(section.id) && '-rotate-90'
                )
              "
            />
            <i
              class="icon-[lucide--folder] size-4 shrink-0 text-muted-foreground"
            />
            <span class="text-foreground min-w-0 flex-1 truncate text-sm">
              {{ section.label }}
            </span>
            <span class="shrink-0 pr-2 text-2xs text-muted-foreground">
              {{ section.totalCount }}
            </span>
          </button>
          <div
            v-if="isExpanded(section.id)"
            :id="`cloud-model-section-${section.id}`"
            class="flex flex-col"
            role="list"
          >
            <template v-for="pg in section.providers" :key="pg.provider">
              <div
                v-if="section.providers.length > 1"
                class="pt-2 pr-2 pb-0.5 pl-8 text-3xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                {{ pg.provider }}
              </div>
              <template v-for="item in pg.items" :key="itemKey(item)">
                <CloudModelLeaf
                  v-if="item.kind === 'asset'"
                  :asset="item.asset"
                  @activate="handleAssetActivate"
                  @hover-change="handleAssetHoverChange"
                />
                <CloudPartnerLeaf
                  v-else
                  :node-def="item.nodeDef"
                  @activate="handlePartnerActivate"
                  @hover-change="handlePartnerHoverChange"
                />
              </template>
            </template>
          </div>
          <div
            v-if="
              sectionIndex === lastPinnedSectionIndex &&
              sectionIndex < sections.length - 1
            "
            class="mx-6 my-2 border-t border-border-default/40"
          />
        </template>
      </div>
    </template>
  </SidebarTabTemplate>
  <div id="cloud-model-library-preview-container" />
  <teleport v-if="hoveredItem" to="body">
    <div
      ref="hoverPopoverRef"
      class="fixed z-999"
      :style="hoverPopoverStyle"
      @pointerdown="handlePopoverEnter"
      @mouseenter="handlePopoverEnter"
      @mouseleave="handlePopoverLeave"
    >
      <AssetHoverPreview
        v-if="hoveredItem.kind === 'asset'"
        :asset="hoveredItem.asset"
      />
      <PartnerNodeHoverPreview v-else :node-def="hoveredItem.nodeDef" />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { useEventListener, useResizeObserver, useStorage } from '@vueuse/core'
import { useFuse } from '@vueuse/integrations/useFuse'
import type { UseFuseOptions } from '@vueuse/integrations/useFuse'
import { useToast } from 'primevue/usetoast'
import type { CSSProperties } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import AssetHoverPreview from '@/components/sidebar/tabs/cloudModelLibrary/AssetHoverPreview.vue'
import CloudModelLeaf from '@/components/sidebar/tabs/cloudModelLibrary/CloudModelLeaf.vue'
import CloudPartnerLeaf from '@/components/sidebar/tabs/cloudModelLibrary/CloudPartnerLeaf.vue'
import PartnerNodeHoverPreview from '@/components/sidebar/tabs/cloudModelLibrary/PartnerNodeHoverPreview.vue'
import { getCategoryOverrideForBase } from '@/components/sidebar/tabs/cloudModelLibrary/baseModelCategoryOverrides'
import {
  MODEL_GROUPS,
  PARTNER_NODES_GROUP_ID,
  fallbackGroupLabel,
  formatPartnerProvider,
  formatRowDisplayName,
  getAssetProvider,
  groupIdForRawTag,
  isPartnerNodeCategory
} from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { isCloud } from '@/platform/distribution/types'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useModelLibrarySource } from '@/composables/sidebarTabs/useModelLibrarySource'
import { MODELS_TAG } from '@/platform/assets/services/assetService'
import {
  getAssetBaseModels,
  getAssetDisplayName,
  getAssetTriggerPhrases
} from '@/platform/assets/utils/assetMetadataUtils'
import { formatCategoryLabel } from '@/platform/assets/utils/categoryLabel'
import { createModelNodeFromAsset } from '@/platform/assets/utils/createModelNodeFromAsset'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import { useLitegraphService } from '@/services/litegraphService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { cn } from '@comfyorg/tailwind-utils'

type AssetEntry = { kind: 'asset'; asset: AssetItem }
type PartnerEntry = { kind: 'partner'; nodeDef: ComfyNodeDefImpl }
type SidebarItem = AssetEntry | PartnerEntry

type ProviderGroup = { provider: string; items: SidebarItem[] }
type Section = {
  id: string
  label: string
  providers: ProviderGroup[]
  totalCount: number
}

// Surface the most important categories at the top of the library, in this
// exact order, ahead of the alphabetically-sorted long tail.
const PINNED_GROUP_IDS: readonly string[] = [
  'diffusion',
  'loras',
  PARTNER_NODES_GROUP_ID
]

const { t } = useI18n()
const toast = useToast()
const nodeDefStore = useNodeDefStore()
const litegraphService = useLitegraphService()

// Single unified Model Library source. The cloud distribution reads the live
// assets API; desktop/localhost enumerates the on-disk models folder. Both
// surface the same AssetItem[] shape so this component renders without
// branching on distribution.
const source = useModelLibrarySource()

// Mirrors the asset-browser modal's Import action: a header CTA that opens the
// model upload dialog. Gated on the same feature flag as the modal button, so
// it only surfaces where uploading models is supported (cloud).
const { isUploadButtonEnabled, showUploadDialog } =
  useModelUpload(refreshAssets)

const searchQuery = ref('')

type SortMode =
  | 'recent'
  | 'oldest'
  | 'nameAsc'
  | 'nameDesc'
  | 'baseModelAsc'
  | 'baseModelDesc'

const ALL_SORT_OPTIONS: ReadonlyArray<{ value: SortMode; labelKey: string }> = [
  { value: 'baseModelAsc', labelKey: 'assets.sort.baseModelAsc' },
  { value: 'baseModelDesc', labelKey: 'assets.sort.baseModelDesc' },
  { value: 'recent', labelKey: 'assets.sort.recent' },
  { value: 'oldest', labelKey: 'assets.sort.oldest' },
  { value: 'nameAsc', labelKey: 'assets.sort.nameAsc' },
  { value: 'nameDesc', labelKey: 'assets.sort.nameDesc' }
] as const

// Base-model sort/grouping relies on reliable base-model metadata, which only
// the cloud assets API provides; local builds list models alphabetically.
const SORT_OPTIONS = isCloud
  ? ALL_SORT_OPTIONS
  : ALL_SORT_OPTIONS.filter(
      (option) =>
        option.value !== 'baseModelAsc' && option.value !== 'baseModelDesc'
    )

const UNKNOWN_BASE_MODEL_LABEL = '—'

const sortMode = useStorage<SortMode>(
  'Comfy.CloudModelLibrary.SortBy',
  isCloud ? 'baseModelAsc' : 'nameAsc'
)

// A base-model sort persisted earlier (or shared with the cloud build via the
// same storage key) must not survive on local, where the option is hidden.
if (
  !isCloud &&
  (sortMode.value === 'baseModelAsc' || sortMode.value === 'baseModelDesc')
) {
  sortMode.value = 'nameAsc'
}

const expanded = ref<Record<string, boolean>>({})
const expandedBeforeSearch = ref<Record<string, boolean>>({})

const assets = computed<AssetItem[]>(() => source.assets.value)

const partnerNodes = computed<ComfyNodeDefImpl[]>(() =>
  nodeDefStore.visibleNodeDefs.filter(
    (def) => def.api_node || isPartnerNodeCategory(def.category)
  )
)

const isLoading = computed(
  () => source.isLoading.value && assets.value.length === 0
)

// Weights are tiered so name/filename matches dominate. Secondary metadata
// (tags, provider, baseModels, etc.) only breaks ties — never outranks an
// asset whose name actually contains the query.
const assetFuseOptions: UseFuseOptions<AssetItem> = {
  fuseOptions: {
    keys: [
      { name: 'name', weight: 1.0 },
      { name: 'user_metadata.name', weight: 1.0 },
      { name: 'metadata.name', weight: 0.9 },
      { name: 'metadata.filename', weight: 0.9 },
      { name: 'metadata.filepath', weight: 0.4 },
      { name: 'metadata.repo_id', weight: 0.5 },
      { name: 'tags', weight: 0.15 },
      { name: 'user_metadata.user_description', weight: 0.1 },
      {
        name: 'provider',
        weight: 0.15,
        getFn: (asset) => getAssetProvider(asset)
      },
      {
        name: 'group',
        weight: 0.15,
        getFn: (asset) => groupLabelForAsset(asset)
      },
      {
        name: 'baseModels',
        weight: 0.2,
        getFn: (asset) => getAssetBaseModels(asset)
      },
      {
        name: 'trainedWords',
        weight: 0.15,
        getFn: (asset) => getAssetTriggerPhrases(asset)
      }
    ],
    threshold: 0.3,
    ignoreLocation: true,
    includeScore: true
  },
  matchAllWhenSearchEmpty: true
}

const partnerFuseOptions: UseFuseOptions<ComfyNodeDefImpl> = {
  fuseOptions: {
    keys: [
      { name: 'display_name', weight: 0.5 },
      { name: 'name', weight: 0.3 },
      { name: 'category', weight: 0.2 },
      { name: 'description', weight: 0.2 },
      {
        name: 'provider',
        weight: 0.4,
        getFn: (nodeDef) => formatPartnerProvider(nodeDef.category)
      },
      {
        name: 'kind',
        weight: 0.3,
        getFn: (nodeDef) => partnerKind(nodeDef.category)
      }
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true
  },
  matchAllWhenSearchEmpty: true
}

const { results: assetFuseResults } = useFuse(
  searchQuery,
  assets,
  assetFuseOptions
)
const { results: partnerFuseResults } = useFuse(
  searchQuery,
  partnerNodes,
  partnerFuseOptions
)

const matchedAssets = computed(() =>
  assetFuseResults.value.map((result) => result.item)
)
const matchedPartners = computed(() =>
  partnerFuseResults.value.map((result) => result.item)
)

function firstNonModelsTag(asset: AssetItem): string | null {
  for (const tag of asset.tags) {
    if (tag && tag !== MODELS_TAG) return tag
  }
  return null
}

function rawTagTopLevel(tag: string): string {
  return tag.split('/')[0]
}

function groupLabelForAsset(asset: AssetItem): string {
  const groupId = groupIdForAsset(asset)
  if (groupId) {
    const group = MODEL_GROUPS.find((g) => g.id === groupId)
    if (group) return group.label
  }
  const tag = firstNonModelsTag(asset)
  return tag ? formatCategoryLabel(rawTagTopLevel(tag)) : ''
}

function partnerKind(category: string | undefined): string {
  if (!category) return ''
  const parts = category.split('/')
  return parts[1] ?? ''
}

function groupIdForAsset(asset: AssetItem): string | null {
  const tag = firstNonModelsTag(asset)
  if (!tag) return null
  const tagGroup = groupIdForRawTag(rawTagTopLevel(tag))
  // Cross-base file-types stay in their type bucket. The Base-model sort
  // axis still keeps each family's items grouped together within that bucket.
  if (
    tagGroup === 'loras' ||
    tagGroup === 'vae' ||
    tagGroup === 'conditioning'
  ) {
    return tagGroup
  }
  // Filename-based VAE detection: any file with "vae" in any path segment of
  // its tag, name, or filepath belongs in the VAE bucket — catches assets
  // tagged generically (`latentsync/vae`, `CogVideo/VAE`, `SEEDVR2`) or named
  // `*_vae_*` but tagged as something else.
  if (looksLikeVae(asset, tag)) return 'vae'
  // For everything else, let the resolved base model's primary category
  // override the file-type-derived bucket — keeps a family's text encoders
  // and checkpoints visible together rather than scattered.
  const bases = getAssetBaseModels(asset)
  for (const base of bases) {
    const override = getCategoryOverrideForBase(base)
    if (override) return override
  }
  return tagGroup
}

function looksLikeVae(asset: AssetItem, tag: string): boolean {
  // Any path segment of the tag containing "vae" (handles `latentsync/vae`,
  // `CogVideo/VAE`, etc.)
  for (const segment of tag.split('/')) {
    if (/^vae(_approx)?$/i.test(segment)) return true
  }
  // "vae" appearing as a word in the filename / display name
  const sources = [
    asset.name,
    typeof asset.metadata?.filename === 'string'
      ? asset.metadata.filename
      : undefined,
    typeof asset.metadata?.filepath === 'string'
      ? asset.metadata.filepath
      : undefined
  ]
  for (const source of sources) {
    if (typeof source !== 'string') continue
    if (/(?:^|[^a-zA-Z0-9])vae(?:[^a-zA-Z0-9]|$)/i.test(source)) return true
  }
  return false
}

function itemSortKey(item: SidebarItem): string {
  return item.kind === 'asset'
    ? formatRowDisplayName(getAssetDisplayName(item.asset))
    : (item.nodeDef.display_name ?? item.nodeDef.name)
}

function itemTimestamp(item: SidebarItem): number {
  if (item.kind !== 'asset') return 0
  const ts = item.asset.created_at ?? item.asset.updated_at
  if (!ts) return 0
  const parsed = Date.parse(ts)
  return Number.isNaN(parsed) ? 0 : parsed
}

function compareByName(a: SidebarItem, b: SidebarItem): number {
  return itemSortKey(a).localeCompare(itemSortKey(b), undefined, {
    sensitivity: 'base'
  })
}

function compareByMode(a: SidebarItem, b: SidebarItem, mode: SortMode): number {
  switch (mode) {
    case 'recent':
      return itemTimestamp(b) - itemTimestamp(a) || compareByName(a, b)
    case 'oldest':
      return itemTimestamp(a) - itemTimestamp(b) || compareByName(a, b)
    case 'nameDesc':
    case 'baseModelDesc':
      return -compareByName(a, b)
    case 'nameAsc':
    case 'baseModelAsc':
    default:
      return compareByName(a, b)
  }
}

function isBaseModelMode(mode: SortMode): boolean {
  return mode === 'baseModelAsc' || mode === 'baseModelDesc'
}

function itemBaseModels(item: SidebarItem): string[] {
  if (item.kind === 'asset') return getAssetBaseModels(item.asset)
  return []
}

function buildProviderGroups(items: SidebarItem[]): ProviderGroup[] {
  // When a search is active, preserve Fuse's relevance ranking instead of
  // re-sorting by the user's chosen sort mode.
  if (searchQuery.value.trim().length > 0) {
    return [{ provider: '', items: items.slice() }]
  }
  const mode = sortMode.value
  if (!isBaseModelMode(mode)) {
    return [
      {
        provider: '',
        items: items.slice().sort((a, b) => compareByMode(a, b, mode))
      }
    ]
  }

  // Items with multiple compatible base models show under each. Items with
  // no known base land in a trailing "—" bucket.
  const buckets = new Map<string, SidebarItem[]>()
  for (const item of items) {
    const bases = itemBaseModels(item)
    if (bases.length === 0) {
      const list = buckets.get(UNKNOWN_BASE_MODEL_LABEL) ?? []
      list.push(item)
      buckets.set(UNKNOWN_BASE_MODEL_LABEL, list)
      continue
    }
    for (const base of bases) {
      const list = buckets.get(base) ?? []
      list.push(item)
      buckets.set(base, list)
    }
  }
  const direction = mode === 'baseModelDesc' ? -1 : 1
  const labels = Array.from(buckets.keys()).sort((a, b) => {
    if (a === UNKNOWN_BASE_MODEL_LABEL && b !== UNKNOWN_BASE_MODEL_LABEL)
      return 1
    if (b === UNKNOWN_BASE_MODEL_LABEL && a !== UNKNOWN_BASE_MODEL_LABEL)
      return -1
    return direction * a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
  return labels.map((label) => ({
    provider: label,
    items: (buckets.get(label) ?? []).slice().sort(compareByName)
  }))
}

const sections = computed<Section[]>(() => {
  // With an active search, collapse category sections into a single flat
  // "Search results" list ordered by Fuse relevance across both pools
  // (assets and partner nodes). Lower score = better match.
  if (searchQuery.value.trim().length > 0) {
    type Scored = { score: number; item: SidebarItem }
    const merged: Scored[] = []
    for (const r of assetFuseResults.value) {
      merged.push({
        score: r.score ?? 1,
        item: { kind: 'asset', asset: r.item }
      })
    }
    for (const r of partnerFuseResults.value) {
      merged.push({
        score: r.score ?? 1,
        item: { kind: 'partner', nodeDef: r.item }
      })
    }
    if (merged.length === 0) return []
    merged.sort((a, b) => a.score - b.score)
    return [
      {
        id: 'search-results',
        label: t('assets.searchResults'),
        providers: [{ provider: '', items: merged.map((m) => m.item) }],
        totalCount: merged.length
      }
    ]
  }

  const knownGroups = MODEL_GROUPS.filter(
    (g) => g.id !== PARTNER_NODES_GROUP_ID
  )
  const assetsByGroup = new Map<string, AssetItem[]>()
  const unmappedByTag = new Map<string, AssetItem[]>()

  for (const asset of matchedAssets.value) {
    const tag = firstNonModelsTag(asset)
    if (!tag) continue
    const top = rawTagTopLevel(tag)
    // groupIdForAsset applies the base-model category override (e.g. an
    // ACE-Step text encoder lands under "TTS & audio" with its base, not
    // "Encoders"). Falls back to the tag-derived group for assets with no
    // resolvable base.
    const groupId = groupIdForAsset(asset)
    if (groupId) {
      const list = assetsByGroup.get(groupId) ?? []
      list.push(asset)
      assetsByGroup.set(groupId, list)
    } else {
      const list = unmappedByTag.get(top) ?? []
      list.push(asset)
      unmappedByTag.set(top, list)
    }
  }

  const filteredPartners = matchedPartners.value

  const result: Section[] = []

  // The curated PINNED_GROUP_IDS render first in their declared order
  // (Diffusion → LoRAs → Partner nodes); everything else interleaves
  // alphabetically below.
  const makeAssetSection = (
    id: string,
    label: string,
    list: AssetItem[]
  ): Section | null => {
    if (list.length === 0) return null
    const items: SidebarItem[] = list.map((asset) => ({ kind: 'asset', asset }))
    return {
      id,
      label,
      providers: buildProviderGroups(items),
      totalCount: items.length
    }
  }

  const buildSection = (id: string): Section | null => {
    if (id === PARTNER_NODES_GROUP_ID) {
      if (filteredPartners.length === 0) return null
      const items: SidebarItem[] = filteredPartners.map((nodeDef) => ({
        kind: 'partner',
        nodeDef
      }))
      return {
        id: PARTNER_NODES_GROUP_ID,
        label: t('sideToolbar.nodeLibraryTab.sections.partnerNodes'),
        providers: buildProviderGroups(items),
        totalCount: items.length
      }
    }
    const group = MODEL_GROUPS.find((g) => g.id === id)
    if (!group) return null
    return makeAssetSection(
      group.id,
      group.label,
      assetsByGroup.get(group.id) ?? []
    )
  }

  const pinnedSections: Section[] = []
  for (const id of PINNED_GROUP_IDS) {
    const section = buildSection(id)
    if (section) pinnedSections.push(section)
  }

  type PendingSection = { sortKey: string; section: Section }
  const pending: PendingSection[] = []
  const collect = (section: Section | null) => {
    if (section) pending.push({ sortKey: section.label, section })
  }

  for (const group of knownGroups) {
    if (PINNED_GROUP_IDS.includes(group.id)) continue
    collect(
      makeAssetSection(group.id, group.label, assetsByGroup.get(group.id) ?? [])
    )
  }

  for (const tag of unmappedByTag.keys()) {
    collect(
      makeAssetSection(
        `tag:${tag}`,
        fallbackGroupLabel(tag),
        unmappedByTag.get(tag) ?? []
      )
    )
  }

  pending.sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' })
  )

  for (const section of pinnedSections) result.push(section)
  for (const { section } of pending) result.push(section)

  return result
})

// Index of the last pinned section — used by the template to render a
// delimiter between the curated stack and the alphabetical long tail.
const lastPinnedSectionIndex = computed<number>(() => {
  let lastIndex = -1
  for (let i = 0; i < sections.value.length; i++) {
    if (PINNED_GROUP_IDS.includes(sections.value[i].id)) lastIndex = i
  }
  return lastIndex
})

const isExpanded = (id: string) => Boolean(expanded.value[id])

const setExpanded = (id: string, open: boolean) => {
  expanded.value = { ...expanded.value, [id]: open }
}

function itemKey(item: SidebarItem): string {
  return item.kind === 'asset' ? `a:${item.asset.id}` : `n:${item.nodeDef.name}`
}

watch(searchQuery, (next, prev) => {
  const wasSearching = prev.trim().length > 0
  const nowSearching = next.trim().length > 0
  if (!wasSearching && nowSearching) {
    expandedBeforeSearch.value = { ...expanded.value }
    const expandAll: Record<string, boolean> = {}
    for (const section of sections.value) expandAll[section.id] = true
    expanded.value = expandAll
  } else if (wasSearching && !nowSearching) {
    expanded.value = { ...expandedBeforeSearch.value }
  }
})

async function refreshAssets(): Promise<void> {
  await source.refresh()
}

const handleAssetActivate = (asset: AssetItem) => {
  const result = createModelNodeFromAsset(asset)
  if (!result.success) {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('assetBrowser.failedToCreateNode'),
      life: 4000
    })
  }
}

const handlePartnerActivate = (nodeDef: ComfyNodeDefImpl) => {
  litegraphService.addNodeOnGraph(nodeDef)
}

// Single shared hover popover, owned by the sidebar tab. Leaves emit
// `hover-change` with their row rect; we position the popover next to the
// row, swap content as the user moves between rows (no stacking), and
// support the row → popover mouse bridge with a short hide delay.
const HOVER_BRIDGE_DELAY_MS = 120
const HOVER_GAP_PX = 12
const HOVER_VIEWPORT_MARGIN_PX = 8

type HoveredItem =
  | { kind: 'asset'; asset: AssetItem; rect: DOMRect }
  | { kind: 'partner'; nodeDef: ComfyNodeDefImpl; rect: DOMRect }

const hoveredItem = ref<HoveredItem | null>(null)
const hoverPopoverRef = ref<HTMLElement | null>(null)
const hoverPopoverStyle = ref<CSSProperties>({ top: '0px', left: '0px' })

let hoverHideTimer: ReturnType<typeof setTimeout> | null = null
function cancelHoverHide() {
  if (hoverHideTimer !== null) {
    clearTimeout(hoverHideTimer)
    hoverHideTimer = null
  }
}
function scheduleHoverHide() {
  cancelHoverHide()
  hoverHideTimer = setTimeout(() => {
    hoveredItem.value = null
    hoverHideTimer = null
  }, HOVER_BRIDGE_DELAY_MS)
}

function handleAssetHoverChange(
  payload: { asset: AssetItem; rect: DOMRect } | { asset: null }
) {
  if (payload.asset) {
    cancelHoverHide()
    hoveredItem.value = {
      kind: 'asset',
      asset: payload.asset,
      rect: payload.rect
    }
  } else {
    scheduleHoverHide()
  }
}
function handlePartnerHoverChange(
  payload: { nodeDef: ComfyNodeDefImpl; rect: DOMRect } | { nodeDef: null }
) {
  if (payload.nodeDef) {
    cancelHoverHide()
    hoveredItem.value = {
      kind: 'partner',
      nodeDef: payload.nodeDef,
      rect: payload.rect
    }
  } else {
    scheduleHoverHide()
  }
}
function handlePopoverEnter() {
  cancelHoverHide()
}
function handlePopoverLeave() {
  scheduleHoverHide()
}

async function updateHoverPopoverPosition() {
  const rect = hoveredItem.value?.rect
  if (!rect) return
  await nextTick()
  const el = hoverPopoverRef.value
  const popoverHeight = el?.offsetHeight ?? 240
  const minTop = HOVER_VIEWPORT_MARGIN_PX
  const maxTop = Math.max(
    minTop,
    window.innerHeight - popoverHeight - HOVER_VIEWPORT_MARGIN_PX
  )
  const top = Math.max(minTop, Math.min(rect.top, maxTop))
  hoverPopoverStyle.value = {
    top: `${top}px`,
    left: `${rect.right + HOVER_GAP_PX}px`
  }
}

watch(hoveredItem, () => {
  void updateHoverPopoverPosition()
})
useResizeObserver(hoverPopoverRef, () => {
  void updateHoverPopoverPosition()
})
useEventListener(window, 'resize', () => {
  void updateHoverPopoverPosition()
})
useEventListener(
  window,
  'scroll',
  () => {
    void updateHoverPopoverPosition()
  },
  true
)

onBeforeUnmount(() => {
  cancelHoverHide()
})

onMounted(() => {
  void refreshAssets()
})
</script>
