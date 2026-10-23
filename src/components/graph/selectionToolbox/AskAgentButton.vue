<template>
  <Button
    :tooltip="t('agent.askAgent')"
    data-testid="ask-agent-button"
    variant="muted-textonly"
    :aria-label="t('agent.askAgent')"
    @click="onClick"
  >
    <i class="icon-[lucide--astroid] size-4" />
    <Badge
      v-if="showToolbarDot"
      variant="dot"
      severity="default"
      class="absolute top-1 right-1"
      data-testid="ask-agent-new-dot"
      aria-hidden="true"
    />
  </Button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { referenceNodesInAgent } from '@/components/graph/referenceNodesInAgent'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAskAgentNewBadges } from '@/composables/graph/useAskAgentNewBadges'
import { useSelectionState } from '@/composables/graph/useSelectionState'

const { t } = useI18n()
const { selectedNodes } = useSelectionState()
const { showToolbarDot, markToolbarSeen } = useAskAgentNewBadges()

const onClick = () => {
  markToolbarSeen()
  referenceNodesInAgent(selectedNodes.value.map((node) => node.id))
}
</script>
