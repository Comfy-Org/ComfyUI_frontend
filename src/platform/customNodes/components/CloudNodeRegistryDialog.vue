<template>
  <BaseModalLayout
    v-model:right-panel-open="isRightPanelOpen"
    :content-title="$t('manager.discoverCommunityContent')"
    :right-panel-title="$t('manager.nodePackInfo')"
  >
    <template #leftPanelHeaderTitle>
      <i class="icon-[comfy--extensions-blocks] size-5" />
      <h2 class="m-0 text-base">{{ $t('customNodePacks.registry.title') }}</h2>
    </template>
    <template #leftPanel>
      <LeftSidePanel v-model="filter" :nav-items="navItems" />
    </template>
    <template #header>
      <SearchInput
        v-model="query"
        :placeholder="$t('manager.searchPlaceholder')"
        :aria-label="$t('customNodePacks.registry.search')"
        :debounce-time="0"
        class="max-w-96 flex-1"
      />
      <SingleSelect
        v-model="version"
        :options="versionOptions"
        :label="$t('customNodePacks.registry.nodeVersion')"
        class="min-w-32"
      />
      <Button
        variant="secondary"
        size="icon"
        :disabled="busy"
        :aria-label="$t('customNodePacks.registry.refresh')"
        @click="load"
      >
        <i class="icon-[lucide--refresh-cw] size-4" />
      </Button>
    </template>
    <template #contentFilter>
      <div class="flex flex-col gap-2 px-6 pb-4">
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t('customNodePacks.registry.description') }}
        </p>
        <div class="flex items-center justify-between gap-3">
          <span v-if="catalog" class="text-xs text-muted-foreground">{{
            $t('customNodePacks.registry.corpus', {
              count: catalog.revisions.length,
              commit: catalog.corpus_commit.slice(0, 12)
            })
          }}</span>
          <SingleSelect
            v-model="sort"
            :options="sortOptions"
            :label="$t('g.sort')"
            class="w-48"
          />
        </div>
        <p v-if="state.phase === 'error'" role="alert" class="m-0 text-sm">
          {{ $t('customNodePacks.registry.failed') }}
          {{
            $t(`customNodePacks.registry.errors.${state.failure.reason}`, {
              status:
                state.failure.reason === 'http'
                  ? state.failure.status
                  : undefined
            })
          }}
        </p>
      </div>
    </template>
    <template #content>
      <div v-if="!catalog && busy" role="status">
        {{ $t('customNodePacks.loading') }}
      </div>
      <p v-else-if="catalog && !packs.length" class="text-sm">
        {{ $t('customNodePacks.registry.noMatches') }}
      </p>
      <VirtualGrid
        v-else
        :items="packs"
        :buffer-rows="4"
        :grid-style="gridStyle"
      >
        <template #item="{ item }">
          <CloudNodeRegistryCard
            :revision="item.displayRevision"
            :is-selected="selectedRevision?.name === item.name"
            :busy
            :blocked="state.phase === 'error'"
            :saving-revision="savingRevision"
            @select="selectedRevisionId = $event"
            @pin="setPin"
          />
        </template>
      </VirtualGrid>
      <p class="m-0 pt-3 text-xs text-muted-foreground">
        {{ $t('customNodePacks.registry.qualification') }}
      </p>
    </template>
    <template #rightPanel>
      <CloudNodeRegistryInfo
        v-if="selectedRevision"
        :revision="selectedRevision"
        :revisions="packRevisions"
        :busy
        :blocked="state.phase === 'error'"
        :saving-revision="savingRevision"
        @select="selectedRevisionId = $event"
        @pin="setPin"
      />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useCloudNodeRegistry } from '@/platform/customNodes/composables/useCloudNodeRegistry'
import { cloudRegistryPacks } from '@/platform/customNodes/utils/cloudRegistryView'
import type { RegistryFilter } from '@/platform/customNodes/utils/cloudRegistryView'
import { OnCloseKey } from '@/types/widgetTypes'

import CloudNodeRegistryCard from './CloudNodeRegistryCard.vue'
import CloudNodeRegistryInfo from './CloudNodeRegistryInfo.vue'

const { onClose = () => {} } = defineProps<{ onClose?: () => void }>()
provide(OnCloseKey, onClose)
const { t } = useI18n()
const { state, catalog, busy, load, setPin } = useCloudNodeRegistry()
const query = ref('')
const filter = ref<string | null>('all')
const version = ref<string | undefined>('all')
const sort = ref<string | undefined>('name')
const selectedRevisionId = ref<string>()
const selectedRevision = computed(() =>
  catalog.value?.revisions.find(
    (revision) => revision.revision_id === selectedRevisionId.value
  )
)
const packRevisions = computed(
  () =>
    catalog.value?.revisions.filter(
      (revision) => revision.name === selectedRevision.value?.name
    ) ?? []
)
const isRightPanelOpen = computed({
  get: () => Boolean(selectedRevision.value),
  set: (value: boolean) => {
    if (!value) selectedRevisionId.value = undefined
  }
})
const savingRevision = computed(() =>
  state.value.phase === 'saving' ? state.value.revisionId : undefined
)
const packs = computed(() =>
  cloudRegistryPacks(
    catalog.value?.revisions ?? [],
    filter.value,
    query.value,
    version.value,
    sort.value
  )
)
const navItems = computed(() =>
  (
    [
      'all',
      'pinned',
      'unpinned',
      'prepared',
      'verified'
    ] satisfies RegistryFilter[]
  ).map((id) => ({
    id,
    label: t(`customNodePacks.registry.filters.${id}`),
    icon:
      id === 'verified' ? 'icon-[lucide--badge-check]' : 'icon-[lucide--list]'
  }))
)
const versionOptions = computed(() => [
  { value: 'all', name: t('customNodePacks.registry.allVersions') },
  {
    value: '1',
    name: t('customNodePacks.registry.apiVersion', { version: 1 })
  },
  { value: '2', name: t('customNodePacks.registry.apiVersion', { version: 2 }) }
])
const sortOptions = computed(() => [
  { value: 'name', name: t('customNodePacks.registry.sortName') },
  { value: 'nodes', name: t('customNodePacks.registry.sortNodes') }
])
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
  gap: '1rem',
  padding: '0.5rem'
}
onMounted(() => void load())
</script>
