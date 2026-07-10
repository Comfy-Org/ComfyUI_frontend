<template>
  <div class="@container flex min-h-0 flex-1 flex-col gap-4">
    <div
      class="flex w-full flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-9"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Button
          v-for="tab in tabs"
          :key="tab.key"
          :variant="activeView === tab.key ? 'secondary' : 'muted-textonly'"
          size="lg"
          @click="setView(tab.key)"
        >
          {{ tab.label }}
        </Button>
      </div>
      <SearchInput
        v-model="searchQuery"
        :placeholder="searchPlaceholder"
        size="lg"
        class="w-full @2xl:w-64"
      />
    </div>

    <PartnerNodesPanelContent
      v-if="activeView === 'partnerNodes'"
      :search="searchQuery"
    />
    <ModelsPanelContent v-else :search="searchQuery" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
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
const searchQuery = ref('')

const searchPlaceholder = computed(() =>
  activeView.value === 'partnerNodes'
    ? t('workspacePanel.partnerNodes.searchPlaceholder')
    : t('workspacePanel.models.searchPlaceholder')
)

function setView(view: View) {
  activeView.value = view
  searchQuery.value = ''
}
</script>
