<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import NavItem from '@/components/widget/nav/NavItem.vue'

type NavSection = 'recent' | 'templates' | 'drafts' | 'project'

interface Project {
  id: string
  name: string
}

const { t } = useI18n()

const activeSection = ref<NavSection>('project')
const selectedProjectId = ref('1')
const projects = ref<Project[]>([
  { id: '1', name: 'Project 01' },
  { id: '2', name: 'Project 02' }
])

const navItems = computed(() => [
  { id: 'recent', icon: 'icon-[lucide--clock]', label: t('homeTab.recent') },
  {
    id: 'templates',
    icon: 'icon-[lucide--layout-template]',
    label: t('homeTab.templates')
  },
  {
    id: 'drafts',
    icon: 'icon-[lucide--file-pen]',
    label: t('homeTab.drafts')
  }
])

const currentTitle = computed(() => {
  if (activeSection.value === 'project') {
    const project = projects.value.find((p) => p.id === selectedProjectId.value)
    return project?.name ?? ''
  }
  return navItems.value.find((item) => item.id === activeSection.value)?.label
})

function selectNav(id: string) {
  activeSection.value = id as NavSection
  selectedProjectId.value = ''
}

function selectProject(id: string) {
  activeSection.value = 'project'
  selectedProjectId.value = id
}
</script>

<template>
  <div class="flex size-full">
    <!-- Left Side Panel -->
    <aside class="flex w-56 flex-col bg-modal-panel-background">
      <!-- Workspace Switcher -->
      <div class="px-3 py-4">
        <button
          class="flex h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-base-foreground hover:bg-interface-menu-component-surface-hovered"
        >
          <div
            class="flex size-6 shrink-0 items-center justify-center rounded-sm bg-brand-blue text-xs font-bold text-white"
          >
            C
          </div>
          <span class="min-w-0 truncate">{{
            $t('homePlaceholder.teamComfy')
          }}</span>
          <i
            class="ml-auto icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </div>

      <!-- Navigation Items -->
      <nav class="flex flex-col px-3 pb-6">
        <NavItem
          v-for="item in navItems"
          :key="item.id"
          :icon="item.icon"
          :active="activeSection === item.id"
          :on-click="() => selectNav(item.id)"
        >
          {{ item.label }}
        </NavItem>
      </nav>

      <!-- Projects Section -->
      <div class="flex flex-col px-3">
        <div class="flex items-center justify-between px-4">
          <span
            class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
          >
            {{ t('homeTab.projects') }}
          </span>
          <Button variant="muted-textonly" size="icon-sm">
            <i class="icon-[lucide--plus] size-4" />
          </Button>
        </div>
        <div class="mt-2 flex flex-col">
          <NavItem
            v-for="project in projects"
            :key="project.id"
            icon="icon-[lucide--folder]"
            :active="
              activeSection === 'project' && selectedProjectId === project.id
            "
            :on-click="() => selectProject(project.id)"
          >
            {{ project.name }}
          </NavItem>
        </div>
      </div>

      <!-- Bottom Pinned -->
      <div class="mt-auto flex flex-col px-3 py-4">
        <NavItem
          icon="icon-[lucide--settings]"
          :active="false"
          :on-click="() => {}"
        >
          {{ t('homeTab.settings') }}
        </NavItem>
        <NavItem
          icon="icon-[lucide--circle-user]"
          :active="false"
          :on-click="() => {}"
        >
          {{ t('homeTab.profile') }}
        </NavItem>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex flex-1 flex-col">
      <!-- Top Bar -->
      <div class="flex items-center justify-between p-4">
        <h1 class="text-base text-base-foreground">
          {{ currentTitle }}
        </h1>
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-10 w-[310px] items-center gap-2 rounded-lg border border-border-default px-4"
          >
            <i
              class="icon-[lucide--search] size-4 shrink-0 text-muted-foreground"
            />
            <input
              type="text"
              :placeholder="t('homeTab.search')"
              class="min-w-0 flex-1 bg-transparent text-sm text-base-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button variant="secondary" class="h-10 gap-1 px-4">
            <i class="icon-[lucide--plus] size-4" />
            {{ t('homeTab.newWorkflow') }}
          </Button>
        </div>
      </div>

      <!-- Empty Content Area -->
      <div class="flex-1" />
    </main>
  </div>
</template>
