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
import { useStorage } from '@vueuse/core'
import { useFuse } from '@vueuse/integrations/useFuse'
import type { UseFuseOptions } from '@vueuse/integrations/useFuse'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import AssetHoverPreview from '@/components/sidebar/tabs/cloudModelLibrary/AssetHoverPreview.vue'
import CloudModelLeaf from '@/components/sidebar/tabs/cloudModelLibrary/CloudModelLeaf.vue'
import CloudPartnerLeaf from '@/components/sidebar/tabs/cloudModelLibrary/CloudPartnerLeaf.vue'
import PartnerNodeHoverPreview from '@/components/sidebar/tabs/cloudModelLibrary/PartnerNodeHoverPreview.vue'
import {
  MODEL_GROUPS,
  PARTNER_NODES_GROUP_ID,
  fallbackGroupLabel,
  formatPartnerProvider,
  getAssetProvider,
  isPartnerNodeCategory
} from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import {
  firstNonModelsTag,
  groupIdForAsset,
  groupLabelForAsset,
  partnerKind,
  rawTagTopLevel
} from '@/components/sidebar/tabs/cloudModelLibrary/modelLibraryGrouping'
import { buildProviderGroups } from '@/components/sidebar/tabs/cloudModelLibrary/modelLibrarySort'
import type {
  Section,
  SidebarItem,
  SortMode
} from '@/components/sidebar/tabs/cloudModelLibrary/modelLibrarySort'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { useModelLibraryHoverPopover } from '@/composables/sidebarTabs/useModelLibraryHoverPopover'
import { useModelLibrarySource } from '@/composables/sidebarTabs/useModelLibrarySource'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetBaseModels,
  getAssetTriggerPhrases
} from '@/platform/assets/utils/assetMetadataUtils'
import { createModelNodeFromAsset } from '@/platform/assets/utils/createModelNodeFromAsset'
import { isCloud } from '@/platform/distribution/types'
import { useLitegraphService } from '@/services/litegraphService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { cn } from '@comfyorg/tailwind-utils'

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

const sections = computed<Section[]>(() => {
  const isSearching = searchQuery.value.trim().length > 0
  const mode = sortMode.value

  // With an active search, collapse category sections into a single flat
  // "Search results" list ordered by Fuse relevance across both pools
  // (assets and partner nodes). Lower score = better match.
  if (isSearching) {
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
      providers: buildProviderGroups(items, mode, isSearching),
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
        providers: buildProviderGroups(items, mode, isSearching),
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

const hoverPopoverRef = ref<HTMLElement | null>(null)
const {
  hoveredItem,
  hoverPopoverStyle,
  handleAssetHoverChange,
  handlePartnerHoverChange,
  handlePopoverEnter,
  handlePopoverLeave
} = useModelLibraryHoverPopover(hoverPopoverRef)

onMounted(() => {
  void refreshAssets()
})
</script>
