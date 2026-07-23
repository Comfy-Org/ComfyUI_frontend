<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import PromptInputButton from '@/components/ai-elements/prompt-input/PromptInputButton.vue'
import { selectContentClass } from '@/components/ui/select/select.variants'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
import { cn } from '@comfyorg/tailwind-utils'

const { disabled = false } = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  addNodesFromGraph: []
  addMediaAssets: []
  attachAssets: []
}>()

const { t } = useI18n()
</script>

<template>
  <DropdownMenuRoot>
    <Tooltip :delay-duration="500">
      <TooltipTrigger>
        <DropdownMenuTrigger as-child>
          <PromptInputButton :aria-label="t('agent.attachMenu.trigger')">
            <i class="icon-[lucide--plus] size-4" />
          </PromptInputButton>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent side="top" class="whitespace-nowrap">
        {{ t('agent.attachMenu.trigger') }}
      </TooltipContent>
    </Tooltip>

    <DropdownMenuPortal>
      <DropdownMenuContent
        side="top"
        align="start"
        :side-offset="8"
        :class="cn(selectContentClass, 'min-w-52 p-1')"
      >
        <DropdownMenuItem
          :disabled="disabled"
          class="flex cursor-pointer items-center gap-2 rounded-md p-2 text-xs text-base-foreground outline-none data-disabled:pointer-events-none data-disabled:text-muted-foreground data-disabled:opacity-50 data-highlighted:bg-secondary-background-hover"
          @select="emit('addNodesFromGraph')"
        >
          <i
            class="icon-[lucide--mouse-pointer-click] size-3 shrink-0 text-muted-foreground"
          />
          {{ t('agent.attachMenu.addNodesFromGraph') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-md p-2 text-xs text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
          @select="emit('addMediaAssets')"
        >
          <i
            class="icon-[comfy--image-ai-edit] size-3 shrink-0 text-muted-foreground"
          />
          {{ t('agent.attachMenu.addMediaAssets') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator class="m-1 h-px bg-border-subtle" />
        <DropdownMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-md p-2 text-xs text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
          @select="emit('attachAssets')"
        >
          <i
            class="icon-[lucide--paperclip] size-3 shrink-0 text-muted-foreground"
          />
          {{ t('agent.attachMenu.attachAssets') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
