<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface MenuItem {
  label: string
  icon: string
  route?: string
  badge?: number
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const props = defineProps<{
  workspaceId: string
}>()

const route = useRoute()
const router = useRouter()

const isTeam = computed(() => props.workspaceId === 'team')

// Workspace dropdown
const showWorkspaceMenu = ref(false)

// Mock workspaces for switching
const workspaces = [
  { id: 'personal', name: 'Personal', type: 'personal' as const },
  { id: 'team', name: 'Team Workspace', type: 'team' as const }
]

function toggleWorkspaceMenu(): void {
  showWorkspaceMenu.value = !showWorkspaceMenu.value
}

function closeWorkspaceMenu(): void {
  showWorkspaceMenu.value = false
}

function switchWorkspace(workspaceId: string): void {
  router.push(`/${workspaceId}`)
  closeWorkspaceMenu()
}

const userMenuGroups = computed<MenuGroup[]>(() => [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'pi pi-home', route: `/${props.workspaceId}` },
      { label: 'Projects', icon: 'pi pi-folder', route: `/${props.workspaceId}/projects` },
      { label: 'Canvases', icon: 'pi pi-objects-column', route: `/${props.workspaceId}/canvases` }
    ]
  },
  {
    label: 'Library',
    items: [
      { label: 'Workflows', icon: 'pi pi-sitemap', route: `/${props.workspaceId}/workflows` },
      { label: 'Assets', icon: 'pi pi-images', route: `/${props.workspaceId}/assets` },
      { label: 'Models', icon: 'pi pi-box', route: `/${props.workspaceId}/models` }
    ]
  }
])

const teamMenuGroups = computed<MenuGroup[]>(() => [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'pi pi-home', route: `/${props.workspaceId}` },
      { label: 'Projects', icon: 'pi pi-folder', route: `/${props.workspaceId}/projects` },
      { label: 'Canvases', icon: 'pi pi-objects-column', route: `/${props.workspaceId}/canvases` }
    ]
  },
  {
    label: 'Library',
    items: [
      { label: 'Workflows', icon: 'pi pi-sitemap', route: `/${props.workspaceId}/workflows` },
      { label: 'Assets', icon: 'pi pi-images', route: `/${props.workspaceId}/assets` },
      { label: 'Models', icon: 'pi pi-box', route: `/${props.workspaceId}/models` }
    ]
  },
  {
    label: 'Team',
    items: [
      { label: 'Members', icon: 'pi pi-users', route: `/${props.workspaceId}/members`, badge: 8 },
      { label: 'Activity', icon: 'pi pi-history', route: `/${props.workspaceId}/activity` }
    ]
  }
])

const menuGroups = computed(() => (isTeam.value ? teamMenuGroups.value : userMenuGroups.value))

function isActive(itemRoute?: string): boolean {
  if (!itemRoute) return false
  if (itemRoute === `/${props.workspaceId}`) {
    return route.path === itemRoute
  }
  return route.path.startsWith(itemRoute)
}

function signOut(): void {
  router.push('/')
}
</script>

<template>
  <aside
    class="flex h-full w-60 flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950"
  >
    <!-- Header with Dropdown -->
    <div class="relative border-b border-zinc-200 dark:border-zinc-800">
      <button
        class="flex h-14 w-full items-center gap-3 px-4 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
        @click="toggleWorkspaceMenu"
      >
        <div
          :class="[
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-sm font-semibold',
            isTeam ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          ]"
        >
          {{ workspaceId.charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 overflow-hidden text-left">
          <p class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {{ workspaceId }}
          </p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            {{ isTeam ? 'Team' : 'Personal' }}
          </p>
        </div>
        <i
          :class="[
            'pi text-xs text-zinc-400 transition-transform',
            showWorkspaceMenu ? 'pi-chevron-up' : 'pi-chevron-down'
          ]"
        />
      </button>

      <!-- Dropdown Menu -->
      <div
        v-if="showWorkspaceMenu"
        class="absolute left-2 right-2 top-full z-50 mt-1 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <!-- Account Section -->
        <div class="border-b border-zinc-100 p-2 dark:border-zinc-800">
          <p class="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Account</p>
          <RouterLink
            to="/account/profile"
            class="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="closeWorkspaceMenu"
          >
            <i class="pi pi-user text-zinc-400" />
            <span>Profile</span>
          </RouterLink>
          <RouterLink
            to="/account/billing"
            class="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="closeWorkspaceMenu"
          >
            <i class="pi pi-credit-card text-zinc-400" />
            <span>Billing</span>
          </RouterLink>
        </div>

        <!-- Workspaces Section -->
        <div class="border-b border-zinc-100 p-2 dark:border-zinc-800">
          <p class="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Workspaces</p>
          <button
            v-for="ws in workspaces"
            :key="ws.id"
            class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="switchWorkspace(ws.id)"
          >
            <div
              :class="[
                'flex h-6 w-6 items-center justify-center rounded text-xs font-semibold',
                ws.type === 'team' ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
              ]"
            >
              {{ ws.name.charAt(0) }}
            </div>
            <span class="flex-1">{{ ws.name }}</span>
            <i v-if="ws.id === workspaceId" class="pi pi-check text-xs text-blue-600 dark:text-blue-400" />
          </button>
          <button
            class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            @click="closeWorkspaceMenu"
          >
            <div class="flex h-6 w-6 items-center justify-center rounded border border-dashed border-zinc-300 dark:border-zinc-600">
              <i class="pi pi-plus text-xs" />
            </div>
            <span>Create workspace</span>
          </button>
        </div>

        <!-- About Section -->
        <div class="p-2">
          <RouterLink
            to="/about"
            class="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="closeWorkspaceMenu"
          >
            <i class="pi pi-info-circle text-zinc-400" />
            <span>About</span>
          </RouterLink>
          <a
            href="https://docs.comfy.org"
            target="_blank"
            class="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="closeWorkspaceMenu"
          >
            <i class="pi pi-book text-zinc-400" />
            <span>Documentation</span>
            <i class="pi pi-external-link ml-auto text-xs text-zinc-400" />
          </a>
          <a
            href="https://github.com/comfyanonymous/ComfyUI"
            target="_blank"
            class="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="closeWorkspaceMenu"
          >
            <i class="pi pi-github text-zinc-400" />
            <span>GitHub</span>
            <i class="pi pi-external-link ml-auto text-xs text-zinc-400" />
          </a>
        </div>
      </div>

      <!-- Backdrop to close menu -->
      <div
        v-if="showWorkspaceMenu"
        class="fixed inset-0 z-40"
        @click="closeWorkspaceMenu"
      />
    </div>

    <!-- Menu Groups -->
    <nav class="flex-1 overflow-y-auto px-3 py-4">
      <template v-for="(group, groupIndex) in menuGroups" :key="group.label">
        <div v-if="groupIndex > 0" class="my-4" />

        <p class="mb-2 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {{ group.label }}
        </p>

        <ul class="flex flex-col gap-0.5">
          <li v-for="item in group.items" :key="item.label">
            <RouterLink
              :to="item.route ?? '#'"
              :class="[
                'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
                isActive(item.route)
                  ? 'bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              ]"
            >
              <i :class="[item.icon, 'text-base']" />
              <span class="flex-1">{{ item.label }}</span>
              <span
                v-if="item.badge"
                :class="[
                  'rounded-full px-1.5 py-0.5 text-xs font-medium',
                  isActive(item.route)
                    ? 'bg-white/20 dark:bg-zinc-900/20'
                    : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                ]"
              >
                {{ item.badge }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </template>
    </nav>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-1 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <RouterLink
        :to="`/${workspaceId}/settings`"
        :class="[
          'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          isActive(`/${workspaceId}/settings`)
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
        ]"
        title="Settings"
      >
        <i class="pi pi-cog text-base" />
      </RouterLink>
      <button
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        title="Sign out"
        @click="signOut"
      >
        <i class="pi pi-sign-out text-base" />
      </button>
    </div>
  </aside>
</template>
