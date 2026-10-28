<template>
  <div class="inline-flex items-center">
    <PopoverRoot v-slot="{ close }">
      <PopoverTrigger as-child>
        <Button
          :tooltip="$t('sideToolbar.mediaAssets.viewSettings')"
          variant="secondary"
          size="icon"
          :aria-label="$t('sideToolbar.mediaAssets.viewSettings')"
        >
          <i class="icon-[lucide--settings-2]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        :side-offset="5"
        dismiss-on-viewport-change
        class="w-auto overflow-visible rounded-lg border-border/50 p-2 shadow-sm"
      >
        <slot :close />
        <PopoverArrow class="fill-background stroke-border/50" />
      </PopoverContent>
    </PopoverRoot>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'
</script>
