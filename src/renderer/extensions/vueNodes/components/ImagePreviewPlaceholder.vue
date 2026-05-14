<template>
  <div
    :class="
      cn(
        'flex size-full flex-col items-center justify-center px-2 text-center text-base-foreground',
        variant === 'gallery' ? 'gap-2 py-8' : 'gap-1 py-3'
      )
    "
    role="img"
    :aria-label="ariaLabel"
    data-testid="image-preview-placeholder"
  >
    <i
      :class="
        cn(
          'icon-[lucide--file-image] text-base-foreground/70',
          variant === 'gallery' ? 'size-12' : 'size-6'
        )
      "
    />
    <span
      :class="
        cn(
          'rounded-sm bg-base-foreground/15 px-1.5 py-0.5 font-mono font-semibold tracking-wide uppercase',
          variant === 'gallery' ? 'text-xs' : 'text-2xs'
        )
      "
    >
      {{ format }}
    </span>
    <template v-if="variant === 'gallery'">
      <p class="text-xs text-base-foreground/70">
        {{ $t('g.previewNotAvailable') }}
      </p>
      <p
        v-if="filename"
        class="line-clamp-2 max-w-full text-2xs break-all text-base-foreground/60"
      >
        {{ filename }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

interface ImagePreviewPlaceholderProps {
  readonly format: string
  readonly filename?: string
  readonly variant?: 'gallery' | 'thumbnail'
}

const {
  format,
  filename,
  variant = 'gallery'
} = defineProps<ImagePreviewPlaceholderProps>()

const { t } = useI18n()

const ariaLabel = computed(
  () => t('g.previewNotAvailable') + (filename ? ` (${filename})` : '')
)
</script>
