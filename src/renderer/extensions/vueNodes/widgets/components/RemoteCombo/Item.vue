<script setup lang="ts">
import { ComboboxItem, ComboboxItemIndicator } from 'reka-ui'
import { computed, inject, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { DropdownItemShape } from '@/base/remote/itemSchema'

import { itemVariants } from './remoteCombo.variants'
import type { ItemVariants } from './remoteCombo.variants'
import { RemoteComboKey } from './state'

const props = defineProps<{
  item: DropdownItemShape
  index: number
  layout?: ItemVariants['layout']
  class?: string
}>()

const ctx = inject(RemoteComboKey)
if (!ctx) {
  throw new Error('RemoteCombo.Item must be used inside RemoteCombo.Root')
}

const { t } = useI18n()

const isSelected = computed(() => ctx.selectedValue.value === props.item.id)
const hasPreview = computed(() => !!props.item.preview_url)

const audioEl = useTemplateRef<HTMLAudioElement>('audioEl')
const isPlaying = ref(false)

function toggleAudio() {
  const el = audioEl.value
  if (!el) return
  if (el.paused) {
    void el.play().then(() => {
      isPlaying.value = true
    })
  } else {
    el.pause()
    isPlaying.value = false
  }
}

function handleAudioEnded() {
  isPlaying.value = false
}
</script>

<template>
  <ComboboxItem
    :value="item.id"
    :class="cn(itemVariants({ layout: props.layout }), props.class)"
    :data-testid="`remote-combo-item-${index}`"
    @select="ctx.select(item.id)"
  >
    <slot :item="item" :index="index" :is-selected="isSelected">
      <template v-if="hasPreview && ctx.previewType.value === 'image'">
        <img
          :src="item.preview_url"
          :alt="item.name"
          class="size-10 shrink-0 rounded-sm object-cover"
          loading="lazy"
          decoding="async"
        />
      </template>
      <template v-else-if="hasPreview && ctx.previewType.value === 'video'">
        <video
          :src="item.preview_url"
          class="size-10 shrink-0 rounded-sm object-cover"
          preload="metadata"
          muted
          playsinline
          aria-hidden="true"
        />
      </template>
      <template v-else-if="hasPreview && ctx.previewType.value === 'audio'">
        <button
          type="button"
          class="focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-background-hover text-base-foreground hover:bg-secondary-background-selected focus-visible:ring-1 focus-visible:outline-none"
          :aria-label="
            isPlaying
              ? t('widgets.remoteCombo.pauseAudioPreview')
              : t('widgets.remoteCombo.playAudioPreview')
          "
          :aria-pressed="isPlaying"
          @click.stop="toggleAudio"
          @pointerdown.stop
        >
          <i
            :class="
              cn(
                'size-4',
                isPlaying ? 'icon-[lucide--pause]' : 'icon-[lucide--play]'
              )
            "
            aria-hidden="true"
          />
          <audio
            ref="audioEl"
            :src="item.preview_url"
            preload="none"
            class="sr-only"
            @ended="handleAudioEnded"
          />
        </button>
      </template>
      <div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span class="truncate">{{ item.name }}</span>
        <span
          v-if="item.description"
          class="truncate text-[10px] text-muted-foreground"
        >
          {{ item.description }}
        </span>
      </div>
    </slot>
    <ComboboxItemIndicator>
      <i
        class="icon-[lucide--check] size-4 text-primary-background"
        aria-hidden="true"
      />
    </ComboboxItemIndicator>
  </ComboboxItem>
</template>
