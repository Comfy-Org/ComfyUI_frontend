<template>
  <Button
    :tooltip="t('agent.askAgent')"
    data-testid="ask-agent-button"
    variant="muted-textonly"
    :aria-label="t('agent.askAgent')"
    @click="onClick"
  >
    <i class="icon-[lucide--astroid] size-4" />
  </Button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { referenceNodesInAgent } from '@/composables/graph/referenceNodesInAgent'
import { useSelectionState } from '@/composables/graph/useSelectionState'

const { t } = useI18n()
const { selectedNodes } = useSelectionState()

const onClick = () => {
  referenceNodesInAgent(selectedNodes.value.map((node) => node.id))
}
</script>
