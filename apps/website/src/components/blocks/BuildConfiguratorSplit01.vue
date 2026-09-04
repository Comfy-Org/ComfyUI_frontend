<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed, ref } from 'vue'
import type { AnchorHTMLAttributes, HTMLAttributes } from 'vue'

import BrandButton from '../common/BrandButton.vue'
import CheckIcon from '../icons/CheckIcon.vue'

type Cta = {
  label: string
  href: string
  target?: AnchorHTMLAttributes['target']
  rel?: AnchorHTMLAttributes['rel']
}

type EnvironmentOption = {
  id: string
  python: string
  torch: string
  cuda: string
}

type ChipOption = {
  id: string
  label: string
  selected?: boolean
  mono?: boolean
}

const {
  heading,
  headingTag = 'h2',
  body,
  features = [],
  eyebrow,
  panelTitle,
  releasesLabel,
  releases,
  environmentsLabel,
  environments,
  nodesLabel,
  nodes,
  modelsLabel,
  models,
  cta,
  nodesUnit = 'nodes',
  modelsUnit = 'models',
  pinnedLabel = 'pinned',
  class: className
} = defineProps<{
  heading: string
  headingTag?: 'h1' | 'h2'
  body: string
  features?: readonly string[]
  eyebrow: string
  panelTitle?: string
  releasesLabel: string
  releases: readonly string[]
  environmentsLabel: string
  environments: readonly EnvironmentOption[]
  nodesLabel: string
  nodes: readonly ChipOption[]
  modelsLabel: string
  models: readonly ChipOption[]
  cta: Cta
  nodesUnit?: string
  modelsUnit?: string
  pinnedLabel?: string
  class?: HTMLAttributes['class']
}>()

const selectedRelease = ref(releases[0])
const selectedEnvironmentId = ref(environments[0]?.id)
const activeNodeIds = ref(
  nodes.filter((node) => node.selected).map((node) => node.id)
)
const activeModelIds = ref(
  models.filter((model) => model.selected).map((model) => model.id)
)

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((existing) => existing !== id)
    : [...ids, id]
}

const selectedEnvironment = computed(() =>
  environments.find(
    (environment) => environment.id === selectedEnvironmentId.value
  )
)

const environmentLabel = (environment: EnvironmentOption) =>
  `${environment.python} · ${environment.torch} · ${environment.cuda}`

const summaryEnvironment = computed(() => {
  const environment = selectedEnvironment.value
  if (!environment) return selectedRelease.value
  return `${selectedRelease.value} · py${environment.python} · torch ${environment.torch}`
})

const pillClasses = (selected: boolean) =>
  cn(
    'cursor-pointer rounded-[9px] px-3.5 py-2 font-mono text-xs transition-colors',
    selected
      ? 'bg-primary-comfy-plum text-primary-warm-white'
      : 'bg-primary-comfy-canvas/8 text-primary-warm-white/55 hover:bg-primary-comfy-canvas/15'
  )

const chipClasses = (option: ChipOption, selected: boolean) =>
  cn(
    'flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 transition-colors',
    option.mono ? 'font-mono text-[11.5px]' : 'text-[13px]',
    selected
      ? 'bg-primary-comfy-plum text-primary-warm-white'
      : 'bg-primary-comfy-canvas/8 text-primary-comfy-canvas hover:bg-primary-comfy-canvas/15'
  )
</script>

<template>
  <section
    :class="
      cn('max-w-9xl mx-auto w-full px-6 py-14 md:py-20 lg:px-12', className)
    "
  >
    <div
      class="bg-primary-comfy-ink-light flex flex-col gap-10 rounded-4xl p-6 md:p-10 lg:flex-row lg:gap-16 lg:p-14"
    >
      <div class="flex w-full flex-col justify-center lg:flex-1 lg:pl-6">
        <p
          class="text-primary-comfy-yellow mb-6 text-sm font-extrabold tracking-wider uppercase"
        >
          {{ eyebrow }}
        </p>
        <component
          :is="headingTag"
          class="text-3xl leading-[125%] font-light tracking-tight whitespace-pre-line text-primary-comfy-canvas md:text-4xl"
        >
          {{ heading }}
        </component>

        <p
          class="mt-6 max-w-2xl text-base/relaxed font-light text-primary-comfy-canvas/90"
        >
          {{ body }}
        </p>

        <ul v-if="features.length" class="mt-8 flex flex-col gap-3">
          <li
            v-for="feature in features"
            :key="feature"
            class="flex items-start gap-3 text-sm/relaxed text-primary-comfy-canvas md:text-base/relaxed"
          >
            <CheckIcon
              class="text-primary-comfy-yellow mt-0.5 size-5 shrink-0"
            />
            <span>{{ feature }}</span>
          </li>
        </ul>
      </div>

      <div class="w-full lg:flex-1">
        <p
          v-if="panelTitle"
          class="text-2xl font-medium text-primary-warm-white md:text-3xl"
        >
          {{ panelTitle }}
        </p>

        <div
          :class="panelTitle && 'mt-7'"
          role="group"
          :aria-label="releasesLabel"
        >
          <p
            class="text-[0.65rem] tracking-[0.12em] text-primary-warm-white/55 uppercase"
          >
            {{ releasesLabel }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="release in releases"
              :key="release"
              type="button"
              :aria-pressed="selectedRelease === release"
              :class="pillClasses(selectedRelease === release)"
              @click="selectedRelease = release"
            >
              {{ release }}
            </button>
          </div>
        </div>

        <div class="mt-6" role="group" :aria-label="environmentsLabel">
          <p
            class="text-[0.65rem] tracking-[0.12em] text-primary-warm-white/55 uppercase"
          >
            {{ environmentsLabel }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="environment in environments"
              :key="environment.id"
              type="button"
              :aria-pressed="selectedEnvironmentId === environment.id"
              :class="pillClasses(selectedEnvironmentId === environment.id)"
              @click="selectedEnvironmentId = environment.id"
            >
              {{ environmentLabel(environment) }}
            </button>
          </div>
        </div>

        <div class="mt-6" role="group" :aria-label="nodesLabel">
          <p
            class="text-[0.65rem] tracking-[0.12em] text-primary-warm-white/55 uppercase"
          >
            {{ nodesLabel }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="node in nodes"
              :key="node.id"
              type="button"
              :aria-pressed="activeNodeIds.includes(node.id)"
              :class="chipClasses(node, activeNodeIds.includes(node.id))"
              @click="activeNodeIds = toggleId(activeNodeIds, node.id)"
            >
              <span
                class="size-1.5 shrink-0 rounded-full"
                :class="
                  activeNodeIds.includes(node.id)
                    ? 'bg-primary-comfy-yellow'
                    : 'border border-primary-warm-gray'
                "
              />
              {{ node.label }}
            </button>
          </div>
        </div>

        <div class="mt-6" role="group" :aria-label="modelsLabel">
          <p
            class="text-[0.65rem] tracking-[0.12em] text-primary-warm-white/55 uppercase"
          >
            {{ modelsLabel }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="model in models"
              :key="model.id"
              type="button"
              :aria-pressed="activeModelIds.includes(model.id)"
              :class="chipClasses(model, activeModelIds.includes(model.id))"
              @click="activeModelIds = toggleId(activeModelIds, model.id)"
            >
              <span
                class="size-1.5 shrink-0 rounded-full"
                :class="
                  activeModelIds.includes(model.id)
                    ? 'bg-primary-comfy-yellow'
                    : 'border border-primary-warm-gray'
                "
              />
              {{ model.label }}
            </button>
          </div>
        </div>

        <div
          class="border-primary-comfy-plum/25 mt-8 flex flex-col gap-5 border-t pt-5 sm:flex-row sm:items-end sm:justify-between"
        >
          <p
            class="font-mono text-[11.5px]/relaxed text-primary-warm-white/55"
            data-testid="build-summary"
          >
            {{ summaryEnvironment }}
            <br />
            <span class="text-primary-warm-white/90">
              {{ activeNodeIds.length }} {{ nodesUnit }}
            </span>
            ·
            <span class="text-primary-warm-white/90">
              {{ activeModelIds.length }} {{ modelsUnit }}
            </span>
            · {{ pinnedLabel }}
          </p>

          <BrandButton
            :href="cta.href"
            :target="cta.target"
            :rel="cta.rel"
            size="sm"
            class="shrink-0 px-6 py-2.5 uppercase"
          >
            {{ cta.label }}
          </BrandButton>
        </div>
      </div>
    </div>
  </section>
</template>
