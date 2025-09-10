import type { Meta, StoryObj } from '@storybook/vue3-vite'
import {
  Download,
  Filter,
  Folder,
  Info,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Puzzle,
  Scroll,
  Settings,
  Upload,
  X
} from 'lucide-vue-next'
import { h, provide, ref } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import IconTextButton from '@/components/button/IconTextButton.vue'
import MoreButton from '@/components/button/MoreButton.vue'
import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import MultiSelect from '@/components/input/MultiSelect.vue'
import SearchBox from '@/components/input/SearchBox.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'

import LeftSidePanel from '../panel/LeftSidePanel.vue'
import RightSidePanel from '../panel/RightSidePanel.vue'
import BaseWidgetLayout from './BaseWidgetLayout.vue'

interface StoryArgs {
  contentTitle: string
  hasLeftPanel: boolean
  hasRightPanel: boolean
  hasHeader: boolean
  hasContentFilter: boolean
  hasHeaderRightArea: boolean
  cardCount: number
}

const meta: Meta<StoryArgs> = {
  title: 'Components/Widget/Layout/BaseWidgetLayout',
  argTypes: {
    contentTitle: {
      control: 'text',
      description: 'Title shown when no left panel is present'
    },
    hasLeftPanel: {
      control: 'boolean',
      description: 'Toggle left panel visibility'
    },
    hasRightPanel: {
      control: 'boolean',
      description: 'Toggle right panel visibility'
    },
    hasHeader: {
      control: 'boolean',
      description: 'Toggle header visibility'
    },
    hasContentFilter: {
      control: 'boolean',
      description: 'Toggle content filter visibility'
    },
    hasHeaderRightArea: {
      control: 'boolean',
      description: 'Toggle header right area visibility'
    },
    cardCount: {
      control: { type: 'range', min: 0, max: 50, step: 1 },
      description: 'Number of cards to display in content'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

const createStoryTemplate = (args: StoryArgs) => ({
  components: {
    BaseWidgetLayout,
    LeftSidePanel,
    RightSidePanel,
    SearchBox,
    MultiSelect,
    SingleSelect,
    IconButton,
    IconTextButton,
    MoreButton,
    CardContainer,
    CardTop,
    CardBottom,
    SquareChip,
    Settings,
    Upload,
    Download,
    Scroll,
    Info,
    Filter,
    Folder,
    Puzzle,
    PanelLeft,
    PanelLeftClose,
    PanelRight,
    PanelRightClose,
    X
  },
  setup() {
    const t = (k: string) => k

    const onClose = () => {
      console.log('OnClose invoked')
    }
    provide(OnCloseKey, onClose)

    const tempNavigation = ref<(NavItemData | NavGroupData)[]>([
      {
        id: 'installed',
        label: 'Installed',
        icon: { render: () => h(Folder, { size: 14 }) } as any
      },
      {
        title: 'TAGS',
        items: [
          {
            id: 'tag-sd15',
            label: 'SD 1.5',
            icon: { render: () => h(Folder, { size: 14 }) } as any
          },
          {
            id: 'tag-sdxl',
            label: 'SDXL',
            icon: { render: () => h(Folder, { size: 14 }) } as any
          },
          {
            id: 'tag-utility',
            label: 'Utility',
            icon: { render: () => h(Folder, { size: 14 }) } as any
          }
        ]
      },
      {
        title: 'CATEGORIES',
        items: [
          {
            id: 'cat-models',
            label: 'Models',
            icon: { render: () => h(Folder, { size: 14 }) } as any
          },
          {
            id: 'cat-nodes',
            label: 'Nodes',
            icon: { render: () => h(Folder, { size: 14 }) } as any
          }
        ]
      }
    ])
    const selectedNavItem = ref<string | null>('installed')

    const searchQuery = ref<string>('')

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
    const sortOptions = ref([
      { name: 'Popular', value: 'popular' },
      { name: 'Latest', value: 'latest' },
      { name: 'A → Z', value: 'az' }
    ])

    const selectedFrameworks = ref<string[]>([])
    const selectedProjects = ref<string[]>([])
    const selectedSort = ref<string>('popular')

    return {
      args,
      t,
      tempNavigation,
      selectedNavItem,
      searchQuery,
      frameworkOptions,
      projectOptions,
      sortOptions,
      selectedFrameworks,
      selectedProjects,
      selectedSort
    }
  },
  template: `
    <div>
      <BaseWidgetLayout v-if="!args.hasRightPanel" :content-title="args.contentTitle || 'Content Title'">
        <!-- Left Panel -->
        <template v-if="args.hasLeftPanel" #leftPanel>
          <LeftSidePanel v-model="selectedNavItem" :nav-items="tempNavigation">
            <template #header-icon>
              <Puzzle :size="16" class="text-neutral" />
            </template>
            <template #header-title>
              <span class="text-neutral text-base">Title</span>
            </template>
          </LeftSidePanel>
        </template>

        <!-- Header -->
        <template v-if="args.hasHeader" #header>
          <SearchBox
            class="max-w-[384px]"
            :modelValue="searchQuery"
            @update:modelValue="searchQuery = $event"
          />
        </template>

        <!-- Header Right Area -->
        <template v-if="args.hasHeaderRightArea" #header-right-area>
          <div class="flex gap-2">
            <IconTextButton type="primary" label="Upload Model" @click="() => {}">
              <template #icon>
                <Upload :size="12" />
              </template>
            </IconTextButton>

            <MoreButton>
              <template #default="{ close }">
                <IconTextButton
                  type="secondary"
                  label="Settings"
                  @click="() => { close() }"
                >
                  <template #icon>
                    <Download :size="12" />
                  </template>
                </IconTextButton>

                <IconTextButton
                  type="primary"
                  label="Profile"
                  @click="() => { close() }"
                >
                  <template #icon>
                    <Scroll :size="12" />
                  </template>
                </IconTextButton>
              </template>
            </MoreButton>
          </div>
        </template>

        <!-- Content Filter -->
        <template v-if="args.hasContentFilter" #contentFilter>
          <div class="relative px-6 pt-2 pb-4 flex gap-2">
            <MultiSelect
              v-model="selectedFrameworks"
              label="Select Frameworks"
              :options="frameworkOptions"
              :has-search-box="true"
              :show-selected-count="true"
              :has-clear-button="true"
            />
            <MultiSelect
              v-model="selectedProjects"
              label="Select Projects"
              :options="projectOptions"
            />
            <SingleSelect
              v-model="selectedSort"
              label="Sorting Type"
              :options="sortOptions"
              class="w-[135px]"
            >
              <template #icon>
                <Filter :size="12" />
              </template>
            </SingleSelect>
          </div>
        </template>

        <!-- Content -->
        <template #content>
          <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(230px, 1fr))">
            <CardContainer
              v-for="i in args.cardCount"
              :key="i"
              ratio="square"
            >
              <template #top>
                <CardTop ratio="landscape">
                  <template #default>
                    <div class="w-full h-full bg-blue-500"></div>
                  </template>
                  <template #top-right>
                    <IconButton class="!bg-white !text-neutral-900" @click="() => {}">
                      <Info :size="16" />
                    </IconButton>
                  </template>
                  <template #bottom-right>
                    <SquareChip label="png" />
                    <SquareChip label="1.2 MB" />
                    <SquareChip label="LoRA">
                      <template #icon>
                        <Folder :size="12" />
                      </template>
                    </SquareChip>
                  </template>
                </CardTop>
              </template>
              <template #bottom>
                <CardBottom />
              </template>
            </CardContainer>
          </div>
        </template>
      </BaseWidgetLayout>

      <BaseWidgetLayout v-else :content-title="args.contentTitle || 'Content Title'">
        <!-- Same content but WITH right panel -->
        <!-- Left Panel -->
        <template v-if="args.hasLeftPanel" #leftPanel>
          <LeftSidePanel v-model="selectedNavItem" :nav-items="tempNavigation">
            <template #header-icon>
              <Puzzle :size="16" class="text-neutral" />
            </template>
            <template #header-title>
              <span class="text-neutral text-base">Title</span>
            </template>
          </LeftSidePanel>
        </template>

        <!-- Header -->
        <template v-if="args.hasHeader" #header>
          <SearchBox
            class="max-w-[384px]"
            :modelValue="searchQuery"
            @update:modelValue="searchQuery = $event"
          />
        </template>

        <!-- Header Right Area -->
        <template v-if="args.hasHeaderRightArea" #header-right-area>
          <div class="flex gap-2">
            <IconTextButton type="primary" label="Upload Model" @click="() => {}">
              <template #icon>
                <Upload :size="12" />
              </template>
            </IconTextButton>

            <MoreButton>
              <template #default="{ close }">
                <IconTextButton
                  type="secondary"
                  label="Settings"
                  @click="() => { close() }"
                >
                  <template #icon>
                    <Download :size="12" />
                  </template>
                </IconTextButton>

                <IconTextButton
                  type="primary"
                  label="Profile"
                  @click="() => { close() }"
                >
                  <template #icon>
                    <Scroll :size="12" />
                  </template>
                </IconTextButton>
              </template>
            </MoreButton>
          </div>
        </template>

        <!-- Content Filter -->
        <template v-if="args.hasContentFilter" #contentFilter>
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
            <SingleSelect
              v-model="selectedSort"
              label="Sorting Type"
              :options="sortOptions"
              class="w-[135px]"
            >
              <template #icon>
                <Filter :size="12" />
              </template>
            </SingleSelect>
          </div>
        </template>

        <!-- Content -->
        <template #content>
          <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(230px, 1fr))">
            <CardContainer
              v-for="i in args.cardCount"
              :key="i"
              ratio="square"
            >
              <template #top>
                <CardTop ratio="landscape">
                  <template #default>
                    <div class="w-full h-full bg-blue-500"></div>
                  </template>
                  <template #top-right>
                    <IconButton class="!bg-white !text-neutral-900" @click="() => {}">
                      <Info :size="16" />
                    </IconButton>
                  </template>
                  <template #bottom-right>
                    <SquareChip label="png" />
                    <SquareChip label="1.2 MB" />
                    <SquareChip label="LoRA">
                      <template #icon>
                        <Folder :size="12" />
                      </template>
                    </SquareChip>
                  </template>
                </CardTop>
              </template>
              <template #bottom>
                <CardBottom />
              </template>
            </CardContainer>
          </div>
        </template>

        <!-- Right Panel - Only when hasRightPanel is true -->
        <template #rightPanel>
          <RightSidePanel />
        </template>
      </BaseWidgetLayout>
    </div>
  `
})

export const Default: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Content Title',
    hasLeftPanel: true,
    hasRightPanel: true,
    hasHeader: true,
    hasContentFilter: true,
    hasHeaderRightArea: true,
    cardCount: 12
  }
}

export const BothPanels: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Content Title',
    hasLeftPanel: true,
    hasRightPanel: true,
    hasHeader: true,
    hasContentFilter: true,
    hasHeaderRightArea: true,
    cardCount: 12
  }
}

export const LeftPanelOnly: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Content Title',
    hasLeftPanel: true,
    hasRightPanel: false,
    hasHeader: true,
    hasContentFilter: true,
    hasHeaderRightArea: true,
    cardCount: 12
  }
}

export const RightPanelOnly: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Content Title',
    hasLeftPanel: false,
    hasRightPanel: true,
    hasHeader: true,
    hasContentFilter: true,
    hasHeaderRightArea: true,
    cardCount: 12
  }
}

export const NoPanels: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Content Title',
    hasLeftPanel: false,
    hasRightPanel: false,
    hasHeader: true,
    hasContentFilter: true,
    hasHeaderRightArea: true,
    cardCount: 12
  }
}

export const MinimalLayout: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Simple Content',
    hasLeftPanel: false,
    hasRightPanel: false,
    hasHeader: false,
    hasContentFilter: false,
    hasHeaderRightArea: false,
    cardCount: 6
  }
}

export const NoContent: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Empty State',
    hasLeftPanel: true,
    hasRightPanel: true,
    hasHeader: true,
    hasContentFilter: true,
    hasHeaderRightArea: true,
    cardCount: 0
  }
}

export const HeaderOnly: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Header Layout',
    hasLeftPanel: false,
    hasRightPanel: false,
    hasHeader: true,
    hasContentFilter: false,
    hasHeaderRightArea: true,
    cardCount: 8
  }
}

export const FilterOnly: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Filter Layout',
    hasLeftPanel: false,
    hasRightPanel: false,
    hasHeader: false,
    hasContentFilter: true,
    hasHeaderRightArea: false,
    cardCount: 8
  }
}

export const MaxContent: Story = {
  render: (args: StoryArgs) => createStoryTemplate(args),
  args: {
    contentTitle: 'Full Content',
    hasLeftPanel: true,
    hasRightPanel: true,
    hasHeader: true,
    hasContentFilter: true,
    hasHeaderRightArea: true,
    cardCount: 50
  }
}
