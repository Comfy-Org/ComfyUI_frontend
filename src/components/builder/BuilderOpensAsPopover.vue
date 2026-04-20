<template>
  <PopoverRoot>
    <PopoverAnchor as-child>
      <div
        data-testid="builder-opens-as"
        class="flex h-8 min-w-64 items-center justify-center gap-2 rounded-t-2xl bg-interface-builder-mode-footer-background px-4 text-sm text-interface-builder-mode-button-foreground"
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
                class="-ml-0.5 h-6 gap-1 rounded-md border-none bg-transparent px-1.5 text-sm text-interface-builder-mode-button-foreground hover:bg-interface-builder-mode-button-background/70"
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
        <PopoverPortal>
          <PopoverContent
            side="top"
            :side-offset="5"
            :collision-padding="10"
            class="z-1700 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm will-change-[transform,opacity]"
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
import { computed } from 'vue'
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'

import { cn } from '@/utils/tailwindUtil'

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
