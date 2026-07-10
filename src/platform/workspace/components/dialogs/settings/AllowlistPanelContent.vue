<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex items-center gap-2">
      <Button
        v-for="tab in tabs"
        :key="tab.key"
        :variant="activeView === tab.key ? 'secondary' : 'muted-textonly'"
        size="lg"
        @click="activeView = tab.key"
      >
        {{ tab.label }}
      </Button>
    </div>

    <PartnerNodesPanelContent v-if="activeView === 'partnerNodes'" />
    <ModelsPanelContent v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import ModelsPanelContent from '@/platform/workspace/components/dialogs/settings/ModelsPanelContent.vue'
import PartnerNodesPanelContent from '@/platform/workspace/components/dialogs/settings/PartnerNodesPanelContent.vue'

type View = 'partnerNodes' | 'models'

const { t } = useI18n()

const tabs = computed<{ key: View; label: string }[]>(() => [
  {
    key: 'partnerNodes',
    label: t('workspacePanel.allowlist.tabs.partnerNodes')
  },
  { key: 'models', label: t('workspacePanel.allowlist.tabs.models') }
])
const activeView = ref<View>('partnerNodes')
</script>
