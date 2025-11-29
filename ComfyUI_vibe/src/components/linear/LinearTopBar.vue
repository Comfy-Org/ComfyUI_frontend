<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/uiStore'

const router = useRouter()
const uiStore = useUiStore()

const sessionName = ref('Untitled session')
const credits = ref(4625)
const showMenu = ref(false)

function handleLogoClick(): void {
  showMenu.value = !showMenu.value
}

function goToWorkspace(): void {
  showMenu.value = false
  router.push({ name: 'workspace-dashboard', params: { workspaceId: 'default' } })
}

function goToProjects(): void {
  showMenu.value = false
  router.push({ name: 'workspace-projects', params: { workspaceId: 'default' } })
}

function goToSettings(): void {
  showMenu.value = false
  router.push({ name: 'workspace-settings', params: { workspaceId: 'default' } })
}

function signOut(): void {
  showMenu.value = false
  router.push('/')
}

function toggleExperimentalUI(): void {
  uiStore.toggleInterfaceVersion()
}
</script>

<template>
  <header class="flex h-10 shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-950 px-2 select-none">
    <!-- Logo Section with Dropdown -->
    <div class="relative">
      <button
        class="flex items-center gap-1 rounded-md px-2 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        @click="handleLogoClick"
      >
        <img src="/assets/images/comfy-logo-mono.svg" alt="Comfy" class="h-5 w-5" />
        <i class="pi pi-chevron-down text-[10px] opacity-70" />
      </button>

      <!-- Dropdown Menu -->
      <div v-if="showMenu" class="absolute left-0 top-full z-[100] mt-1 min-w-[240px] rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl">
        <!-- File Section -->
        <div class="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">File</div>
        <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:bg-zinc-800">
          <i class="pi pi-file w-4 text-sm text-zinc-500" />
          <span class="flex-1">New Session</span>
          <span class="text-[11px] text-zinc-600">Ctrl+N</span>
        </button>
        <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:bg-zinc-800">
          <i class="pi pi-folder-open w-4 text-sm text-zinc-500" />
          <span class="flex-1">Open...</span>
          <span class="text-[11px] text-zinc-600">Ctrl+O</span>
        </button>
        <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:bg-zinc-800">
          <i class="pi pi-save w-4 text-sm text-zinc-500" />
          <span class="flex-1">Save</span>
          <span class="text-[11px] text-zinc-600">Ctrl+S</span>
        </button>
        <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:bg-zinc-800">
          <i class="pi pi-download w-4 text-sm text-zinc-500" />
          <span>Export...</span>
        </button>

        <div class="mx-2 my-1 h-px bg-zinc-800" />

        <!-- Workspace Section -->
        <div class="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Workspace</div>
        <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:bg-zinc-800" @click="goToWorkspace">
          <i class="pi pi-home w-4 text-sm text-zinc-500" />
          <span>Dashboard</span>
        </button>
        <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:bg-zinc-800" @click="goToProjects">
          <i class="pi pi-folder w-4 text-sm text-zinc-500" />
          <span>Projects</span>
        </button>

        <div class="mx-2 my-1 h-px bg-zinc-800" />

        <!-- Account Section -->
        <div class="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Account</div>
        <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:bg-zinc-800" @click="goToSettings">
          <i class="pi pi-cog w-4 text-sm text-zinc-500" />
          <span>Settings</span>
        </button>
        <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:bg-zinc-800" @click="toggleExperimentalUI">
          <i class="pi pi-sparkles w-4 text-sm text-zinc-500" />
          <span class="flex-1">Experimental UI</span>
          <div
            class="h-5 w-9 rounded-full p-0.5 transition-colors"
            :class="uiStore.interfaceVersion === 'v2' ? 'bg-blue-500' : 'bg-zinc-700'"
          >
            <div
              class="h-4 w-4 rounded-full bg-white transition-transform"
              :class="uiStore.interfaceVersion === 'v2' ? 'translate-x-4' : 'translate-x-0'"
            />
          </div>
        </button>

        <div class="mx-2 my-1 h-px bg-zinc-800" />

        <button class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-red-400 transition-colors hover:bg-red-500/10" @click="signOut">
          <i class="pi pi-sign-out w-4 text-sm text-red-400" />
          <span>Sign out</span>
        </button>
      </div>

      <!-- Backdrop -->
      <div v-if="showMenu" class="fixed inset-0 z-[99]" @click="showMenu = false" />
    </div>

    <!-- Divider -->
    <div class="mx-1 h-5 w-px bg-zinc-800" />

    <!-- Home Button -->
    <button
      v-tooltip.bottom="{ value: 'Home', showDelay: 50 }"
      class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
      @click="goToWorkspace"
    >
      <i class="pi pi-home text-base" />
    </button>

    <!-- Divider -->
    <div class="mx-1 h-5 w-px bg-zinc-800" />

    <!-- Session Name / Tabs Area -->
    <div class="flex flex-1 items-center">
      <div class="flex items-center gap-1">
        <span class="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100">{{ sessionName }}</span>
        <button class="p-1 text-zinc-500 transition-colors hover:text-zinc-300">
          <i class="pi pi-ellipsis-h text-xs" />
        </button>
      </div>
    </div>

    <!-- Right Section -->
    <div class="flex items-center gap-2">
      <button
        v-tooltip.bottom="{ value: 'Help', showDelay: 50 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
      >
        <i class="pi pi-question-circle text-sm" />
      </button>
      <button
        v-tooltip.bottom="{ value: 'Open in new window', showDelay: 50 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
      >
        <i class="pi pi-external-link text-sm" />
      </button>
      <span class="text-xs text-zinc-400">{{ credits.toLocaleString() }} credits</span>
      <button class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
        Upgrade
      </button>
    </div>
  </header>
</template>
