<template>
  <Button
    variant="inverted"
    size="lg"
    as="a"
    :href="platformLink(path)"
    target="_blank"
    rel="noopener noreferrer"
  >
    {{ $t('buildCustomNodes.fixOnPlatform') }}
    <i class="icon-[lucide--square-arrow-out-up-right]" aria-hidden="true" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

import { platformLink } from '@/platform/workspace/utils/platformLink'

const { path } = defineProps<{
  path: `/${string}`
}>()
</script>
