<script setup lang="ts">
import type { PackNode } from '../../data/cloudNodes'
import type { Locale } from '../../i18n/translations'

import { useNodesByCategory } from '../../composables/useNodesByCategory'
import { t } from '../../i18n/translations'

const { locale = 'en', nodes } = defineProps<{
  locale?: Locale
  nodes: readonly PackNode[]
}>()

const { groupedNodes } = useNodesByCategory(() => nodes)
</script>

<template>
  <details
    class="group rounded-2xl border border-primary-warm-gray/20 px-4 py-3"
  >
    <summary
      class="cursor-pointer list-none text-sm font-semibold text-primary-comfy-canvas"
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
          class="text-xs font-semibold tracking-widest text-primary-warm-gray uppercase"
        >
          {{ group.category }}
        </h4>
        <ul class="flex flex-col gap-1">
          <li
            v-for="node in group.nodes"
            :key="node.name"
            class="text-sm/relaxed text-primary-comfy-canvas"
          >
            {{ node.displayName }}
          </li>
        </ul>
      </div>
    </div>
  </details>
</template>
