<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { useResizeObserver } from '@vueuse/core'

import { onMounted, shallowRef, useId, useTemplateRef } from 'vue'
import type { HTMLAttributes } from 'vue'

type WatchBreadcrumb = {
  label: string
  /** Omitted on the current page, which renders as plain text. */
  href?: string
}

const {
  breadcrumbs = [],
  breadcrumbsLabel,
  eyebrow,
  eyebrowDetail,
  title,
  description,
  readMoreLabel,
  readLessLabel,
  class: className
} = defineProps<{
  breadcrumbs?: readonly WatchBreadcrumb[]
  /** Accessible name for the breadcrumb nav; required when breadcrumbs are passed. */
  breadcrumbsLabel?: string
  eyebrow?: string
  eyebrowDetail?: string
  title: string
  description?: string
  readMoreLabel?: string
  readLessLabel?: string
  class?: HTMLAttributes['class']
}>()

const expanded = shallowRef(false)
const clamped = shallowRef(false)
const descriptionId = useId()
const descriptionEl = useTemplateRef<HTMLParagraphElement>('descriptionEl')

function updateClamped() {
  const el = descriptionEl.value
  clamped.value = !!el && el.scrollHeight > el.clientHeight
}

onMounted(updateClamped)
useResizeObserver(descriptionEl, updateClamped)
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 pt-8 pb-16 lg:pb-24', className)">
    <nav v-if="breadcrumbs.length" :aria-label="breadcrumbsLabel" class="mb-6">
      <ol
        class="text-primary-warm-gray flex flex-wrap items-center gap-2 text-sm font-light"
      >
        <li
          v-for="(crumb, index) in breadcrumbs"
          :key="crumb.label"
          class="flex items-center gap-2"
        >
          <a
            v-if="crumb.href"
            :href="crumb.href"
            class="hover:text-primary-warm-white hover:underline"
          >
            {{ crumb.label }}
          </a>
          <span v-else aria-current="page" class="text-primary-warm-white">
            {{ crumb.label }}
          </span>
          <span v-if="index < breadcrumbs.length - 1" aria-hidden="true"
            >/</span
          >
        </li>
      </ol>
    </nav>

    <slot />

    <div class="mt-10 flex flex-col gap-10 lg:mt-14 lg:flex-row lg:gap-12">
      <div class="min-w-0 flex-1">
        <p
          v-if="eyebrow"
          class="flex flex-wrap items-baseline gap-2 text-sm font-extrabold tracking-wider uppercase"
        >
          <span class="text-primary-comfy-yellow">{{ eyebrow }}</span>
          <span v-if="eyebrowDetail" class="text-primary-warm-white">{{
            eyebrowDetail
          }}</span>
        </p>

        <h1
          class="text-3.5xl mt-5 font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
        >
          {{ title }}
        </h1>

        <div v-if="description" class="mt-5">
          <p
            :id="descriptionId"
            ref="descriptionEl"
            :class="
              cn(
                'text-primary-warm-gray text-lg/relaxed font-light',
                !expanded && 'line-clamp-4'
              )
            "
          >
            {{ description }}
          </p>
          <button
            v-if="readMoreLabel && (clamped || expanded)"
            type="button"
            :aria-expanded="expanded"
            :aria-controls="descriptionId"
            class="text-primary-warm-white mt-2 cursor-pointer text-lg font-light hover:underline"
            @click="expanded = !expanded"
          >
            {{ expanded ? (readLessLabel ?? readMoreLabel) : readMoreLabel }}
          </button>
        </div>

        <div v-if="$slots.author" class="mt-8">
          <slot name="author" />
        </div>

        <div
          v-if="$slots.actions"
          class="mt-8 flex flex-wrap items-center justify-between gap-4"
        >
          <slot name="actions" />
        </div>

        <template v-if="$slots.chapters">
          <hr class="mt-10 border-white/10" />
          <div class="mt-10">
            <slot name="chapters" />
          </div>
        </template>
      </div>

      <aside v-if="$slots.sidebar" class="w-full shrink-0 lg:w-100">
        <slot name="sidebar" />
      </aside>
    </div>
  </section>
</template>
