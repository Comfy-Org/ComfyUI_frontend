<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

import {
  inlineReferenceRemoveAnchorClass,
  inlineReferenceRemoveBadgeClass,
  inlineReferenceRemoveButtonClass
} from './inlineReferenceChipStyles'

const { label } = defineProps<{ label: string }>()
const emit = defineEmits<{ remove: [] }>()

defineOptions({ inheritAttrs: false })
</script>

<template>
  <span :class="inlineReferenceRemoveAnchorClass">
    <Button
      type="button"
      variant="textonly"
      size="icon-sm"
      :aria-label="label"
      :class="inlineReferenceRemoveButtonClass"
      v-bind="$attrs"
      @click.stop="emit('remove')"
    >
      <span :class="inlineReferenceRemoveBadgeClass">
        <i aria-hidden="true" class="icon-[lucide--x] size-2" />
      </span>
    </Button>
  </span>
</template>
