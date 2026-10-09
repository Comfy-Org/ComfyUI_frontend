<script setup lang="ts">
import { computed, onMounted, ref, provide } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import CommunityFacetSelect from '@/platform/community/components/CommunityFacetSelect.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import type { api } from '@/scripts/api'
import { OnCloseKey } from '@/types/widgetTypes'
import { useTestWorkflowLibrary } from '../composables/useTestWorkflowLibrary'
import type { TestWorkflowGraphVariant } from '../utils/cloudWorkflowAdaptation'
import TestWorkflowDetails from './TestWorkflowDetails.vue'
import TestWorkflowCard from './TestWorkflowCard.vue'

const emit = defineEmits<{ close: [] }>()
const { size = 'lg', fetchLibrary } = defineProps<{
  size?: 'lg' | 'full'
  fetchLibrary?: typeof api.fetchApi
}>()
provide(OnCloseKey, () => emit('close'))
const { t } = useI18n()
const library = useTestWorkflowLibrary(fetchLibrary)
const { data, state, busy, collection } = library
const query = ref('')
const tag = ref<string>()
const task = ref<string>()
const pack = ref<string>()
const model = ref<string>()
const complexity = ref<'small' | 'medium' | 'large'>()
const cluster = ref('')
const rightOpen = computed({
  get: () => Boolean(data.value.selected),
  set: (open) => {
    if (!open) library.closeDetails()
  }
})
const collections = computed(() =>
  data.value.collections.map((item) => ({
    value: item.id,
    name: `${item.id === 'harvey-qa' ? t('community.corpus') : item.id} (${item.count})`
  }))
)
const choices = (values: string[] = []) =>
  values
    .filter((value) => value.trim() !== '')
    .map((value) => ({ value, name: value }))
const tags = computed(() => choices(data.value.facets?.tags))
const tasks = computed(() => choices(data.value.facets?.tasks))
const packs = computed(() => choices(data.value.facets?.packs))
const models = computed(() => choices(data.value.facets?.models))
const complexities = computed(() =>
  ['small', 'medium', 'large'].map((value) => ({
    value,
    name: t(`testWorkflowLibrary.${value}`)
  }))
)

function search() {
  return library.search({
    q: query.value,
    tag: tag.value,
    task: task.value,
    pack: pack.value,
    model: model.value,
    complexity: complexity.value,
    cluster: cluster.value
  })
}
function resetFilters() {
  query.value = ''
  tag.value =
    task.value =
    pack.value =
    model.value =
    complexity.value =
      undefined
  cluster.value = ''
  void search()
}
function choose(id: string | undefined) {
  query.value = ''
  tag.value =
    task.value =
    pack.value =
    model.value =
    complexity.value =
      undefined
  cluster.value = ''
  if (id) void library.chooseCollection(id)
}
function selectComplexity(value: string | undefined) {
  complexity.value =
    value === 'small' || value === 'medium' || value === 'large'
      ? value
      : undefined
  void search()
}
function variants(value: string) {
  cluster.value = value
  void search()
}
function clearCluster() {
  cluster.value = ''
  void search()
}
async function open(variant: TestWorkflowGraphVariant) {
  if (await library.open(variant)) emit('close')
}
onMounted(library.initialize)
</script>

<template>
  <BaseModalLayout
    v-model:right-panel-open="rightOpen"
    data-testid="test-workflow-library"
    :size
    :content-title="t('community.workflows')"
    :right-panel-title="t('testWorkflowLibrary.details')"
  >
    <template #header>
      <SearchInput
        v-model="query"
        :placeholder="t('testWorkflowLibrary.search')"
        :aria-label="t('testWorkflowLibrary.search')"
        :disabled="busy"
        @search="search"
      />
      <Button variant="secondary" :disabled="busy" @click="search">{{
        t('g.search')
      }}</Button>
    </template>
    <template #contentFilter>
      <div class="flex flex-col gap-3 px-6 pb-4">
        <p class="m-0 text-sm text-muted-foreground">
          {{ t('testWorkflowLibrary.description') }}
        </p>
        <SingleSelect
          :model-value="collection || undefined"
          :options="collections"
          :label="t('testWorkflowLibrary.collection')"
          :disabled="busy"
          @update:model-value="choose"
        />
        <div class="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <CommunityFacetSelect
            v-model="tag"
            :options="tags"
            :label="t('testWorkflowLibrary.tags')"
            :disabled="busy"
            @update:model-value="search"
          />
          <CommunityFacetSelect
            v-model="task"
            :options="tasks"
            :label="t('testWorkflowLibrary.tasks')"
            :disabled="busy"
            @update:model-value="search"
          />
          <CommunityFacetSelect
            v-model="pack"
            :options="packs"
            :label="t('testWorkflowLibrary.packs')"
            :disabled="busy"
            @update:model-value="search"
          />
          <CommunityFacetSelect
            v-model="model"
            :options="models"
            :label="t('testWorkflowLibrary.models')"
            :disabled="busy"
            @update:model-value="search"
          />
          <SingleSelect
            :model-value="complexity"
            :options="complexities"
            :label="t('testWorkflowLibrary.complexity')"
            :disabled="busy"
            @update:model-value="selectComplexity"
          />
        </div>
        <p
          v-if="data.collectionsTruncated || data.facets?.truncated"
          class="m-0 text-xs text-muted-foreground"
        >
          {{ t('testWorkflowLibrary.facetsTruncated') }}
        </p>
        <Button
          variant="secondary"
          :disabled="busy || !collection"
          @click="resetFilters"
          >{{ t('testWorkflowLibrary.resetFilters') }}</Button
        >
        <Button
          v-if="cluster"
          variant="secondary"
          :disabled="busy"
          @click="clearCluster"
          >{{ t('testWorkflowLibrary.clearCluster') }}</Button
        >
        <p v-if="state.phase === 'failed'" role="alert" class="m-0 text-sm">
          {{
            t('testWorkflowLibrary.failed', {
              status: state.status || t('testWorkflowLibrary.invalidResponse')
            })
          }}
        </p>
        <p v-if="busy" role="status" class="m-0 text-sm">
          {{ t('g.loading') }}
        </p>
        <p
          v-else-if="state.phase === 'ready' && !data.collections.length"
          class="m-0 text-sm"
        >
          {{ t('testWorkflowLibrary.empty') }}
        </p>
        <p
          v-else-if="state.phase === 'ready' && !collection"
          class="m-0 text-sm"
        >
          {{ t('testWorkflowLibrary.chooseCollection') }}
        </p>
        <p v-if="data.page" class="m-0 text-xs text-muted-foreground">
          {{
            t('testWorkflowLibrary.counts', {
              total: data.page.total,
              unresolved: data.page.unresolved,
              verified: data.page.verified
            })
          }}
        </p>
      </div>
    </template>
    <template #content>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <TestWorkflowCard
          v-for="entry in data.page?.entries ?? []"
          :key="entry.workflow_sha256"
          :data-testid="`test-workflow-entry-${entry.workflow_sha256}`"
          :entry
          :busy
          :selected="
            data.selected?.summary.workflow_sha256 === entry.workflow_sha256
          "
          @select="library.select"
        />
      </div>
      <p v-if="data.page && !data.page.entries.length">
        {{ t('testWorkflowLibrary.noMatches') }}
      </p>
      <div v-if="data.page" class="mt-4 flex flex-wrap items-center gap-3">
        <p role="status" class="m-0 mr-auto text-xs text-muted-foreground">
          {{
            t(
              'testWorkflowLibrary.pageCount',
              {
                count: data.page.entries.length
              },
              data.page.entries.length
            )
          }}
        </p>
        <Button variant="secondary" :disabled="busy" @click="search">{{
          t('testWorkflowLibrary.firstPage')
        }}</Button>
        <Button
          variant="secondary"
          :disabled="busy || !data.page.next_cursor"
          @click="library.search(undefined, data.page.next_cursor)"
          >{{ t('testWorkflowLibrary.nextPage') }}</Button
        >
      </div>
    </template>
    <template #rightPanel>
      <TestWorkflowDetails
        v-if="data.selected"
        :record="data.selected"
        :busy
        @open="open"
        @variants="variants"
      />
    </template>
  </BaseModalLayout>
</template>
