<template>
  <div class="@container flex min-h-0 flex-1 flex-col gap-4">
    <!-- TODO(DES-503): models governance adds a Models sub-tab strip here;
    prototype in PR #13487 -->
    <div
      class="flex w-full flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-9"
    >
      <span class="min-w-0 flex-1 text-sm font-medium">
        {{ $t('workspacePanel.allowlist.tabs.partnerNodes') }}
      </span>
      <SearchInput
        v-model="searchQuery"
        :placeholder="$t('workspacePanel.partnerNodes.searchPlaceholder')"
        size="lg"
        class="w-full @2xl:w-64"
      />
    </div>

    <PartnerNodesPanelContent :search="searchQuery" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import PartnerNodesPanelContent from '@/platform/workspace/components/dialogs/settings/PartnerNodesPanelContent.vue'

const searchQuery = ref('')
</script>
