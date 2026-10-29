<template>
  <div class="flex w-full items-center justify-between gap-2 border-b p-2">
    <div class="flex items-center gap-2">
      <i class="icon-[lucide--square-dashed]" />
      <h3 class="m-0 text-sm font-semibold">
        {{ $t('boundingBoxes.editorTitle') }}
      </h3>
    </div>
    <div class="flex items-center gap-2">
      <div
        :id="BOUNDING_BOXES_HEADER_ACTIONS_ID"
        class="flex items-center gap-2"
        role="group"
      />
      <DialogClose :aria-label="$t('g.close')">
        <Button variant="outline" size="md">
          {{ $t('g.close') }}
          <i class="icon-[lucide--x]" />
        </Button>
      </DialogClose>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BOUNDING_BOXES_HEADER_ACTIONS_ID } from '@/components/boundingBoxes/boundingBoxesHeaderActionsId'
import Button from '@comfyorg/design-system/button/Button'
import DialogClose from '@comfyorg/design-system/dialog/DialogClose'
</script>
