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
      <SearchBox v-model:="searchQuery" class="max-w-[384px]" />
    </template>

    <template #header-right-area>
      <div class="flex gap-2">
        <IconTextButton type="primary" label="Upload Model" @click="() => {}">
          <template #icon>
            <i-lucide:upload />
          </template>
        </IconTextButton>
      </div>
    </template>

    <template #contentFilter>
      <div class="relative px-6 pt-2 pb-4 flex gap-2">
        <MultiSelect
          v-model="selectedFrameworks"
          label="Select Frameworks"
          :options="frameworkOptions"
        />
        <MultiSelect
          v-model="selectedProjects"
          label="Select Projects"
          :options="projectOptions"
        />
      </div>
    </template>

    <template #content>
      <!-- Card Examples -->
      <div class="min-h-0 px-6 py-4 overflow-y-auto scrollbar-hide">
        <h2 class="text-xxl py-4 pt-0 m-0">{{ $t('Checkpoints') }}</h2>
        <div class="flex flex-wrap gap-2">
          <CardContainer
            v-for="i in 100"
            :key="i"
            ratio="square"
            :max-width="480"
            :min-width="230"
          >
            <template #top>
              <CardTop ratio="landscape">
                <template #default>
                  <div class="w-full h-full bg-blue-500"></div>
                </template>
                <template #top-right>
                  <IconButton
                    class="!bg-white !text-neutral-900"
                    @click="() => {}"
                  >
                    <i-lucide:info />
                  </IconButton>
                </template>
                <template #bottom-right>
                  <SquareTag label="png" />
                  <SquareTag label="1.2 MB" />
                  <SquareTag label="LoRA">
                    <template #icon>
                      <i-lucide:folder />
                    </template>
                  </SquareTag>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom></CardBottom>
            </template>
          </CardContainer>
        </div>
      </div>
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

import SquareTag from '../SquareTag.vue'
import IconButton from '../button/IconButton.vue'
import IconTextButton from '../button/IconTextButton.vue'
import CardBottom from '../card/CardBottom.vue'
import CardContainer from '../card/CardContainer.vue'
import CardTop from '../card/CardTop.vue'
import MultiSelect from '../input/MultiSelect.vue'
import SearchBox from '../input/SearchBox.vue'
import BaseWidgetLayout from './layout/BaseWidgetLayout.vue'
import LeftSidePanel from './panel/LeftSidePanel.vue'
import RightSidePanel from './panel/RightSidePanel.vue'

const frameworkOptions = ref([
  { name: 'Vue', value: 'vue' },
  { name: 'React', value: 'react' },
  { name: 'Angular', value: 'angular' },
  { name: 'Svelte', value: 'svelte' }
])

const projectOptions = ref([
  { name: 'Project A', value: 'proj-a' },
  { name: 'Project B', value: 'proj-b' },
  { name: 'Project C', value: 'proj-c' }
])

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

const { t } = useI18n()

const { onClose } = defineProps<{
  onClose: () => void
}>()

provide(OnCloseKey, onClose)

const searchQuery = ref<string>('')
const selectedFrameworks = ref([])
const selectedProjects = ref([])

const selectedNavItem = ref<string | null>('installed')
</script>
