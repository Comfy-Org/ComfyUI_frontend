<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

const emit = defineEmits<{ click: [] }>()

const { t } = useI18n()
</script>

<template>
  <Button
    variant="inverted"
    :tooltip="t('agent.nodeAsk.button')"
    :aria-label="t('agent.nodeAsk.button')"
    data-testid="selection-toolbox-ask-agent"
    @click="emit('click')"
  >
    <i aria-hidden="true" class="icon-[lucide--astroid]" />
  </Button>
</template>
