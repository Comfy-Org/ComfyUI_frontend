<template>
  <div
    class="grid min-h-screen gap-6 overflow-y-auto p-6 lg:grid-cols-[1.1fr_0.9fr]"
  >
    <div
      class="flex max-h-[calc(100vh-3rem)] flex-col gap-6 overflow-y-auto pr-3"
    >
      <section
        class="rounded-2xl border border-border-default bg-secondary-background p-6 shadow-sm"
      >
        <div
          class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
        >
          <div class="space-y-2">
            <p
              class="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {{ t('templateSearchLab.title') }}
            </p>
            <h1 class="text-2xl font-semibold text-base-foreground">
              {{ t('templateSearchLab.subtitle') }}
            </h1>
            <p class="text-sm text-muted-foreground">
              {{ t('templateSearchLab.description') }}
            </p>
            <div class="flex flex-wrap gap-2">
              <Button
                size="small"
                :label="t('templateSearchLab.reset')"
                icon="icon-[lucide--refresh-cw]"
                severity="secondary"
                @click="resetLab"
              />
              <Button
                size="small"
                :label="
                  copyStatus === 'copied'
                    ? t('templateSearchLab.configCopied')
                    : t('templateSearchLab.configCopy')
                "
                :icon="
                  copyStatus === 'copied'
                    ? 'icon-[lucide--check]'
                    : 'icon-[lucide--clipboard-copy]'
                "
                :severity="copyStatus === 'error' ? 'danger' : 'secondary'"
                @click="copyOptions"
              />
            </div>
          </div>
          <div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <a
              v-for="link in resourceLinks"
              :key="link.href"
              class="inline-flex items-center gap-2 text-sm font-medium text-text-primary underline-offset-4 hover:underline"
              :href="link.href"
              target="_blank"
              rel="noreferrer"
            >
              <i :class="link.icon" />
              <span>{{ link.label }}</span>
            </a>
          </div>
        </div>
        <div class="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-base-foreground">
                {{ t('templateSearchLab.searchLabel') }}
              </label>
              <SearchBox
                v-model="searchQuery"
                :placeholder="t('templateSearchLab.searchPlaceholder')"
                show-border
              />
              <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span class="font-medium">{{
                  t('templateSearchLab.samplesLabel')
                }}</span>
                <button
                  v-for="sample in sampleQueries"
                  :key="sample"
                  type="button"
                  class="rounded-full border border-border-muted px-3 py-1 text-xs font-medium text-base-foreground transition hover:bg-base-background"
                  @click="searchQuery = sample"
                >
                  {{ sample }}
                </button>
              </div>
            </div>
            <div
              class="rounded-xl border border-border-default bg-secondary-background shadow-inner"
            >
              <div
                class="flex items-center justify-between border-b border-border-muted px-4 py-3"
              >
                <div>
                  <p class="text-sm font-semibold text-base-foreground">
                    {{ t('templateSearchLab.previewTitle') }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ previewSummary }}
                  </p>
                </div>
                <Tag v-if="searchQuery.trim().length" severity="secondary">
                  {{
                    t('templateSearchLab.previewCount', {
                      count: previewResults.length
                    })
                  }}
                </Tag>
              </div>
              <div class="max-h-[420px] space-y-3 overflow-y-auto px-4 py-3">
                <template v-if="!isLoaded">
                  <p class="text-sm text-muted-foreground">
                    {{ t('templateSearchLab.loadingTemplates') }}
                  </p>
                </template>
                <template v-else-if="!searchQuery.trim().length">
                  <p class="text-sm text-muted-foreground">
                    {{ t('templateSearchLab.previewEmptyState') }}
                  </p>
                </template>
                <template v-else-if="previewResults.length === 0">
                  <p class="text-sm text-danger-100">
                    {{
                      t('templateSearchLab.previewNoResults', {
                        query: searchQuery
                      })
                    }}
                  </p>
                </template>
                <template v-else>
                  <article
                    v-for="(result, index) in previewResults"
                    :key="`${result.item.name}-${index}`"
                    class="rounded-lg border border-border-muted bg-secondary-background px-4 py-3"
                  >
                    <div
                      class="flex flex-wrap items-start justify-between gap-2"
                    >
                      <div>
                        <p class="text-base font-semibold text-base-foreground">
                          {{ formatTemplateTitle(result.item) }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          {{ formatTemplateMeta(result.item) }}
                        </p>
                      </div>
                      <Tag
                        v-if="typeof result.score === 'number'"
                        severity="info"
                      >
                        {{ t('templateSearchLab.scoreLabel') }}:
                        {{ formatScore(result.score) }}
                      </Tag>
                    </div>
                    <div v-if="result.matches?.length" class="mt-3 space-y-2">
                      <div
                        v-for="match in result.matches"
                        :key="`${match.key}-${match.refIndex}`"
                        class="rounded-md border border-border-muted px-3 py-2"
                      >
                        <p
                          class="text-xs font-semibold uppercase text-muted-foreground"
                        >
                          {{
                            t('templateSearchLab.matchLabel', {
                              field:
                                match.key || t('templateSearchLab.unknownField')
                            })
                          }}
                        </p>
                        <p
                          v-if="typeof match.value === 'string'"
                          class="text-sm text-base-foreground"
                        >
                          <span
                            v-for="(chunk, chunkIndex) in buildHighlightChunks(
                              match.value,
                              match.indices || []
                            )"
                            :key="chunkIndex"
                            :class="
                              chunk.isHit
                                ? 'rounded bg-base-background px-1 font-semibold text-base-foreground'
                                : ''
                            "
                          >
                            {{ chunk.text }}
                          </span>
                        </p>
                        <p v-else class="text-xs text-muted-foreground">
                          {{ formatNonStringMatch(match.value) }}
                        </p>
                      </div>
                    </div>
                    <p
                      v-else-if="designerOptions.includeMatches"
                      class="mt-3 text-xs text-muted-foreground"
                    >
                      {{ t('templateSearchLab.matchFallback') }}
                    </p>
                  </article>
                </template>
              </div>
            </div>
          </div>
          <div class="space-y-4">
            <div
              class="rounded-xl border border-border-default bg-secondary-background p-4"
            >
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold text-base-foreground">
                  {{ t('templateSearchLab.configHeading') }}
                </p>
                <i class="icon-[lucide--sparkles] text-muted-foreground" />
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ t('templateSearchLab.configSubheading') }}
              </p>
              <pre
                class="mt-3 max-h-64 overflow-auto rounded-lg bg-base-background p-3 text-xs leading-relaxed text-base-foreground"
                >{{ shareableConfig }}</pre
              >
            </div>
            <div
              class="rounded-xl border border-border-default bg-secondary-background p-4"
            >
              <p class="text-sm font-semibold text-base-foreground">
                {{ t('templateSearchLab.additionalReadingTitle') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('templateSearchLab.additionalReadingSubtitle') }}
              </p>
              <ul class="mt-3 space-y-2 text-sm">
                <li
                  v-for="link in deepDiveLinks"
                  :key="link.href"
                  class="flex items-center gap-2 text-text-primary"
                >
                  <i :class="link.icon" class="text-base" />
                  <a
                    class="hover:underline"
                    :href="link.href"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ link.label }}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-6">
        <div
          v-for="group in optionGroups"
          :key="group.key"
          class="rounded-2xl border border-border-default bg-secondary-background p-6"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-lg font-semibold text-base-foreground">
                {{ group.title }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ group.description }}
              </p>
            </div>
            <Tag severity="secondary"
              >{{ group.options.length }}
              {{ t('templateSearchLab.optionCountSuffix') }}</Tag
            >
          </div>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div
              v-for="option in group.options"
              :key="option.key"
              class="rounded-xl border border-border-muted bg-secondary-background p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-semibold text-base-foreground">
                    {{ option.label }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ option.description }}
                  </p>
                  <p class="mt-1 text-xs font-medium text-text-primary">
                    {{ option.example }}
                  </p>
                </div>
                <a
                  class="text-xs font-semibold text-text-primary underline-offset-4 hover:underline"
                  :href="docLink(option.anchor)"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ t('templateSearchLab.docLinkLabel') }}
                </a>
              </div>
              <div class="mt-4 space-y-3">
                <ToggleSwitch
                  v-if="option.type === 'boolean'"
                  v-model="
                    designerOptions[option.key as keyof DesignerToggleOptions]
                  "
                  :input-id="`toggle-${option.key}`"
                />
                <div v-else-if="option.type === 'number'" class="space-y-2">
                  <Slider
                    v-model.number="
                      designerOptions[
                        option.key as keyof DesignerNumericOptions
                      ]
                    "
                    :min="option.min"
                    :max="option.max"
                    :step="option.step"
                  />
                  <InputNumber
                    v-model.number="
                      designerOptions[
                        option.key as keyof DesignerNumericOptions
                      ]
                    "
                    :min="option.min"
                    :max="option.max"
                    :step="option.step"
                    class="w-full"
                  />
                </div>
                <div v-else-if="option.type === 'sort'" class="space-y-2">
                  <Select
                    v-model="sortMode"
                    :options="sortOptions"
                    option-label="label"
                    option-value="value"
                    class="w-full"
                  />
                  <p class="text-xs text-muted-foreground">
                    {{ t('templateSearchLab.sortDescription') }}
                  </p>
                </div>
                <div v-else-if="option.type === 'get'" class="space-y-2">
                  <Select
                    v-model="getFnMode"
                    :options="getFnOptions"
                    option-label="label"
                    option-value="value"
                    class="w-full"
                  />
                  <p class="text-xs text-muted-foreground">
                    {{ t('templateSearchLab.getFnDescription') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          class="rounded-2xl border border-border-default bg-secondary-background p-6"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-lg font-semibold text-base-foreground">
                {{ t('templateSearchLab.keysHeading') }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ t('templateSearchLab.keysDescription') }}
              </p>
            </div>
            <a
              class="text-xs font-semibold text-text-primary underline-offset-4 hover:underline"
              :href="docLink('keys')"
              target="_blank"
              rel="noreferrer"
            >
              {{ t('templateSearchLab.docLinkLabel') }}
            </a>
          </div>
          <p class="mt-2 text-xs text-muted-foreground">
            {{ t('templateSearchLab.keysHelper') }}
          </p>
          <div class="mt-4 flex flex-wrap items-end gap-3">
            <div class="grow">
              <label class="text-xs font-semibold text-muted-foreground">
                {{ t('templateSearchLab.keysAddLabel') }}
              </label>
              <Select
                v-model="keyToAdd"
                :options="keyLibrary"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>
            <div>
              <label class="text-xs font-semibold text-muted-foreground">
                {{ t('templateSearchLab.keysWeightLabel') }}
              </label>
              <InputNumber
                v-model.number="newKeyWeight"
                :min="0.05"
                :max="1"
                :step="0.05"
              />
            </div>
            <Button
              :label="t('templateSearchLab.keysAddButton')"
              icon="icon-[lucide--plus-circle]"
              :disabled="!keyToAdd"
              @click="addKey"
            />
          </div>
          <div class="mt-6 grid gap-4 md:grid-cols-2">
            <div
              v-for="key in fuseKeyEntries"
              :key="key.id"
              class="rounded-xl border border-border-muted bg-secondary-background p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-base-foreground">
                    {{ key.path }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ describeKey(key.path) }}
                  </p>
                </div>
                <button
                  type="button"
                  class="text-xs font-semibold text-danger-100 disabled:text-muted-foreground"
                  :disabled="fuseKeyEntries.length === 1"
                  @click="removeKey(key.id)"
                >
                  {{ t('templateSearchLab.removeLabel') }}
                </button>
              </div>
              <div class="mt-3 space-y-2">
                <InputText v-model="key.path" class="w-full" />
                <div class="flex items-center gap-3">
                  <Slider
                    v-model.number="key.weight"
                    :min="0.05"
                    :max="1"
                    :step="0.05"
                  />
                  <InputNumber
                    v-model.number="key.weight"
                    :min="0.05"
                    :max="1"
                    :step="0.05"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <aside
      class="flex flex-col gap-4 rounded-2xl border border-border-default bg-secondary-background p-4"
    >
      <div>
        <p class="text-sm font-semibold text-base-foreground">
          {{ t('templateSearchLab.dialogPreviewTitle') }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ t('templateSearchLab.dialogPreviewSubtitle') }}
        </p>
      </div>
      <div
        class="min-h-[70vh] flex-1 overflow-hidden rounded-xl border border-border-default bg-base-background"
      >
        <WorkflowTemplateSelectorDialog :on-close="noop" />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import Fuse from 'fuse.js'
import type { RangeTuple } from 'fuse.js'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Slider from 'primevue/slider'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, provide, reactive, ref } from 'vue'

import WorkflowTemplateSelectorDialog from '@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'
import SearchBox from '@/components/input/SearchBox.vue'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import {
  DEFAULT_TEMPLATE_FUSE_CONFIG,
  TEMPLATE_FUSE_SETTINGS_KEY,
  buildTemplateFuseOptions
} from '@/platform/workflow/templates/utils/templateFuseOptions'
import type {
  TemplateFuseConfig,
  TemplateFuseGetMode,
  TemplateFuseKeyConfig,
  TemplateFuseOptionState,
  TemplateFuseSortMode
} from '@/platform/workflow/templates/utils/templateFuseOptions'
import { TEMPLATE_SEARCH_QUERY_OVERRIDE_KEY } from '@/platform/workflow/templates/utils/templateSearchLabInjection'

interface TemplateSearchRecord extends TemplateInfo {
  localizedTitle?: string
  localizedDescription?: string
  tags?: string[]
  models?: string[]
  sourceModule?: string
  searchableText?: string
}

interface HighlightChunk {
  text: string
  isHit: boolean
}

interface FuseKeyEntry {
  id: string
  path: string
  weight: number
}

interface OptionDefinition {
  key: keyof DesignerOptions | 'sort' | 'get'
  label: string
  description: string
  example: string
  anchor: string
  type: 'boolean' | 'number' | 'sort' | 'get'
  min?: number
  max?: number
  step?: number
}

interface OptionGroup {
  key: string
  title: string
  description: string
  options: OptionDefinition[]
}

type TemplateFuseToggleKey =
  | 'isCaseSensitive'
  | 'ignoreDiacritics'
  | 'includeScore'
  | 'includeMatches'
  | 'shouldSort'
  | 'findAllMatches'
  | 'ignoreLocation'
  | 'useExtendedSearch'
  | 'ignoreFieldNorm'

type TemplateFuseNumberKey =
  | 'minMatchCharLength'
  | 'location'
  | 'threshold'
  | 'distance'
  | 'fieldNormWeight'

type DesignerOptions = TemplateFuseOptionState
type DesignerToggleOptions = Pick<
  TemplateFuseOptionState,
  TemplateFuseToggleKey
>
type DesignerNumericOptions = Pick<
  TemplateFuseOptionState,
  TemplateFuseNumberKey
>

type SortMode = TemplateFuseSortMode
type GetFnMode = TemplateFuseGetMode

const DOCS_BASE_URL = 'https://www.fusejs.io/api/options.html'

let keyIdCounter = 0
const createKeyId = () => `fuse-key-${++keyIdCounter}`

const settingStore = useSettingStore()
const initialConfig =
  settingStore.get(TEMPLATE_FUSE_SETTINGS_KEY) ?? DEFAULT_TEMPLATE_FUSE_CONFIG

const designerOptions = reactive<DesignerOptions>({
  ...initialConfig.options
})
const fuseKeyEntries = ref<FuseKeyEntry[]>(buildKeyEntries(initialConfig.keys))
const sortMode = ref<SortMode>(initialConfig.sortMode)
const getFnMode = ref<GetFnMode>(initialConfig.getFnMode)
const searchQuery = ref('wan')
const sampleQueries = ['wan', 'refiner', 'animate', 'face', 'stylized']
const keyToAdd = ref('models')
const newKeyWeight = ref(0.15)
const copyStatus = ref<'idle' | 'copied' | 'error'>('idle')
const noop = () => {}

const workflowTemplatesStore = useWorkflowTemplatesStore()
const { enhancedTemplates, isLoaded } = storeToRefs(workflowTemplatesStore)

onMounted(async () => {
  if (!isLoaded.value) {
    await workflowTemplatesStore.loadWorkflowTemplates()
  }
})

const templateRecords = computed<TemplateSearchRecord[]>(
  () => enhancedTemplates.value as TemplateSearchRecord[]
)

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

provide(TEMPLATE_SEARCH_QUERY_OVERRIDE_KEY, searchQuery)

const currentConfig = computed<TemplateFuseConfig>(() => ({
  options: { ...designerOptions },
  keys: fuseKeyEntries.value
    .filter((entry) => entry.path.trim().length)
    .map((entry) => ({ path: entry.path.trim(), weight: entry.weight })),
  sortMode: sortMode.value,
  getFnMode: getFnMode.value
}))

watchDebounced(
  () => currentConfig.value,
  (config) => {
    void settingStore.set(TEMPLATE_FUSE_SETTINGS_KEY, config)
  },
  { debounce: 250, deep: true }
)

const fuseOptions = computed(() =>
  buildTemplateFuseOptions<TemplateSearchRecord>({
    config: currentConfig.value,
    query: normalizedQuery.value
  })
)

const previewResults = computed(() => {
  const templates = templateRecords.value
  if (!templates.length || !normalizedQuery.value.length) {
    return []
  }
  const fuse = new Fuse(templates, fuseOptions.value)
  return fuse.search(normalizedQuery.value, { limit: 30 })
})

const previewSummary = computed(() => {
  if (!searchQuery.value.trim().length) {
    return t('templateSearchLab.previewSummaryIdle')
  }
  if (!isLoaded.value) {
    return t('templateSearchLab.loadingTemplates')
  }
  if (previewResults.value.length === 0) {
    return t('templateSearchLab.previewSummaryEmpty')
  }
  return t('templateSearchLab.previewSummaryActive', {
    count: previewResults.value.length,
    total: templateRecords.value.length
  })
})

const shareableConfig = computed(() =>
  JSON.stringify(currentConfig.value, null, 2)
)

const resourceLinks = computed(() => [
  {
    href: docLink(''),
    label: t('templateSearchLab.links.apiDocs'),
    icon: 'icon-[lucide--book-open]'
  },
  {
    href: 'https://www.fusejs.io/concepts/scoring-theory.html',
    label: t('templateSearchLab.links.scoringTheory'),
    icon: 'icon-[lucide--line-chart]'
  },
  {
    href: 'https://www.fusejs.io/examples.html#extended-search',
    label: t('templateSearchLab.links.extendedSearch'),
    icon: 'icon-[lucide--filter]'
  }
])

const deepDiveLinks = computed(() => resourceLinks.value.slice(1))

const sortOptions = computed(() => [
  { value: 'score', label: t('templateSearchLab.sortModes.score') },
  { value: 'exact', label: t('templateSearchLab.sortModes.exact') },
  { value: 'prefix', label: t('templateSearchLab.sortModes.prefix') }
])

const getFnOptions = computed(() => [
  { value: 'default', label: t('templateSearchLab.getFnModes.default') },
  { value: 'flatten', label: t('templateSearchLab.getFnModes.flatten') }
])

const keyLibrary = computed(() => [
  { value: 'name', label: t('templateSearchLab.keysOptions.name') },
  { value: 'title', label: t('templateSearchLab.keysOptions.title') },
  {
    value: 'description',
    label: t('templateSearchLab.keysOptions.description')
  },
  { value: 'tags', label: t('templateSearchLab.keysOptions.tags') },
  { value: 'models', label: t('templateSearchLab.keysOptions.models') },
  { value: 'useCase', label: t('templateSearchLab.keysOptions.useCase') },
  {
    value: 'sourceModule',
    label: t('templateSearchLab.keysOptions.sourceModule')
  }
])

const optionGroups = computed<OptionGroup[]>(() => [
  {
    key: 'basic',
    title: t('templateSearchLab.optionGroups.basic.title'),
    description: t('templateSearchLab.optionGroups.basic.description'),
    options: [
      createToggleOption('isCaseSensitive', 'iscasesensitive'),
      createToggleOption('ignoreDiacritics', 'ignorediacritics'),
      createToggleOption('includeScore', 'includescore'),
      createToggleOption('includeMatches', 'includematches'),
      createNumericOption('minMatchCharLength', 'minmatchcharlength', 1, 10, 1),
      createToggleOption('shouldSort', 'shouldsort'),
      createToggleOption('findAllMatches', 'findallmatches')
    ]
  },
  {
    key: 'fuzzy',
    title: t('templateSearchLab.optionGroups.fuzzy.title'),
    description: t('templateSearchLab.optionGroups.fuzzy.description'),
    options: [
      createNumericOption('location', 'location', 0, 500, 5),
      createNumericOption('threshold', 'threshold', 0, 1, 0.01),
      createNumericOption('distance', 'distance', 0, 1000, 10),
      createToggleOption('ignoreLocation', 'ignorelocation')
    ]
  },
  {
    key: 'advanced',
    title: t('templateSearchLab.optionGroups.advanced.title'),
    description: t('templateSearchLab.optionGroups.advanced.description'),
    options: [
      createToggleOption('useExtendedSearch', 'useextendedsearch'),
      {
        key: 'sort',
        label: t('templateSearchLab.sortLabel'),
        description: t('templateSearchLab.sortDescription'),
        example: t('templateSearchLab.sortExample'),
        anchor: 'sortFn',
        type: 'sort'
      },
      {
        key: 'get',
        label: t('templateSearchLab.getFnLabel'),
        description: t('templateSearchLab.getFnDescription'),
        example: t('templateSearchLab.getFnExample'),
        anchor: 'getFn',
        type: 'get'
      },
      createToggleOption('ignoreFieldNorm', 'ignorefieldnorm'),
      createNumericOption('fieldNormWeight', 'fieldnormweight', 0, 2, 0.1)
    ]
  }
])

function createToggleOption(
  key: keyof DesignerToggleOptions,
  anchor: string
): OptionDefinition {
  return {
    key,
    anchor,
    label: key,
    description: t(`templateSearchLab.options.${String(key)}.description`),
    example: t(`templateSearchLab.options.${String(key)}.example`),
    type: 'boolean'
  }
}

function createNumericOption(
  key: keyof DesignerNumericOptions,
  anchor: string,
  min: number,
  max: number,
  step: number
): OptionDefinition {
  return {
    key,
    anchor,
    label: key,
    description: t(`templateSearchLab.options.${String(key)}.description`),
    example: t(`templateSearchLab.options.${String(key)}.example`),
    type: 'number',
    min,
    max,
    step
  }
}

function buildHighlightChunks(
  text: string,
  indices: readonly RangeTuple[]
): HighlightChunk[] {
  if (!indices.length) {
    return [{ text, isHit: false }]
  }
  const chunks: HighlightChunk[] = []
  let lastIndex = 0
  indices.forEach(([start, end]) => {
    if (start > lastIndex) {
      chunks.push({ text: text.slice(lastIndex, start), isHit: false })
    }
    chunks.push({ text: text.slice(start, end + 1), isHit: true })
    lastIndex = end + 1
  })
  if (lastIndex < text.length) {
    chunks.push({ text: text.slice(lastIndex), isHit: false })
  }
  return chunks
}

function formatScore(score: number) {
  return score.toFixed(3)
}

function formatTemplateTitle(template: TemplateSearchRecord) {
  return template.title || template.localizedTitle || template.name
}

function formatTemplateMeta(template: TemplateSearchRecord) {
  const runsOn = template.openSource === false ? 'External API' : 'ComfyUI'
  const models = template.models?.slice(0, 2).join(', ')
  return [runsOn, models].filter(Boolean).join(' • ')
}

function formatNonStringMatch(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return String(value)
}

function docLink(anchor: string) {
  return anchor ? `${DOCS_BASE_URL}#${anchor}` : DOCS_BASE_URL
}

function describeKey(path: string) {
  switch (path) {
    case 'name':
      return t('templateSearchLab.keys.nameDescription')
    case 'title':
      return t('templateSearchLab.keys.titleDescription')
    case 'description':
      return t('templateSearchLab.keys.descriptionDescription')
    case 'tags':
      return t('templateSearchLab.keys.tagsDescription')
    case 'models':
      return t('templateSearchLab.keys.modelsDescription')
    default:
      return t('templateSearchLab.keys.customDescription', { field: path })
  }
}

function buildKeyEntries(keys: TemplateFuseKeyConfig[]): FuseKeyEntry[] {
  if (!keys.length) {
    return DEFAULT_TEMPLATE_FUSE_CONFIG.keys.map((key) => createKeyEntry(key))
  }
  return keys.map((key) => createKeyEntry(key))
}

function createKeyEntry(config: TemplateFuseKeyConfig): FuseKeyEntry {
  return {
    id: createKeyId(),
    path: config.path,
    weight: config.weight
  }
}

function addKey() {
  if (!keyToAdd.value) {
    return
  }
  fuseKeyEntries.value.push(
    createKeyEntry({ path: keyToAdd.value, weight: newKeyWeight.value })
  )
}

function removeKey(id: string) {
  if (fuseKeyEntries.value.length === 1) {
    return
  }
  fuseKeyEntries.value = fuseKeyEntries.value.filter((entry) => entry.id !== id)
}

async function copyOptions() {
  try {
    await navigator.clipboard.writeText(shareableConfig.value)
    copyStatus.value = 'copied'
    window.setTimeout(() => {
      copyStatus.value = 'idle'
    }, 2000)
  } catch (error) {
    console.error(error)
    copyStatus.value = 'error'
  }
}

function resetLab() {
  applyConfig(DEFAULT_TEMPLATE_FUSE_CONFIG)
  searchQuery.value = 'wan'
}

function applyConfig(config: TemplateFuseConfig) {
  Object.assign(designerOptions, config.options)
  fuseKeyEntries.value = buildKeyEntries(config.keys)
  sortMode.value = config.sortMode
  getFnMode.value = config.getFnMode
}
</script>
