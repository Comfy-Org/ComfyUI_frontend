<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { SeedBehavior } from '../../../lib/workshop/cinematic-studio/seed-behavior'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'

const {
  bounds,
  disabled = false,
  locale = 'en'
} = defineProps<{
  bounds: NonNullable<CinematicModel['seed']>
  disabled?: boolean
  locale?: Locale
}>()
const seed = defineModel<number>('seed')
const behavior = defineModel<SeedBehavior>('behavior', { required: true })
const labels = {
  random: ['Randomize', '随机'],
  fixed: ['Fixed value', '固定值'],
  increment: ['Increment (+1)', '递增 (+1)'],
  decrement: ['Decrement (−1)', '递减 (−1)']
} as const
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-2 text-xs text-primary-comfy-canvas"
  >
    <label class="flex items-center gap-2">
      {{ libraryCopy('seed', locale) }}
      <input
        :value="seed ?? ''"
        type="number"
        :step="bounds.step"
        :min="bounds.minimum"
        :max="bounds.maximum"
        :placeholder="libraryCopy('random', locale)"
        :disabled
        class="h-9 w-28 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-2 text-primary-warm-white"
        @input="
          seed =
            ($event.target as HTMLInputElement).value === ''
              ? undefined
              : Number(($event.target as HTMLInputElement).value)
        "
      />
    </label>
    <label class="flex items-center gap-2">
      {{ locale === 'zh-CN' ? '运行后' : 'After run' }}
      <select
        v-model="behavior"
        :disabled
        class="h-9 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-2 text-primary-warm-white"
      >
        <option v-for="(label, value) in labels" :key="value" :value="value">
          {{ label[locale === 'zh-CN' ? 1 : 0] }}
        </option>
      </select>
    </label>
    <span class="basis-full text-xs">{{
      locale === 'zh-CN'
        ? '成功运行后更新；同一次运行的多个镜头共享固定种子。达到上限或下限时循环。'
        : 'Updates after a successful run. Takes share the entered seed. At the limit, wraps around.'
    }}</span>
  </div>
</template>
