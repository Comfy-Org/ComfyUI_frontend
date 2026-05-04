<script setup lang="ts">
import { computed } from 'vue'

import type { PackNode } from '../../data/cloudNodes'
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { locale = 'en', nodes } = defineProps<{
  locale?: Locale
  nodes: readonly PackNode[]
}>()

const groupedNodes = computed(() => {
  const byCategory = new Map<string, PackNode[]>()
  for (const node of nodes) {
    const category = node.category || 'misc'
    const existing = byCategory.get(category)
    if (existing) {
      existing.push(node)
      continue
    }
    byCategory.set(category, [node])
  }

  return [...byCategory.entries()]
    .map(([category, categoryNodes]) => ({
      category,
      nodes: [...categoryNodes].sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      )
    }))
    .sort((a, b) => a.category.localeCompare(b.category))
})
</script>

<template>
  <details
    class="group border-primary-warm-gray/20 rounded-2xl border px-4 py-3"
  >
    <summary
      class="text-primary-comfy-canvas cursor-pointer list-none text-sm font-semibold"
    >
      {{ t('cloudNodes.card.nodesHeading', locale) }}
    </summary>

    <div class="mt-4 flex flex-col gap-5">
      <div
        v-for="group in groupedNodes"
        :key="group.category"
        class="flex flex-col gap-2"
      >
        <h4
          class="text-primary-warm-gray text-xs font-semibold tracking-widest uppercase"
        >
          {{ group.category }}
        </h4>
        <ul class="flex flex-col gap-1">
          <li
            v-for="node in group.nodes"
            :key="node.name"
            class="text-primary-comfy-canvas text-sm/relaxed"
          >
            {{ node.displayName }}
          </li>
        </ul>
      </div>
    </div>
  </details>
</template>
