<template>
  <PopoverRoot v-slot="{ open }">
    <PopoverAnchor as-child>
      <div
        data-testid="builder-opens-as"
        class="flex h-8 min-w-64 items-center justify-center gap-2 rounded-t-2xl bg-ocean-900 px-4 text-sm text-white"
      >
        <i :class="cn(currentModeIcon, 'size-4')" aria-hidden="true" />
        <i18n-t
          :keypath="
            isAppMode
              ? 'builderFooter.opensAsApp'
              : 'builderFooter.opensAsGraph'
          "
          tag="span"
        >
          <template #mode>
            <PopoverTrigger as-child>
              <Button
                class="-ml-0.5 h-6 gap-1 rounded-md bg-transparent px-1.5 text-sm text-white hover:bg-ocean-600/70"
              >
                {{
                  isAppMode
                    ? t('builderToolbar.app').toLowerCase()
                    : t('builderToolbar.nodeGraph').toLowerCase()
                }}
                <i
                  class="icon-[lucide--chevron-down] size-3.5"
                  aria-hidden="true"
                />
              </Button>
            </PopoverTrigger>
          </template>
        </i18n-t>
        <PopoverPortal :key="Number(open)">
          <PopoverContent
            side="top"
            :side-offset="5"
            :collision-padding="10"
            class="z-overlay rounded-lg border border-border/50 bg-background p-2 shadow-sm will-change-[transform,opacity]"
          >
            <ViewTypeRadioGroup
              :model-value="isAppMode"
              :aria-label="t('builderToolbar.defaultViewLabel')"
              size="sm"
              @update:model-value="$emit('select', $event)"
            />
          </PopoverContent>
        </PopoverPortal>
      </div>
    </PopoverAnchor>
  </PopoverRoot>
</template>

<script setup lang="ts">
import {
  PopoverPortal,
  PopoverAnchor,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'

import { cn } from '@comfyorg/tailwind-utils'

import ViewTypeRadioGroup from './ViewTypeRadioGroup.vue'

const { isAppMode } = defineProps<{
  isAppMode: boolean
}>()

defineEmits<{
  select: [openAsApp: boolean]
}>()

const { t } = useI18n()

const currentModeIcon = computed(() =>
  isAppMode ? 'icon-[lucide--app-window]' : 'icon-[comfy--workflow]'
)
</script>
