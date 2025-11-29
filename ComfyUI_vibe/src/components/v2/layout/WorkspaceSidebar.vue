<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Tooltip from 'primevue/tooltip'

const vTooltip = Tooltip

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
    <!-- Header -->
    <div class="flex h-14 items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
      <div
        :class="[
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-sm font-semibold',
          isTeam ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
        ]"
      >
        {{ workspaceId.charAt(0).toUpperCase() }}
      </div>
      <div class="flex-1 overflow-hidden">
        <p class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {{ workspaceId }}
        </p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
          {{ isTeam ? 'Team' : 'Personal' }}
        </p>
      </div>
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
        v-tooltip.top="'Settings'"
        :to="`/${workspaceId}/settings`"
        :class="[
          'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          isActive(`/${workspaceId}/settings`)
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
        ]"
      >
        <i class="pi pi-cog text-base" />
      </RouterLink>
      <button
        v-tooltip.top="'Sign out'"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        @click="signOut"
      >
        <i class="pi pi-sign-out text-base" />
      </button>
    </div>
  </aside>
</template>
