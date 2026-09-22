<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, Workflow } from '@lucide/vue'
import Button from '@/components/ui/button/Button.vue'
import {
  launchWorkflows,
  workflowCategories,
  workflowMetadata,
  workflowPath
} from '../../config/workflow-catalogue'
import Badge from '../ui/badge/Badge.vue'
import CardRow from './CardRow.vue'
import WorkshopBrowseTabs from './WorkshopBrowseTabs.vue'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'

const search = ref('')
const categories = ref<(typeof workflowCategories)[number][]>([])
const matchingWorkflows = computed(() =>
  launchWorkflows.filter((workflow) =>
    `${workflow.title} ${workflow.description} ${workflowMetadata(workflow).models.join(' ')} ${workflow.execution === 'deployment-demo' ? 'Comfy API custom nodes' : ''}`
      .toLowerCase()
      .includes(search.value.trim().toLowerCase())
  )
)
const categoryOptions = computed(() =>
  workflowCategories.map((value) => ({
    value,
    label: value,
    count: matchingWorkflows.value.filter(
      (workflow) => workflow.category === value
    ).length
  }))
)
const shelves = computed(() =>
  workflowCategories
    .map((name) => ({
      name,
      items: matchingWorkflows.value.filter(
        (workflow) =>
          workflow.category === name &&
          (!categories.value.length || categories.value.includes(name))
      )
    }))
    .filter((shelf) => shelf.items.length)
)
const resultCount = computed(() =>
  shelves.value.reduce((total, shelf) => total + shelf.items.length, 0)
)
const highlights = workflowCategories.map((category) =>
  launchWorkflows.find(
    (workflow) => workflow.category === category && !workflow.execution
  )!
)
const selectedHighlight = ref(0)
const featured = computed(() => highlights[selectedHighlight.value])
const cardClass =
  'w-60 shrink-0 snap-start sm:w-[calc((100cqw-2*1.25rem)/2.5)] md:w-[calc((100cqw-3*1.25rem)/3.5)] lg:w-[calc((100cqw-4*1.25rem)/4.5)] xl:w-[calc((100cqw-5*1.25rem)/5.5)]'
</script>

<template>
  <div
    class="mx-auto max-w-10xl px-6 pt-8 pb-16 max-sm:pt-5 max-sm:pb-10 lg:px-8 lg:pt-12 lg:pb-24"
  >
    <WorkshopBrowseTabs active="workflows" />
    <WorkshopHero
      eyebrow-key="workshop.workflows.eyebrow"
      heading-key="workshop.workflows.heading"
      subtitle-key="workshop.workflows.subtitle"
    />
    <section
      aria-label="Featured workflows"
      class="relative isolate mb-10 overflow-hidden rounded-4.5xl border border-transparency-white-t8 short:mb-6"
      data-testid="workflow-featured"
    >
      <div class="group relative block h-84 short:h-57 sm:short:h-60">
        <a
          :href="workflowPath(featured.slug)"
          tabindex="-1"
          aria-hidden="true"
          class="absolute inset-0"
        ></a>
        <img
          :src="workflowMetadata(featured).examples.at(-1)"
          alt=""
          class="pointer-events-none absolute inset-0 size-full object-cover"
          :style="{ objectPosition: featured.heroPosition ?? '50% 30%' }"
          decoding="async"
        />
        <div
          class="pointer-events-none absolute inset-0 bg-linear-to-t from-page/90 via-page/80 to-page/20 sm:bg-linear-to-r sm:via-page/75 sm:to-transparent"
          aria-hidden="true"
        />
        <div
          class="pointer-events-none relative flex h-full flex-col justify-end gap-4 p-8 pt-6 pb-16 max-sm:gap-3 max-sm:p-6 max-sm:pb-14 sm:max-w-2xl sm:justify-center lg:p-12 lg:pt-8 lg:pb-18 short:gap-3 short:pt-5 short:pb-14"
        >
          <div class="flex flex-wrap items-center gap-2">
            <Badge
              variant="subtle"
              size="md"
              class="text-primary-comfy-canvas backdrop-blur-md"
            >
              {{ featured.category }}
            </Badge>
          </div>
          <h2
            class="mt-2 text-2xl font-bold text-balance text-primary-warm-white lg:text-3xl"
          >
            {{ featured.title }}
          </h2>
          <p
            class="line-clamp-2 max-w-prose shrink-0 text-content-secondary max-sm:line-clamp-1 short:hidden"
          >
            {{ featured.description }}
          </p>
          <div class="pointer-events-auto flex w-fit items-center gap-3">
            <Button as="a" :href="workflowPath(featured.slug)" class="w-fit">
              Try this workflow
            </Button>
          </div>
        </div>
      </div>
      <div
        class="absolute bottom-5 left-8 flex gap-2 lg:left-12"
        aria-label="Choose a featured workflow"
      >
        <button
          v-for="(highlight, index) in highlights"
          :key="highlight.slug"
          type="button"
          :aria-label="`${highlight.category}: ${highlight.title}`"
          :aria-current="selectedHighlight === index ? 'true' : undefined"
          class="group w-12 cursor-pointer rounded-full py-3 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          @click="selectedHighlight = index"
        >
          <span
            class="block h-1 overflow-hidden rounded-full bg-transparency-white-t20 group-hover:bg-primary-warm-gray"
          >
            <span
              class="block h-full rounded-full bg-primary-warm-white"
              :style="{ width: selectedHighlight === index ? '100%' : '0%' }"
            />
          </span>
        </button>
      </div>
    </section>
    <div
      class="sticky top-20 z-30 -mx-1 mb-8 flex scroll-mt-20 flex-wrap items-center justify-end gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 sm:flex-nowrap lg:top-26 lg:scroll-mt-26"
    >
      <label class="relative mr-auto min-w-0 flex-1 sm:max-w-xl sm:min-w-32">
        <Search
          class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-warm-gray"
          aria-hidden="true"
        />
        <input
          v-model="search"
          type="search"
          aria-label="Search workflows"
          placeholder="Search workflows"
          class="h-11 w-full rounded-2xl bg-transparency-white-t4 pr-4 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:text-base"
        />
      </label>
      <WorkshopFilterMenu
        v-model:use-cases="categories"
        :use-case-options="categoryOptions"
        :result-count="resultCount"
        show-label="Show {n} workflows"
      />
    </div>
    <div class="flex flex-col gap-12">
      <section
        v-for="shelf in shelves"
        :key="shelf.name"
        :aria-label="shelf.name"
      >
        <CardRow>
          <template #heading>
            <h2 class="text-xl font-medium text-primary-warm-white">
              {{ shelf.name }}
            </h2>
          </template>
          <li
            v-for="workflow in shelf.items"
            :key="workflow.slug"
            :class="cardClass"
          >
            <a
              :href="workflowPath(workflow.slug)"
              :title="workflow.description"
              class="group flex cursor-pointer flex-col gap-4 overflow-hidden rounded-4xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 hover:bg-hub-surface-hover focus-visible:outline-2 focus-visible:outline-primary-comfy-yellow"
              data-testid="workshop-workflow-card"
            >
              <div
                class="relative aspect-4/3 overflow-hidden rounded-[1.75rem] bg-hub-surface"
              >
                <img
                  :src="workflowMetadata(workflow).thumbnail"
                  :alt="workflow.title"
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                  class="size-full object-cover object-top transition-transform duration-300 select-none group-hover:scale-105"
                />
                <span
                  v-if="workflow.execution === 'deployment-demo'"
                  class="absolute bottom-3 left-3 rounded-full bg-page px-3 py-1.5 text-xs text-primary-comfy-yellow"
                  >Comfy API · Demo</span
                >
              </div>
              <div class="flex flex-col gap-2 px-3">
                <div
                  class="flex min-h-10 min-w-0 items-start gap-2 text-content-secondary"
                >
                  <Workflow class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <h3
                    class="line-clamp-2 h-10 min-w-0 text-sm/5 font-medium text-content-bright"
                    :title="workflow.title"
                  >
                    {{ workflow.title }}
                  </h3>
                </div>
                <div
                  class="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden"
                >
                  <span
                    class="inline-flex h-6 w-fit min-w-0 items-center rounded-full bg-hub-surface px-4 py-1 text-xs font-normal text-content"
                  >
                    <span class="truncate">{{
                      workflowMetadata(workflow).models.join(' · ')
                    }}</span>
                  </span>
                </div>
              </div>
            </a>
          </li>
        </CardRow>
      </section>
    </div>
    <p
      v-if="!shelves.length"
      role="status"
      class="py-16 text-center text-primary-warm-gray"
    >
      No workflows found. Try “lighting,” “material,” or “character.”
    </p>
  </div>
</template>
