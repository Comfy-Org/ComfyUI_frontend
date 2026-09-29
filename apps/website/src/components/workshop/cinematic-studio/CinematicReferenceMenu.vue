<script setup lang="ts">
import { Palette, Plus, UserRound, X } from '@lucide/vue'
import { useObjectUrl } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicTooltip from './CinematicTooltip.vue'

type ReferenceKind = 'cast' | 'palette'

const { kinds: shownKinds = ['cast', 'palette'], locale = 'en' } = defineProps<{
  kinds?: readonly ReferenceKind[]
  locale?: Locale
}>()

const cast = defineModel<File | undefined>('cast')
const palette = defineModel<File | undefined>('palette')

const castPreview = useObjectUrl(cast)
const palettePreview = useObjectUrl(palette)
const castInput = useTemplateRef<HTMLInputElement>('castInput')
const paletteInput = useTemplateRef<HTMLInputElement>('paletteInput')

const allKinds = computed(() => [
  {
    kind: 'cast' as const,
    icon: UserRound,
    label: tc('cinematic.reference.cast', locale),
    action: tc('cinematic.reference.castAction', locale),
    file: cast.value,
    preview: castPreview.value
  },
  {
    kind: 'palette' as const,
    icon: Palette,
    label: tc('cinematic.reference.palette', locale),
    action: tc('cinematic.reference.paletteAction', locale),
    file: palette.value,
    preview: palettePreview.value
  }
])
const kinds = computed(() =>
  allKinds.value.filter((entry) => shownKinds.includes(entry.kind))
)
const attached = computed(() => kinds.value.filter((entry) => entry.file))
const cover = computed(() => attached.value[0]?.preview)
const heading = computed(() => tc('cinematic.section.references', locale))

function pick(kind: ReferenceKind) {
  const input = kind === 'cast' ? castInput.value : paletteInput.value
  input?.click()
}

function attach(kind: ReferenceKind, event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const [picked] = target.files ?? []
  if (picked && kind === 'cast') cast.value = picked
  if (picked && kind === 'palette') palette.value = picked
  target.value = ''
}

function remove(kind: ReferenceKind) {
  if (kind === 'cast') cast.value = undefined
  else palette.value = undefined
}

const itemClass =
  'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 text-sm text-content-secondary outline-none select-none data-highlighted:bg-transparency-white-t4 data-highlighted:text-content-bright'
</script>

<template>
  <CinematicTooltip :text="heading">
    <span class="flex h-full">
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          :aria-label="tc('cinematic.composer.references', locale)"
          :class="
            cn(
              'relative grid size-9 shrink-0 place-items-center rounded-xl border border-dashed border-transparency-white-t20 text-primary-comfy-canvas outline-none hover:border-primary-warm-white/50 hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 data-[state=open]:border-primary-warm-white',
              cover && 'border-solid'
            )
          "
        >
          <img
            v-if="cover"
            :src="cover"
            alt=""
            class="size-full rounded-[inherit] object-cover"
          />
          <Plus v-else class="size-4" aria-hidden="true" />
          <span
            v-if="attached.length > 1"
            class="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-primary-comfy-yellow text-[10px] font-bold text-primary-comfy-ink"
          >
            {{ attached.length }}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            side="top"
            align="start"
            :side-offset="8"
            :collision-padding="8"
            class="z-50 w-72 rounded-2xl border border-transparency-white-t8 bg-site-dropdown p-1.5 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <DropdownMenuLabel
              class="flex items-center justify-between px-2.5 pt-1.5 pb-1 text-xs text-primary-warm-gray"
            >
              {{ heading }}
              <span>{{ tc('cinematic.reference.optional', locale) }}</span>
            </DropdownMenuLabel>
            <DropdownMenuItem
              v-for="entry in kinds"
              :key="entry.kind"
              :class="itemClass"
              @select="pick(entry.kind)"
            >
              <img
                v-if="entry.preview"
                :src="entry.preview"
                alt=""
                class="size-7 shrink-0 rounded-lg object-cover"
              />
              <span
                v-else
                class="grid size-7 shrink-0 place-items-center rounded-lg bg-transparency-white-t8"
                aria-hidden="true"
              >
                <component :is="entry.icon" class="size-3.5" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="text-content-bright">{{ entry.label }}</span>
                <span class="truncate text-xs text-primary-warm-gray">
                  {{ entry.file?.name ?? entry.action }}
                </span>
              </span>
              <Plus
                v-if="!entry.file"
                class="size-4 shrink-0 text-primary-warm-gray"
                aria-hidden="true"
              />
            </DropdownMenuItem>
            <template v-if="attached.length">
              <DropdownMenuSeparator
                class="my-1 h-px bg-transparency-white-t8"
              />
              <DropdownMenuItem
                v-for="entry in attached"
                :key="`remove-${entry.kind}`"
                :class="cn(itemClass, 'h-9')"
                @select="remove(entry.kind)"
              >
                <X class="size-4 shrink-0" aria-hidden="true" />
                {{ tc('cinematic.reference.remove', locale) }}:
                {{ entry.label }}
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </span>
  </CinematicTooltip>
  <input
    ref="castInput"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    data-testid="cinematic-reference-cast"
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    @change="attach('cast', $event)"
  />
  <input
    v-if="shownKinds.includes('palette')"
    ref="paletteInput"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    data-testid="cinematic-reference-palette"
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    @change="attach('palette', $event)"
  />
</template>
