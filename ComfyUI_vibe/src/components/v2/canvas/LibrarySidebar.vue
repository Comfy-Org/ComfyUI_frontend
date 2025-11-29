<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import AvatarGroup from 'primevue/avatargroup'
import { SidebarSearchBox, SidebarViewToggle } from '@/components/common/sidebar'
import LibraryBrandKitSection from '@/components/v1/sidebar/LibraryBrandKitSection.vue'
import LibraryWorkflowsSection from '@/components/v1/sidebar/LibraryWorkflowsSection.vue'
import LibraryModelsSection from '@/components/v1/sidebar/LibraryModelsSection.vue'
import LibraryNodesSection from '@/components/v1/sidebar/LibraryNodesSection.vue'
import {
  TEAM_MEMBERS_DATA,
  BRAND_ASSETS_DATA,
  createSharedWorkflowsData,
  createTeamModelsData,
  NODE_PACKS_DATA,
} from '@/data/sidebarMockData'

const props = defineProps<{
  teamName?: string
  teamLogo?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const searchQuery = ref('')
const viewMode = ref<'list' | 'grid'>('list')
const sortBy = ref('name')
const showFilterMenu = ref(false)
const showSortMenu = ref(false)
const activeFilter = ref('All')

const sortOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Recently Added', value: 'recent' },
  { label: 'Author', value: 'author' },
]

const filterOptions = ['All', 'Brand Kit', 'Workflows', 'Models', 'Nodes']

function setSort(value: string): void {
  sortBy.value = value
  showSortMenu.value = false
}

function setFilter(value: string): void {
  activeFilter.value = value
  showFilterMenu.value = false
}

// Current team info
const currentTeam = computed(() => ({
  name: props.teamName || 'Netflix',
  logo: props.teamLogo,
  plan: 'Enterprise',
  members: 24,
}))

// Collapsible sections
const sections = ref({
  brand: true,
  workflows: true,
  models: false,
  nodes: false,
})

function toggleSection(sectionId: keyof typeof sections.value): void {
  sections.value[sectionId] = !sections.value[sectionId]
}

// Data
const teamMembers = TEAM_MEMBERS_DATA
const brandAssets = BRAND_ASSETS_DATA
const sharedWorkflows = computed(() => createSharedWorkflowsData(teamMembers))
const teamModels = computed(() => createTeamModelsData(teamMembers))
const nodePacks = NODE_PACKS_DATA

const filteredWorkflows = computed(() => {
  if (!searchQuery.value) return sharedWorkflows.value
  const query = searchQuery.value.toLowerCase()
  return sharedWorkflows.value.filter(
    w => w.name.toLowerCase().includes(query) || w.description.toLowerCase().includes(query)
  )
})
</script>

<template>
  <div class="flex h-full w-80 flex-col">
    <!-- Panel Header -->
    <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        TEAM LIBRARY
      </span>
      <Button
        icon="pi pi-times"
        text
        severity="secondary"
        size="small"
        class="!h-6 !w-6"
        @click="emit('close')"
      />
    </div>

    <!-- Search & Controls -->
    <div class="border-b border-zinc-800 p-2">
      <SidebarSearchBox
        v-model="searchQuery"
        placeholder="Search library..."
        :show-action="true"
        action-tooltip="Manage Library"
        action-icon="pi pi-cog"
      />

      <!-- View Controls -->
      <div class="mt-2 flex items-center justify-between">
        <SidebarViewToggle v-model="viewMode" />

        <!-- Filter & Sort -->
        <div class="flex items-center gap-1">
          <!-- Filter Dropdown -->
          <div class="relative">
            <button
              class="flex h-6 items-center gap-1 rounded bg-zinc-800 px-2 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              @click="showFilterMenu = !showFilterMenu"
            >
              <i class="pi pi-filter text-[10px]" />
              <span>{{ activeFilter }}</span>
              <i class="pi pi-chevron-down text-[8px]" />
            </button>
            <div
              v-if="showFilterMenu"
              class="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
            >
              <button
                v-for="option in filterOptions"
                :key="option"
                class="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors"
                :class="activeFilter === option ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
                @click="setFilter(option)"
              >
                {{ option }}
              </button>
            </div>
          </div>

          <!-- Sort Dropdown -->
          <div class="relative">
            <button
              class="flex h-6 items-center gap-1 rounded bg-zinc-800 px-2 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              @click="showSortMenu = !showSortMenu"
            >
              <i class="pi pi-sort-alt text-[10px]" />
              <span>{{ sortOptions.find(o => o.value === sortBy)?.label }}</span>
              <i class="pi pi-chevron-down text-[8px]" />
            </button>
            <div
              v-if="showSortMenu"
              class="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
            >
              <button
                v-for="option in sortOptions"
                :key="option.value"
                class="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors"
                :class="sortBy === option.value ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
                @click="setSort(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-2">
      <!-- Team Header Card -->
      <div class="mb-3 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg font-bold"
            :style="{ backgroundColor: '#E50914' }"
          >
            <span class="text-white">N</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-semibold text-zinc-100">{{ currentTeam.name }}</span>
              <span class="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                {{ currentTeam.plan }}
              </span>
            </div>
            <div class="mt-0.5 flex items-center gap-2">
              <AvatarGroup class="!gap-0">
                <Avatar
                  v-for="member in teamMembers.slice(0, 3)"
                  :key="member.name"
                  :label="member.initials"
                  shape="circle"
                  size="small"
                  class="!h-5 !w-5 !border !border-zinc-900 !bg-zinc-700 !text-[9px] !text-zinc-300"
                />
              </AvatarGroup>
              <span class="text-[10px] text-zinc-500">
                {{ currentTeam.members }} members
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- List View -->
      <div v-if="viewMode === 'list'" class="select-none space-y-0.5">
        <LibraryBrandKitSection
          :assets="brandAssets"
          :view-mode="viewMode"
          :expanded="sections.brand"
          @toggle="toggleSection('brand')"
        />
        <LibraryWorkflowsSection
          :workflows="filteredWorkflows"
          :view-mode="viewMode"
          :expanded="sections.workflows"
          @toggle="toggleSection('workflows')"
        />
        <LibraryModelsSection
          :models="teamModels"
          :view-mode="viewMode"
          :expanded="sections.models"
          @toggle="toggleSection('models')"
        />
        <LibraryNodesSection
          :packs="nodePacks"
          :view-mode="viewMode"
          :expanded="sections.nodes"
          @toggle="toggleSection('nodes')"
        />
      </div>

      <!-- Grid View -->
      <div v-else class="space-y-3">
        <LibraryBrandKitSection :assets="brandAssets" :view-mode="viewMode" :expanded="true" />
        <LibraryWorkflowsSection :workflows="filteredWorkflows" :view-mode="viewMode" :expanded="true" />
        <LibraryModelsSection :models="teamModels" :view-mode="viewMode" :expanded="true" />
        <LibraryNodesSection :packs="nodePacks" :view-mode="viewMode" :expanded="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
div::-webkit-scrollbar {
  width: 4px;
}

div::-webkit-scrollbar-track {
  background: transparent;
}

div::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 2px;
}

div::-webkit-scrollbar-thumb:hover {
  background: #52525b;
}
</style>
