<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { LayoutMode } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'

const props = defineProps<{
  layout?: LayoutMode
}>()

const layoutMode = defineModel<LayoutMode>('layout', { default: 'list' })

void props

const { t } = useI18n()

function setLayout(mode: LayoutMode) {
  layoutMode.value = mode
}
</script>

<template>
  <div
    class="flex items-center gap-1"
    role="group"
    :aria-label="t('widgets.remoteCombo.layoutSwitcherAriaLabel')"
    data-testid="remote-combo-layout-switcher"
  >
    <Button
      variant="textonly"
      size="icon-sm"
      type="button"
      :aria-label="t('widgets.remoteCombo.layoutList')"
      :aria-pressed="layoutMode === 'list'"
      :class="cn(layoutMode === 'list' && 'bg-secondary-background-selected')"
      @click.stop="setLayout('list')"
    >
      <i class="icon-[lucide--list] size-4" aria-hidden="true" />
    </Button>
    <Button
      variant="textonly"
      size="icon-sm"
      type="button"
      :aria-label="t('widgets.remoteCombo.layoutGrid')"
      :aria-pressed="layoutMode === 'grid'"
      :class="cn(layoutMode === 'grid' && 'bg-secondary-background-selected')"
      @click.stop="setLayout('grid')"
    >
      <i class="icon-[lucide--grid-2x2] size-4" aria-hidden="true" />
    </Button>
  </div>
</template>
