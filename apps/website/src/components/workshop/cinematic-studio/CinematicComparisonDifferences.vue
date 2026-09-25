<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { Locale } from '../../../i18n/translations'
import { tcComparison } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import type { ComparisonCopyKey } from '../../../lib/workshop/cinematic-studio/comparison-copy'
const { differences, locale } = defineProps<{
  differences: readonly {
    key: ComparisonCopyKey
    changed: boolean
    left?: string
    right?: string
  }[]
  locale: Locale
}>()
const differenceCount = computed(
  () => differences.filter((row) => row.changed).length
)
const t = (key: ComparisonCopyKey) => tcComparison(key, locale)
</script>
<template>
  <details
    open
    class="rounded-xl border border-transparency-white-t20 p-3 text-primary-warm-white"
  >
    <summary class="cursor-pointer text-sm font-semibold">
      {{ t('differenceTitle') }} · {{ differenceCount }}
      {{ t(differenceCount === 1 ? 'difference' : 'differences') }}
    </summary>
    <p class="my-3 text-xs text-primary-comfy-canvas">
      {{ t('differenceNote') }}
    </p>
    <table class="w-full table-fixed text-left text-xs sm:text-sm">
      <caption class="sr-only">
        {{
          t('differenceTitle')
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col" class="w-[35%] p-2">{{ t('setting') }}</th>
          <th scope="col" class="w-[32.5%] p-2">{{ t('first') }}</th>
          <th scope="col" class="w-[32.5%] p-2">{{ t('second') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in differences"
          :key="row.key"
          :class="
            cn(
              'border-t border-transparency-white-t20',
              row.changed && 'bg-transparency-white-t8'
            )
          "
        >
          <th scope="row" class="p-2 align-top wrap-break-word">
            {{ t(row.key)
            }}<span v-if="row.changed" class="mt-1 block text-xs font-normal">{{
              t('changed')
            }}</span>
          </th>
          <td
            v-for="side in ['left', 'right'] as const"
            :key="side"
            class="p-2 align-top"
          >
            <div
              class="max-h-40 overflow-auto wrap-break-word whitespace-pre-wrap"
              tabindex="0"
            >
              {{ row[side] ?? t('notRecorded') }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </details>
</template>
