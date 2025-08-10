<template>
  <BaseWidgetLayout>
    <template #leftPanel>
      <LeftSidePanel v-model="selectedNavItem" :nav-items="tempNavigation">
        <template #header-icon>
          <i-lucide:puzzle class="text-neutral" />
        </template>
        <template #header-title>
          <span class="text-neutral text-base">{{ t('g.title') }}</span>
        </template>
      </LeftSidePanel>
    </template>

    <template #header>
      <!-- here -->
      <SearchBox v-model:="searchQuery" class="max-w-[384px]" />
    </template>

    <template #content>
      <!-- here -->
    </template>

    <template #rightPanel>
      <RightSidePanel></RightSidePanel>
    </template>
  </BaseWidgetLayout>
</template>

<script setup lang="ts">
import { provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { NavGroupData, NavItemData } from '@/types/custom_components/navTypes'
import { OnCloseKey } from '@/types/custom_components/widgetTypes'

import SearchBox from '../input/SearchBox.vue'
import BaseWidgetLayout from './layout/BaseWidgetLayout.vue'
import LeftSidePanel from './panel/LeftSidePanel.vue'
import RightSidePanel from './panel/RightSidePanel.vue'

const { t } = useI18n()

const { onClose } = defineProps<{
  onClose: () => void
}>()
const searchQuery = ref<string>('')

provide(OnCloseKey, onClose)

const tempNavigation = ref<(NavItemData | NavGroupData)[]>([
  { id: 'installed', label: 'Installed' },
  {
    title: 'TAGS',
    items: [
      { id: 'tag-sd15', label: 'SD 1.5' },
      { id: 'tag-sdxl', label: 'SDXL' },
      { id: 'tag-utility', label: 'Utility' }
    ]
  },
  {
    title: 'CATEGORIES',
    items: [
      { id: 'cat-models', label: 'Models' },
      { id: 'cat-nodes', label: 'Nodes' }
    ]
  }
])

const selectedNavItem = ref<string | null>('installed')
</script>
