import type { Meta, StoryObj } from '@storybook/vue3-vite'
import {
  BarChart3,
  Bell,
  BookOpen,
  FolderOpen,
  GraduationCap,
  Home,
  LogOut,
  MessageSquare,
  Settings,
  User,
  Users
} from 'lucide-vue-next'
import { ref } from 'vue'

import LeftSidePanel from '../panel/LeftSidePanel.vue'
import NavItem from './NavItem.vue'
import NavTitle from './NavTitle.vue'

const meta: Meta = {
  title: 'Components/Widget/Navigation',
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

export const NavigationItem: Story = {
  render: () => ({
    components: { NavItem },
    template: `
      <div class="space-y-2">
        <NavItem>Dashboard</NavItem>
        <NavItem>Projects</NavItem>
        <NavItem>Messages</NavItem>
        <NavItem>Settings</NavItem>
      </div>
    `
  })
}

export const CompleteNavigation: Story = {
  render: () => ({
    components: {
      NavTitle,
      NavItem,
      Home,
      FolderOpen,
      BarChart3,
      Users,
      BookOpen,
      GraduationCap,
      MessageSquare,
      Settings,
      User,
      Bell,
      LogOut
    },
    template: `
      <nav class="w-64 p-4 bg-gray-50 rounded-lg">
        <NavTitle>Main Menu</NavTitle>
        <div class="mt-4 space-y-2">
          <NavItem :hasFolderIcon="false"><Home :size="16" class="inline mr-2" />Dashboard</NavItem>
          <NavItem :hasFolderIcon="false"><FolderOpen :size="16" class="inline mr-2" />Projects</NavItem>
          <NavItem :hasFolderIcon="false"><BarChart3 :size="16" class="inline mr-2" />Analytics</NavItem>
          <NavItem :hasFolderIcon="false"><Users :size="16" class="inline mr-2" />Team</NavItem>
        </div>
        <div class="mt-6">
          <NavTitle>Resources</NavTitle>
          <div class="mt-4 space-y-2">
            <NavItem :hasFolderIcon="false"><BookOpen :size="16" class="inline mr-2" />Documentation</NavItem>
            <NavItem :hasFolderIcon="false"><GraduationCap :size="16" class="inline mr-2" />Tutorials</NavItem>
            <NavItem :hasFolderIcon="false"><MessageSquare :size="16" class="inline mr-2" />Community</NavItem>
          </div>
        </div>
        <div class="mt-6">
          <NavTitle>Account</NavTitle>
          <div class="mt-4 space-y-2">
            <NavItem :hasFolderIcon="false"><Settings :size="16" class="inline mr-2" />Settings</NavItem>
            <NavItem :hasFolderIcon="false"><User :size="16" class="inline mr-2" />Profile</NavItem>
            <NavItem :hasFolderIcon="false"><Bell :size="16" class="inline mr-2" />Notifications</NavItem>
            <NavItem :hasFolderIcon="false"><LogOut :size="16" class="inline mr-2" />Logout</NavItem>
          </div>
        </div>
      </nav>
    `
  })
}

export const LeftSidePanelDemo: Story = {
  render: () => ({
    components: { LeftSidePanel, FolderOpen },
    setup() {
      const navItems = [
        {
          title: 'Workspace',
          items: [
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'projects', label: 'Projects' },
            { id: 'workflows', label: 'Workflows' },
            { id: 'models', label: 'Models' }
          ]
        },
        {
          title: 'Tools',
          items: [
            { id: 'node-editor', label: 'Node Editor' },
            { id: 'image-browser', label: 'Image Browser' },
            { id: 'queue-manager', label: 'Queue Manager' },
            { id: 'extensions', label: 'Extensions' }
          ]
        },
        { id: 'settings', label: 'Settings' }
      ]
      const active = ref<string | null>(null)
      return { navItems, active }
    },
    template: `
      <div class="w-80 h-[560px] bg-white dark-theme:bg-zinc-800 rounded-lg border border-zinc-200 dark-theme:border-zinc-700 overflow-hidden">
        <LeftSidePanel v-model="active" :nav-items="navItems">
          <template #header-icon>
            <FolderOpen :size="14" />
          </template>
          <template #header-title>
            Navigation
          </template>
        </LeftSidePanel>

        <div class="p-3 text-sm bg-gray-50 dark-theme:bg-zinc-900 border-t border-zinc-200 dark-theme:border-zinc-700">
          Active: {{ active ?? 'None' }}
        </div>
      </div>
    `
  })
}
