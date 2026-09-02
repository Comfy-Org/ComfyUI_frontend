<script setup lang="ts">
import {
  ArrowUpDown,
  ChevronRight,
  ExternalLink,
  ListFilter,
  Search
} from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { externalLinks } from '../../config/routes'
import type { WorkshopModel } from '../../config/workshop'
import { splitTask } from '../../config/workshop'
import type { HubWorkflowKind } from '../../data/hubWorkflows'
import { hubWorkflows } from '../../data/hubWorkflows'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const KINDS = ['all', 'graph', 'app'] as const
type KindFilter = (typeof KINDS)[number]

const kindLabelKey: Record<KindFilter, TranslationKey> = {
  all: 'workshop.hub.kind.all',
  graph: 'workshop.hub.kind.graph',
  app: 'workshop.hub.kind.app'
}
const ioLabelKey: Record<string, TranslationKey> = {
  text: 'workshop.hub.io.text',
  image: 'workshop.hub.io.image',
  video: 'workshop.hub.io.video',
  audio: 'workshop.hub.io.audio',
  '3d': 'workshop.hub.io.3d',
  other: 'workshop.hub.io.other'
}

// A partner model is a node graph with a single partner node, so it lives
// under Node Graphs and only differs by its tag and call to action.
interface HubItem {
  readonly kind: HubWorkflowKind
  readonly partner: boolean
  readonly id: string
  readonly title: string
  readonly author: string
  readonly href: string
  readonly external: boolean
  readonly thumbnailUrl?: string
  readonly tags: readonly string[]
}

function ioLabel(value: string) {
  return t(ioLabelKey[value] ?? 'workshop.hub.io.other', locale)
}

function taskLabel(model: WorkshopModel) {
  const task = model.task ? splitTask(model.task) : undefined
  if (!task) return undefined
  return t('workshop.hub.task', locale)
    .replace('{input}', ioLabel(task.input))
    .replace('{output}', ioLabel(task.output))
}

function modelItem(model: WorkshopModel): HubItem {
  const task = taskLabel(model)
  return {
    kind: 'graph',
    partner: true,
    id: model.slug,
    title: task ? `${model.name}: ${task}` : model.name,
    author: t('workshop.hub.author', locale),
    href: model.href,
    external: false,
    thumbnailUrl: model.thumbnailUrl,
    tags: [
      t('workshop.hub.tag.partnerNodes', locale),
      ...(task ? [task] : []),
      ...(model.modality ? [ioLabel(model.modality)] : [])
    ]
  }
}

const workflowItems: readonly HubItem[] = hubWorkflows.map((workflow) => ({
  kind: workflow.kind,
  partner: false,
  id: workflow.title,
  title: workflow.title,
  author: workflow.author,
  href: workflow.href,
  external: true,
  thumbnailUrl: workflow.thumbnailUrl,
  tags: [
    t(
      workflow.kind === 'graph'
        ? 'workshop.hub.tag.graph'
        : 'workshop.hub.tag.app',
      locale
    ),
    ...workflow.tags
  ]
}))

const query = ref('')
const kind = ref<KindFilter>('all')

function isKind(value: string | null): value is KindFilter {
  return KINDS.some((option) => option === value)
}

onMounted(() => {
  const requested = new URLSearchParams(location.search).get('kind')
  if (isKind(requested)) kind.value = requested
})

const items = computed(() => {
  const modelItems = models.map(modelItem)
  // Interleave so partner models read as part of the same catalog.
  const mixed = modelItems.flatMap((item, index) => [
    item,
    ...(workflowItems[index] ? [workflowItems[index]] : [])
  ])
  const needle = query.value.trim().toLowerCase()
  return mixed.filter(
    (item) =>
      (kind.value === 'all' || item.kind === kind.value) &&
      (needle === '' ||
        item.title.toLowerCase().includes(needle) ||
        item.tags.some((tag) => tag.toLowerCase().includes(needle)))
  )
})

const chipClass = (current: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
    current
      ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
      : 'text-primary-comfy-canvas hover:text-primary-warm-white'
  )
const toolClass =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparency-white-t20 bg-transparency-white-t4 px-3 text-xs font-medium text-primary-comfy-canvas'
</script>

<template>
  <section class="flex flex-col gap-6" data-testid="workshop-hub">
    <div class="flex items-center justify-between gap-4">
      <label class="relative block grow">
        <span class="sr-only">{{ t('workshop.hub.search', locale) }}</span>
        <Search
          class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-warm-gray"
          aria-hidden="true"
        />
        <input
          v-model="query"
          type="search"
          data-testid="hub-search"
          :placeholder="t('workshop.hub.search', locale)"
          class="bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 h-11 w-full rounded-xl border border-transparency-white-t8 pr-4 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3"
        />
      </label>
      <a
        :href="externalLinks.workflows"
        target="_blank"
        rel="noopener"
        data-testid="hub-open-live"
        class="inline-flex shrink-0 items-center gap-1.5 text-xs text-primary-warm-gray transition-colors hover:text-primary-warm-white"
      >
        {{ t('workshop.hub.openHub', locale) }}
        <ExternalLink class="size-3.5" aria-hidden="true" />
      </a>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div
        role="tablist"
        :aria-label="t('workshop.hub.kind.label', locale)"
        data-testid="hub-kinds"
        class="bg-transparency-white-t4 flex gap-1 rounded-xl p-1"
      >
        <button
          v-for="value in KINDS"
          :key="value"
          type="button"
          role="tab"
          :aria-selected="kind === value"
          :data-testid="`hub-kind-${value}`"
          :class="chipClass(kind === value)"
          @click="kind = value"
        >
          {{ t(kindLabelKey[value], locale) }}
        </button>
      </div>
      <div class="flex gap-2">
        <span :class="toolClass">
          <ListFilter class="size-3.5" aria-hidden="true" />
          {{ t('workshop.filter.label', locale) }}
        </span>
        <span :class="toolClass">
          <ArrowUpDown class="size-3.5" aria-hidden="true" />
          {{ t('workshop.sort.popular', locale) }}
        </span>
      </div>
    </div>

    <ul class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="item in items" :key="`${item.kind}-${item.id}`">
        <a
          :href="item.href"
          :target="item.external ? '_blank' : undefined"
          :rel="item.external ? 'noopener' : undefined"
          :data-testid="`hub-card-${item.partner ? 'model' : item.kind}`"
          class="group bg-primary-comfy-ink-light block overflow-hidden rounded-2xl border border-transparency-white-t8 transition-colors hover:border-transparency-white-t20"
        >
          <div
            class="relative aspect-16/10 overflow-hidden bg-primary-comfy-ink"
          >
            <img
              v-if="item.thumbnailUrl"
              :src="item.thumbnailUrl"
              :alt="item.title"
              loading="lazy"
              decoding="async"
              class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div
              class="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent"
            />
            <p
              class="absolute inset-x-4 bottom-3 text-sm font-semibold text-white"
            >
              {{ item.title }}
            </p>
          </div>
          <div class="flex items-center justify-between gap-3 px-4 pt-3">
            <span
              class="flex items-center gap-1.5 text-xs text-primary-comfy-canvas/80"
            >
              <span
                :class="
                  cn(
                    'size-3.5 rounded-full',
                    item.partner
                      ? 'bg-primary-comfy-yellow'
                      : 'bg-primary-comfy-plum'
                  )
                "
                aria-hidden="true"
              />
              {{ item.author }}
            </span>
            <span
              v-if="item.partner"
              class="bg-primary-comfy-yellow inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold tracking-wider text-primary-comfy-ink uppercase"
            >
              <ChevronRight class="size-3" aria-hidden="true" />
              {{ t('workshop.hub.tryNow', locale) }}
            </span>
            <span
              v-else
              class="grid size-7 place-items-center rounded-full bg-transparency-white-t8 text-primary-comfy-canvas"
            >
              <ChevronRight class="size-3.5" aria-hidden="true" />
            </span>
          </div>
          <ul class="flex flex-wrap gap-1.5 px-4 pt-3 pb-4">
            <li
              v-for="tag in item.tags"
              :key="tag"
              class="rounded-md bg-transparency-white-t8 px-2 py-0.5 text-[10px] text-primary-comfy-canvas/80"
            >
              {{ tag }}
            </li>
          </ul>
        </a>
      </li>
    </ul>
  </section>
</template>
