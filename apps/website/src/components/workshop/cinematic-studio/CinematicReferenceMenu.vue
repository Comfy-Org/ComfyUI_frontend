<script setup lang="ts">
import { Clapperboard, Film, Plus, UserRound, X } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import type { StudioImage } from '../../../lib/workshop/cinematic-studio/take-image'
import { studioT as tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicTooltip from './CinematicTooltip.vue'
import type { ReferenceKind } from './reference-kind'
import { useImagePreview } from './useImagePreview'
import { REFERENCE_SLOTS } from './reference-kind'

const { shown = ['cast'], locale = 'en' } = defineProps<{
  /** The slots this shot can fill: references for a still, frames for a clip. */
  shown?: readonly ReferenceKind[]
  locale?: Locale
}>()

const cast = defineModel<StudioImage | undefined>('cast')
const firstFrame = defineModel<StudioImage | undefined>('firstFrame')
const lastFrame = defineModel<StudioImage | undefined>('lastFrame')
const sourceVideo = defineModel<StudioImage | undefined>('sourceVideo')
const files = { cast, firstFrame, lastFrame, video: sourceVideo }
const previews = {
  cast: useImagePreview(() => cast.value),
  firstFrame: useImagePreview(() => firstFrame.value),
  lastFrame: useImagePreview(() => lastFrame.value)
}

const ICONS: Readonly<Record<ReferenceKind, typeof Plus>> = {
  cast: UserRound,
  firstFrame: Clapperboard,
  lastFrame: Clapperboard,
  video: Film
}

const kinds = computed(() =>
  shown.map((kind) => ({
    kind,
    icon: ICONS[kind],
    label: tc(REFERENCE_SLOTS[kind].label, {}, { locale }),
    file: files[kind].value,
    detail:
      files[kind].value?.name ??
      tc(REFERENCE_SLOTS[kind].action, {}, { locale }),
    preview: kind === 'video' ? undefined : previews[kind].value
  }))
)
const attached = computed(() => kinds.value.filter((entry) => entry.file))
const cover = computed(
  () => attached.value.find((entry) => entry.preview)?.preview
)
const heading = computed(() =>
  tc('cinematic.section.references', {}, { locale })
)

const inputs: Partial<Record<ReferenceKind, HTMLInputElement>> = {}
function keepInput(kind: ReferenceKind, element: unknown) {
  if (element instanceof HTMLInputElement) inputs[kind] = element
}

function pick(kind: ReferenceKind) {
  inputs[kind]?.click()
}

function attach(kind: ReferenceKind, event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const [picked] = target.files ?? []
  if (picked) files[kind].value = picked
  target.value = ''
}

function remove(kind: ReferenceKind) {
  files[kind].value = undefined
}

const itemClass =
  'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 text-sm text-content-secondary outline-none select-none data-highlighted:bg-transparency-white-t4 data-highlighted:text-content-bright'
</script>

<template>
  <CinematicTooltip :text="heading">
    <span class="flex h-full">
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          :aria-label="tc('cinematic.composer.references', {}, { locale })"
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
              <span>{{
                tc('cinematic.reference.optional', {}, { locale })
              }}</span>
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
                  {{ entry.detail }}
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
                {{ tc('cinematic.reference.remove', {}, { locale }) }}:
                {{ entry.label }}
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </span>
  </CinematicTooltip>
  <input
    v-for="kind in shown"
    :key="kind"
    :ref="(element) => keepInput(kind, element)"
    type="file"
    :accept="REFERENCE_SLOTS[kind].accept"
    :data-testid="`cinematic-reference-${kind}`"
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    @change="attach(kind, $event)"
  />
</template>
