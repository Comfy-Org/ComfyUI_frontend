<script setup lang="ts">
import type { DialogPortalProps } from 'reka-ui'
import { injectDialogRootContext } from 'reka-ui'

import OverlayPortal from '@comfyorg/design-system/OverlayPortal'

const props = defineProps<DialogPortalProps>()
const { open } = injectDialogRootContext()
</script>

<template>
  <OverlayPortal v-bind="props" :open>
    <slot />
  </OverlayPortal>
</template>
