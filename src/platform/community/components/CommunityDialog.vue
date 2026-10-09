<script setup lang="ts">
import { provide, ref } from 'vue'

import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import CloudNodeRegistryDialog from '@/platform/customNodes/components/CloudNodeRegistryDialog.vue'
import TestWorkflowLibraryDialog from '@/platform/workflow/library/components/TestWorkflowLibraryDialog.vue'
import { createCommunityWorkflowRequest } from '@/platform/community/services/communityWorkflowProvider'
import { OnCloseKey } from '@/types/widgetTypes'
import { api } from '@/scripts/api'

const { initialSection = 'packs', onClose = () => {} } = defineProps<{
  initialSection?: 'packs' | 'workflows'
  onClose?: () => void
}>()
const section = ref(initialSection)
const fetchLibrary =
  import.meta.env.VITE_COMMUNITY_WORKFLOW_SOURCE === 'service'
    ? (route: string, options?: RequestInit) => api.fetchApi(route, options)
    : createCommunityWorkflowRequest()
provide(OnCloseKey, onClose)
</script>

<template>
  <div class="flex size-full flex-col bg-base-background">
    <header
      class="flex shrink-0 items-center gap-6 border-b border-border-default px-6 py-3"
    >
      <h1 class="m-0 text-base font-semibold">{{ $t('community.title') }}</h1>
      <TabList v-model="section">
        <Tab value="packs">{{ $t('community.packs') }}</Tab>
        <Tab value="workflows">{{ $t('community.workflows') }}</Tab>
      </TabList>
    </header>
    <div class="min-h-0 flex-1">
      <KeepAlive>
        <CloudNodeRegistryDialog
          v-if="section === 'packs'"
          size="full"
          community
          :on-close
        />
        <TestWorkflowLibraryDialog
          v-else
          size="full"
          :fetch-library
          @close="onClose"
        />
      </KeepAlive>
    </div>
  </div>
</template>
