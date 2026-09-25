<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { CreativeSettings,Movement } from '../../../lib/workshop/cinematic-studio/creative'
import { tcCreative } from '../../../lib/workshop/cinematic-studio/creative-copy'
import { computed } from 'vue'
import { MOVEMENTS } from '../../../lib/workshop/cinematic-studio/creative'
const { locale, fieldClass, actionClass } = defineProps<{
  locale: Locale
  fieldClass: string
  actionClass: string
}>()
const search = defineModel<string>('search', { required: true })
const moves = computed(() =>
  MOVEMENTS.filter(([id, description]) =>
    `${t(id)} ${description}`.toLowerCase().includes(search.value.toLowerCase())
  )
)
function toggleMove(id: Movement) {
  const moves = draft.value.movements
  if (moves.includes(id))
    draft.value.movements = moves.filter((move) => move !== id)
  else if (moves.length < 4) moves.push(id)
}
function reorderMove(index: number, offset: number) {
  const moves = [...draft.value.movements]
  const [move] = moves.splice(index, 1)
  moves.splice(index + offset, 0, move)
  draft.value.movements = moves
}
const draft = defineModel<CreativeSettings>({ required: true })
const t = (key: Parameters<typeof tcCreative>[0]) => tcCreative(key, locale)
</script>
<template>
  <section class="flex flex-col gap-3">
    <h3 class="font-semibold">
      {{ t('movements') }} · {{ draft.movements.length }}/4
    </h3>
    <ol class="flex flex-col gap-2">
      <li
        v-for="(move, index) in draft.movements"
        :key="move"
        class="flex flex-wrap items-center gap-2 rounded-lg border border-transparency-white-t8 p-2"
      >
        <span class="mr-auto text-sm">{{ index + 1 }}. {{ t(move) }}</span>
        <button
          type="button"
          :class="actionClass"
          :aria-label="`${t('earlier')}: ${t(move)}`"
          :disabled="index === 0"
          @click="reorderMove(index, -1)"
        >
          ↑
        </button>
        <button
          type="button"
          :class="actionClass"
          :aria-label="`${t('later')}: ${t(move)}`"
          :disabled="index === draft.movements.length - 1"
          @click="reorderMove(index, 1)"
        >
          ↓
        </button>
        <button type="button" :class="actionClass" @click="toggleMove(move)">
          {{ t('remove') }}
        </button>
      </li>
    </ol>
    <button
      v-if="draft.movements.length"
      type="button"
      :class="actionClass"
      @click="draft.movements = []"
    >
      {{ t('clear') }}
    </button>
    <input
      v-model="search"
      type="search"
      :class="fieldClass"
      :placeholder="t('search')"
      :aria-label="t('search')"
    />
    <div class="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
      <button
        v-for="[id] in moves"
        :key="id"
        type="button"
        :class="actionClass"
        :aria-pressed="draft.movements.includes(id)"
        :disabled="draft.movements.length >= 4 && !draft.movements.includes(id)"
        @click="toggleMove(id)"
      >
        {{ draft.movements.includes(id) ? '✓ ' : '' }}{{ t(id) }}
      </button>
    </div>
    <p v-if="!moves.length" class="text-sm">{{ t('empty') }}</p>
  </section>
</template>
