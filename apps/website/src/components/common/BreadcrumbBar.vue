<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

type Crumb = { label: string; href?: string }

const {
  crumbs,
  updated,
  label = 'Breadcrumb',
  stackOnMobile = false
} = defineProps<{
  crumbs: readonly Crumb[]
  updated?: string
  label?: string
  stackOnMobile?: boolean
}>()
</script>

<template>
  <nav
    :aria-label="label"
    :class="
      cn(
        'mx-auto flex max-w-9xl px-6 py-3 lg:px-20',
        stackOnMobile
          ? 'flex-col items-start gap-2 md:flex-row md:items-center md:justify-between md:gap-4'
          : 'items-center justify-between gap-4'
      )
    "
  >
    <ol
      class="flex flex-wrap items-center gap-2 text-xs tracking-wide text-primary-warm-gray uppercase"
    >
      <li
        v-for="(crumb, i) in crumbs"
        :key="`${i}-${crumb.label}`"
        class="flex items-center gap-2"
      >
        <span v-if="i > 0" aria-hidden="true" class="text-primary-warm-gray/60">
          /
        </span>
        <a
          v-if="crumb.href"
          :href="crumb.href"
          class="transition-colors hover:text-primary-comfy-canvas"
        >
          {{ crumb.label }}
        </a>
        <span v-else aria-current="page" class="text-primary-comfy-canvas">
          {{ crumb.label }}
        </span>
      </li>
    </ol>

    <p
      v-if="updated"
      class="shrink-0 text-xs tracking-wide text-primary-warm-gray uppercase"
    >
      {{ updated }}
    </p>
  </nav>
</template>
