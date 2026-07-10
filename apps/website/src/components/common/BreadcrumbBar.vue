<script setup lang="ts">
type Crumb = { label: string; href?: string }

const { crumbs, updated } = defineProps<{
  crumbs: readonly Crumb[]
  updated?: string
}>()
</script>

<template>
  <nav
    aria-label="Breadcrumb"
    class="max-w-9xl mx-auto flex items-center justify-between gap-4 px-6 py-3 lg:px-20"
  >
    <ol
      class="text-primary-warm-gray flex flex-wrap items-center gap-2 text-xs tracking-wide uppercase"
    >
      <li
        v-for="(crumb, i) in crumbs"
        :key="crumb.label"
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
      class="text-primary-warm-gray shrink-0 text-xs tracking-wide uppercase"
    >
      {{ updated }}
    </p>
  </nav>
</template>
