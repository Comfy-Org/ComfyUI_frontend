<template>
  <Button
    :variant="isOpen ? 'primary' : 'secondary'"
    size="md"
    class="px-3 text-sm font-semibold"
    :aria-label="$t('discover.share.share')"
    :aria-pressed="isOpen"
    @click="handleClick"
  >
    {{ $t('discover.share.share') }}
  </Button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useSharePanelStore } from '@/stores/workspace/sharePanelStore'

const { t } = useI18n()
const workflowStore = useWorkflowStore()
const sharePanelStore = useSharePanelStore()
const toastStore = useToastStore()

const { isOpen } = storeToRefs(sharePanelStore)

function handleClick() {
  if (!workflowStore.activeWorkflow) {
    toastStore.addAlert(t('discover.share.noActiveWorkflow'))
    return
  }
  sharePanelStore.togglePanel()
}
</script>
