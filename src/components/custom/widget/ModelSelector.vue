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
        <IconButton
          size="sm"
          class="!bg-orange-500 text-white"
          @click="console.log('Hello World!!')"
        >
          <i-lucide:triangle-alert />
        </IconButton>
        <IconGroup>
          <IconButton @click="console.log('Hello World!!')">
            <i-lucide:heart />
          </IconButton>
          <IconButton @click="console.log('Hello World!!')">
            <i-lucide:download />
          </IconButton>
          <IconButton @click="console.log('Hello World!!')">
            <i-lucide:external-link />
          </IconButton>
        </IconGroup>
        <TextButton
          label="Action"
          type="primary"
          @click="console.log('Hello World!!')"
        />
        <TextButton
          label="Action"
          type="secondary"
          @click="console.log('Hello World!!')"
        />
        <MoreButton>
          <template #default="{ close }">
            <IconTextButton
              type="secondary"
              label="Settings"
              @click="
                () => {
                  console.log('Settings')
                  close()
                }
              "
            >
              <template #icon>
                <i-lucide:download />
              </template>
            </IconTextButton>
            <IconTextButton
              type="primary"
              label="Profile"
              @click="
                () => {
                  console.log('Profile')
                  close()
                }
              "
            >
              <template #icon>
                <i-lucide:scroll />
              </template>
            </IconTextButton>
          </template>
        </MoreButton>
      </div>
    </template>

    <template #content>
      <div class="px-6 pt-2 pb-4 flex gap-2">
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

      <!-- Card Examples -->
      <div
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 px-6 py-4"
      >
        <CardContainer ratio="tallPortrait">
          <template #top>
            <CardTop ratio="square">
              <template #default>
                <div class="w-full h-full bg-blue-500"></div>
              </template>
              <template #top-right>
                <IconButton
                  class="!bg-white !text-neutral-900"
                  @click="console.log('Hello World!!')"
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

        <CardContainer ratio="portrait">
          <template #top>
            <CardTop ratio="square">
              <div class="w-full h-full bg-red-500"></div>
            </CardTop>
          </template>
          <template #bottom>
            <CardBottom></CardBottom>
          </template>
        </CardContainer>

        <CardContainer ratio="square">
          <template #top>
            <CardTop ratio="landscape">
              <div class="w-full h-full bg-red-500"></div>
            </CardTop>
          </template>
          <template #bottom>
            <CardBottom class="p-2 flex flex-col gap-2">
              <CardTitle>{{ t('manager.nodePack') }}</CardTitle>
              <CardDescription>{{
                t('manager.noNodesFoundDescription')
              }}</CardDescription>
            </CardBottom>
          </template>
        </CardContainer>
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
import MoreButton from '../button/MoreButton.vue'
import TextButton from '../button/TextButton.vue'
import CardBottom from '../card/CardBottom.vue'
import CardContainer from '../card/CardContainer.vue'
import CardDescription from '../card/CardDescription.vue'
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
