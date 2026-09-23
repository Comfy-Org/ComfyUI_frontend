<script setup lang="ts">
import { Palette, Plus, UserRound, X } from '@lucide/vue'
import { useObjectUrl } from '@vueuse/core'
import { useTemplateRef } from 'vue'

import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

const { kind, locale = 'en' } = defineProps<{
  kind: 'cast' | 'palette'
  locale?: Locale
}>()

const file = defineModel<File | undefined>()
const preview = useObjectUrl(file)
const input = useTemplateRef<HTMLInputElement>('input')

function choose(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const [picked] = target.files ?? []
  if (picked) file.value = picked
  target.value = ''
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex h-20 w-full items-center gap-3 rounded-2xl border border-dashed border-transparency-white-t20 bg-transparency-white-t4 px-3 text-left transition-colors hover:border-primary-warm-white/60 data-[filled=true]:border-solid data-[filled=true]:border-transparency-white-t8"
      :data-filled="!!file"
      :aria-label="
        t(
          kind === 'cast'
            ? 'cinematic.reference.castAction'
            : 'cinematic.reference.paletteAction',
          locale
        )
      "
      @click="input?.click()"
    >
      <img
        v-if="preview"
        :src="preview"
        alt=""
        :class="
          kind === 'cast'
            ? 'size-12 rounded-full object-cover'
            : 'size-12 rounded-lg object-cover'
        "
      />
      <span
        v-else
        class="grid size-12 shrink-0 place-items-center rounded-xl bg-transparency-white-t8 text-primary-warm-gray"
      >
        <UserRound v-if="kind === 'cast'" class="size-5" aria-hidden="true" />
        <Palette v-else class="size-5" aria-hidden="true" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-sm font-semibold text-primary-warm-white">
          {{
            t(
              kind === 'cast'
                ? 'cinematic.reference.cast'
                : 'cinematic.reference.palette',
              locale
            )
          }}
        </span>
        <span class="truncate text-xs text-primary-warm-gray">
          {{
            file
              ? file.name
              : t(
                  kind === 'cast'
                    ? 'cinematic.reference.castHint'
                    : 'cinematic.reference.paletteHint',
                  locale
                )
          }}
        </span>
      </span>
      <Plus
        v-if="!file"
        class="size-4 shrink-0 text-primary-warm-gray"
        aria-hidden="true"
      />
    </button>
    <button
      v-if="file"
      type="button"
      class="absolute top-2 right-2 grid size-7 place-items-center rounded-lg text-primary-warm-gray hover:bg-transparency-white-t8"
      :aria-label="t('cinematic.reference.remove', locale)"
      @click="file = undefined"
    >
      <X class="size-3.5" aria-hidden="true" />
    </button>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="choose"
    />
  </div>
</template>
