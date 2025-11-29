<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Tooltip from 'primevue/tooltip'
import Popover from 'primevue/popover'
import { useUiStore } from '@/stores/uiStore'

const vTooltip = Tooltip
const uiStore = useUiStore()

const accountMenu = ref<InstanceType<typeof Popover> | null>(null)
const logoMenu = ref<InstanceType<typeof Popover> | null>(null)

function toggleAccountMenu(event: Event): void {
  accountMenu.value?.toggle(event)
}

function toggleLogoMenu(event: Event): void {
  logoMenu.value?.toggle(event)
}

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
      { label: 'Recents', icon: 'pi pi-clock', route: `/${props.workspaceId}/recents` },
      { label: 'Library Hub', icon: 'pi pi-database', route: `/${props.workspaceId}/library` }
    ]
  },
  {
    label: 'My Library',
    items: [
      { label: 'Projects', icon: 'pi pi-folder', route: `/${props.workspaceId}/projects` },
      { label: 'Canvases', icon: 'pi pi-objects-column', route: `/${props.workspaceId}/canvases` },
      { label: 'Templates', icon: 'pi pi-th-large', route: `/${props.workspaceId}/templates` },
      { label: 'Workflows', icon: 'pi pi-sitemap', route: `/${props.workspaceId}/workflows` },
      { label: 'Assets', icon: 'pi pi-images', route: `/${props.workspaceId}/assets` },
      { label: 'Models', icon: 'pi pi-box', route: `/${props.workspaceId}/models` }
    ]
  },
  {
    label: 'Shared Projects',
    items: [
      { label: 'Image Generation', icon: 'pi pi-folder', route: `/${props.workspaceId}/img-gen` },
      { label: 'Video Processing', icon: 'pi pi-folder', route: `/${props.workspaceId}/video-proc` },
      { label: 'Audio Enhancement', icon: 'pi pi-folder', route: `/${props.workspaceId}/audio-enh` }
    ]
  },
  {
    label: 'Starred',
    items: [
      { label: 'Main Workflow', icon: 'pi pi-star-fill', route: `/${props.workspaceId}/img-gen/main-workflow` },
      { label: 'Upscale 4x', icon: 'pi pi-star-fill', route: `/${props.workspaceId}/upscale/upscale-4x` }
    ]
  }
])

const teamMenuGroups = computed<MenuGroup[]>(() => [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'pi pi-home', route: `/${props.workspaceId}` },
      { label: 'Recents', icon: 'pi pi-clock', route: `/${props.workspaceId}/recents` },
      { label: 'Library Hub', icon: 'pi pi-database', route: `/${props.workspaceId}/library` }
    ]
  },
  {
    label: 'My Library',
    items: [
      { label: 'Projects', icon: 'pi pi-folder', route: `/${props.workspaceId}/projects` },
      { label: 'Canvases', icon: 'pi pi-objects-column', route: `/${props.workspaceId}/canvases` },
      { label: 'Templates', icon: 'pi pi-th-large', route: `/${props.workspaceId}/templates` },
      { label: 'Workflows', icon: 'pi pi-sitemap', route: `/${props.workspaceId}/workflows` },
      { label: 'Assets', icon: 'pi pi-images', route: `/${props.workspaceId}/assets` },
      { label: 'Models', icon: 'pi pi-box', route: `/${props.workspaceId}/models` }
    ]
  },
  {
    label: 'Shared Projects',
    items: [
      { label: 'Image Generation', icon: 'pi pi-folder', route: `/${props.workspaceId}/img-gen` },
      { label: 'Video Processing', icon: 'pi pi-folder', route: `/${props.workspaceId}/video-proc` },
      { label: 'Audio Enhancement', icon: 'pi pi-folder', route: `/${props.workspaceId}/audio-enh` }
    ]
  },
  {
    label: 'Starred',
    items: [
      { label: 'Main Workflow', icon: 'pi pi-star-fill', route: `/${props.workspaceId}/img-gen/main-workflow` },
      { label: 'Upscale 4x', icon: 'pi pi-star-fill', route: `/${props.workspaceId}/upscale/upscale-4x` }
    ]
  }
])

const trashItem = computed<MenuItem>(() => ({
  label: 'Trash',
  icon: 'pi pi-trash',
  route: `/${props.workspaceId}/trash`
}))

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
    class="flex h-full w-[300px] flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950"
  >
    <!-- Logo -->
    <div class="flex h-14 items-center justify-between px-3">
      <button
        class="flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        @click="toggleLogoMenu"
      >
        <img src="/comfy-logo-yellow.svg" alt="ComfyUI" class="h-6" />
        <i class="pi pi-chevron-down text-[10px] text-zinc-400" />
      </button>

      <!-- Settings -->
      <RouterLink
        v-tooltip.bottom="'Settings'"
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

      <!-- Logo Menu Popover -->
      <Popover ref="logoMenu" append-to="self">
        <div class="flex w-60 flex-col p-1">
          <!-- File Section -->
          <div class="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            File
          </div>
          <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <i class="pi pi-file w-4 text-sm text-zinc-400" />
            <span class="flex-1">New Workflow</span>
            <span class="text-[11px] text-zinc-400">Ctrl+N</span>
          </button>
          <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <i class="pi pi-folder-open w-4 text-sm text-zinc-400" />
            <span class="flex-1">Open...</span>
            <span class="text-[11px] text-zinc-400">Ctrl+O</span>
          </button>
          <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <i class="pi pi-save w-4 text-sm text-zinc-400" />
            <span class="flex-1">Save</span>
            <span class="text-[11px] text-zinc-400">Ctrl+S</span>
          </button>
          <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <i class="pi pi-download w-4 text-sm text-zinc-400" />
            <span>Export...</span>
          </button>

          <div class="mx-2 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

          <!-- Workspace Section -->
          <div class="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Workspace
          </div>
          <RouterLink
            :to="`/${workspaceId}`"
            class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            @click="logoMenu?.hide()"
          >
            <i class="pi pi-home w-4 text-sm text-zinc-400" />
            <span>Dashboard</span>
          </RouterLink>
          <RouterLink
            :to="`/${workspaceId}/projects`"
            class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            @click="logoMenu?.hide()"
          >
            <i class="pi pi-folder w-4 text-sm text-zinc-400" />
            <span>Projects</span>
          </RouterLink>

          <div class="mx-2 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

          <!-- Account Section -->
          <div class="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Account
          </div>
          <RouterLink
            :to="`/${workspaceId}/settings`"
            class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            @click="logoMenu?.hide()"
          >
            <i class="pi pi-cog w-4 text-sm text-zinc-400" />
            <span>Settings</span>
          </RouterLink>
          <button
            class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            @click="uiStore.toggleInterfaceVersion()"
          >
            <i class="pi pi-sparkles w-4 text-sm text-zinc-400" />
            <span class="flex-1">Experimental UI</span>
            <div
              class="h-5 w-9 rounded-full p-0.5 transition-colors"
              :class="uiStore.interfaceVersion === 'v2' ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'"
            >
              <div
                class="h-4 w-4 rounded-full bg-white transition-transform"
                :class="uiStore.interfaceVersion === 'v2' ? 'translate-x-4' : 'translate-x-0'"
              />
            </div>
          </button>

          <div class="mx-2 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

          <button
            class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            @click="signOut(); logoMenu?.hide()"
          >
            <i class="pi pi-sign-out w-4 text-sm" />
            <span>Sign out</span>
          </button>
        </div>
      </Popover>
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

    <!-- Trash -->
    <div class="px-3 pb-2">
      <RouterLink
        :to="trashItem.route ?? '#'"
        :class="[
          'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive(trashItem.route)
            ? 'bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
        ]"
      >
        <i :class="[trashItem.icon, 'text-base']" />
        <span>{{ trashItem.label }}</span>
      </RouterLink>
    </div>

    <!-- Footer -->
    <div class="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
      <!-- Account Dropdown -->
      <button
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        @click="toggleAccountMenu"
      >
        <div
          :class="[
            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            isTeam ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          ]"
        >
          J
        </div>
        <div class="flex-1 overflow-hidden text-left">
          <p class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            John Doe
          </p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            {{ isTeam ? 'Netflix' : 'Personal Workspace' }}
          </p>
        </div>
        <i class="pi pi-chevron-down text-xs text-zinc-400" />
      </button>

      <!-- Account Popover -->
      <Popover ref="accountMenu" append-to="self">
        <div class="flex w-64 flex-col p-2">
          <!-- Personal -->
          <p class="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Personal
          </p>
          <RouterLink
            to="/user"
            class="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="accountMenu?.hide()"
          >
            <div class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              U
            </div>
            <div class="flex-1">
              <p class="font-medium">My Workspace</p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Owner</p>
            </div>
          </RouterLink>

          <div class="my-2 h-px bg-zinc-200 dark:bg-zinc-700" />

          <!-- Team Workspaces -->
          <p class="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Acme Studio
          </p>
          <RouterLink
            to="/team"
            class="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="accountMenu?.hide()"
          >
            <div class="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
              <i class="pi pi-sitemap text-xs" />
            </div>
            <div class="flex-1">
              <p class="font-medium">Workflow Builder</p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Full access</p>
            </div>
          </RouterLink>
          <RouterLink
            to="/team-artist"
            class="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="accountMenu?.hide()"
          >
            <div class="flex h-7 w-7 items-center justify-center rounded-full bg-pink-600 text-xs font-semibold text-white">
              <i class="pi pi-palette text-xs" />
            </div>
            <div class="flex-1">
              <p class="font-medium">Visual Artist</p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Edit assets & canvases</p>
            </div>
          </RouterLink>
          <RouterLink
            to="/team-motion"
            class="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="accountMenu?.hide()"
          >
            <div class="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-xs font-semibold text-white">
              <i class="pi pi-video text-xs" />
            </div>
            <div class="flex-1">
              <p class="font-medium">Motion Designer</p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Edit video workflows</p>
            </div>
          </RouterLink>
          <RouterLink
            to="/team-pm"
            class="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            @click="accountMenu?.hide()"
          >
            <div class="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
              <i class="pi pi-chart-bar text-xs" />
            </div>
            <div class="flex-1">
              <p class="font-medium">Project Manager</p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">View only</p>
            </div>
          </RouterLink>

          <div class="my-2 h-px bg-zinc-200 dark:bg-zinc-700" />

          <button
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            @click="signOut(); accountMenu?.hide()"
          >
            <i class="pi pi-sign-out text-sm" />
            <span>Sign out</span>
          </button>
        </div>
      </Popover>
    </div>
  </aside>
</template>
