<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

// Story-only type (Separated from actual production types)
export interface MissingNodePack {
  id: string
  displayName: string
  packId: string
  description: string
}

// Props / Emits
const props = withDefaults(
  defineProps<{
    selectedPack?: MissingNodePack | null
  }>(),
  { selectedPack: null }
)

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <!--
    BaseModalLayout structure reproduction:
    - Outer: rounded-2xl overflow-hidden
    - Grid: 14rem(left) 1fr(content) 18rem(right)
    - Left/Right panel bg: modal-panel-background = charcoal-600 = #262729
    - Main bg: base-background = charcoal-800 = #171718
    - Header height: h-18 (4.5rem / 72px)
    - Border: charcoal-200 = #494a50
    - NavItem selected: charcoal-300 = #3c3d42
    - NavItem hovered: charcoal-400 = #313235
  -->
  <div
    class="w-full h-full rounded-2xl overflow-hidden shadow-[1px_1px_8px_0px_rgba(0,0,0,0.4)]"
    style="display:grid; grid-template-columns: 14rem 1fr 18rem;"
  >

    <!-- ① Left Panel: bg = modal-panel-background = #262729 -->
    <nav class="h-full overflow-hidden flex flex-col" style="background:#262729;">
      <!-- Header: h-18 = 72px -->
      <header class="flex w-full shrink-0 gap-2 pl-6 pr-3 items-center" style="height:4.5rem;">
        <i class="icon-[comfy--extensions-blocks] text-white" />
        <h2 class="text-white text-base font-semibold m-0">Nodes Manager</h2>
      </header>

      <!-- NavItems: px-3 gap-1 flex-col -->
      <div class="flex flex-col gap-1 px-3 pb-3 overflow-y-auto">
        <!-- All Extensions -->
        <div class="flex cursor-pointer select-none items-center gap-2 rounded-md px-4 py-3 text-sm text-white transition-colors hover:bg-[#313235]">
          <i class="icon-[lucide--list] size-4 text-white/70 shrink-0" />
          <span class="min-w-0 truncate">All Extensions</span>
        </div>
        <!-- Not Installed -->
        <div class="flex cursor-pointer select-none items-center gap-2 rounded-md px-4 py-3 text-sm text-white transition-colors hover:bg-[#313235]">
          <i class="icon-[lucide--globe] size-4 text-white/70 shrink-0" />
          <span class="min-w-0 truncate">Not Installed</span>
        </div>

        <!-- Installed Group -->
        <div class="flex flex-col gap-1 mt-2">
          <p class="px-4 py-1 text-[10px] text-white/40 uppercase tracking-wider font-medium m-0">Installed</p>
          <div class="flex cursor-pointer select-none items-center gap-2 rounded-md px-4 py-3 text-sm text-white transition-colors hover:bg-[#313235]">
            <i class="icon-[lucide--download] size-4 text-white/70 shrink-0" />
            <span class="min-w-0 truncate">All Installed</span>
          </div>
          <div class="flex cursor-pointer select-none items-center gap-2 rounded-md px-4 py-3 text-sm text-white transition-colors hover:bg-[#313235]">
            <i class="icon-[lucide--refresh-cw] size-4 text-white/70 shrink-0" />
            <span class="min-w-0 truncate">Updates Available</span>
          </div>
          <div class="flex cursor-pointer select-none items-center gap-2 rounded-md px-4 py-3 text-sm text-white transition-colors hover:bg-[#313235]">
            <i class="icon-[lucide--triangle-alert] size-4 text-white/70 shrink-0" />
            <span class="min-w-0 truncate">Conflicting</span>
          </div>
        </div>

        <!-- In Workflow Group -->
        <div class="flex flex-col gap-1 mt-2">
          <p class="px-4 py-1 text-[10px] text-white/40 uppercase tracking-wider font-medium m-0">In Workflow</p>
          <div class="flex cursor-pointer select-none items-center gap-2 rounded-md px-4 py-3 text-sm text-white transition-colors hover:bg-[#313235]">
            <i class="icon-[lucide--share-2] size-4 text-white/70 shrink-0" />
            <span class="min-w-0 truncate">In Workflow</span>
          </div>
          <!-- Missing Nodes: active selection = charcoal-300 = #3c3d42 -->
          <div class="flex cursor-pointer select-none items-center gap-2 rounded-md px-4 py-3 text-sm text-white transition-colors bg-[#3c3d42]">
            <i class="icon-[lucide--triangle-alert] size-4 text-[#fd9903] shrink-0" />
            <span class="min-w-0 truncate">Missing Nodes</span>
          </div>
        </div>
      </div>
    </nav>

    <!-- ② Main Content: bg = base-background = #171718 -->
    <div class="flex flex-col overflow-hidden" style="background:#171718;">
      <!-- Header row 1: Node Pack dropdown | Search | Install All -->
      <header class="w-full px-6 flex items-center gap-3 shrink-0" style="height:4.5rem;">
        <!-- Node Pack Dropdown -->
        <div class="flex items-center gap-2 h-10 px-3 rounded-lg shrink-0 cursor-pointer text-sm text-white border border-[#494a50] hover:border-[#55565e]" style="background:#262729;">
          <span>Node Pack</span>
          <i class="icon-[lucide--chevron-down] size-4 text-[#8a8a8a]" />
        </div>
        <!-- Search bar (flex-1) -->
        <div class="flex items-center h-10 rounded-lg px-4 gap-2 flex-1" style="background:#262729;">
          <i class="pi pi-search text-xs text-[#8a8a8a] shrink-0" />
          <span class="text-sm text-[#8a8a8a]">Search</span>
        </div>
        <!-- Install All Button (blue, right side) -->
        <Button variant="primary" size="sm" class="shrink-0 gap-2 px-4 text-sm h-10 font-semibold rounded-xl">
          <i class="icon-[lucide--download] size-4" />
          Install All
        </Button>
      </header>

      <!-- Header row 2: Downloads Sort Dropdown (right aligned) -->
      <div class="flex justify-end px-6 py-3 shrink-0">
        <div class="flex items-center h-10 gap-2 px-4 rounded-xl cursor-pointer text-sm text-white border border-[#494a50] hover:border-[#55565e]" style="background:#262729;">
          <i class="icon-[lucide--arrow-up-down] size-4 text-[#8a8a8a]" />
          <span>Downloads</span>
          <i class="icon-[lucide--chevron-down] size-4 text-[#8a8a8a]" />
        </div>
      </div>

      <!-- Pack Grid Content -->
      <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));">
          <div
            v-for="(_, i) in 9"
            :key="i"
            :class="[
              'rounded-xl border p-4 flex flex-col gap-3 cursor-pointer transition-colors',
              i === 0 && selectedPack
                ? 'border-[#0b8ce9]/70 ring-1 ring-[#0b8ce9]/40'
                : 'border-[#494a50] hover:border-[#55565e]'
            ]"
            :style="i === 0 && selectedPack ? 'background:#172d3a;' : 'background:#262729;'"
          >
            <!-- Card Image Area -->
            <div class="w-full h-20 rounded-lg flex items-center justify-center" style="background:#313235;">
              <i class="icon-[lucide--package] size-6 text-[#8a8a8a]" />
            </div>
            <!-- Card Text Content -->
            <div>
              <p class="m-0 text-xs font-semibold text-white truncate">
                {{ i === 0 && selectedPack ? selectedPack.packId : 'node-pack-' + (i + 1) }}
              </p>
              <p class="m-0 text-[11px] text-[#8a8a8a] truncate mt-0.5">by publisher</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ③ Right Info Panel -->
    <aside class="h-full flex flex-col overflow-hidden" style="background:#1c1d1f; border-left: 1px solid #494a50;">
      <!-- Header: h-18 - Title + Panel icons + X close -->
      <header class="flex h-[4.5rem] shrink-0 items-center px-5 gap-3 border-b border-[#494a50]">
        <h2 class="flex-1 select-none text-base font-bold text-white m-0">Node Pack Info</h2>
        <!-- Panel Collapse Icon -->
        <button
          class="flex items-center justify-center text-[#8a8a8a] hover:text-white p-1"
          style="background:none;border:none;outline:none;cursor:pointer;"
        >
          <i class="icon-[lucide--panel-right] size-4" />
        </button>
        <!-- Close X Icon -->
        <button
          class="flex items-center justify-center text-[#8a8a8a] hover:text-white p-1"
          style="background:none;border:none;outline:none;cursor:pointer;"
          @click="emit('close')"
        >
          <i class="icon-[lucide--x] size-4" />
        </button>
      </header>

      <!-- Panel Content Area -->
      <div class="flex-1 min-h-0 overflow-y-auto">
        <div v-if="props.selectedPack" class="flex flex-col divide-y divide-[#2e2f31]">

          <!-- ACTIONS SECTION -->
          <div class="flex flex-col gap-3 px-5 py-4">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-widest">Actions</span>
              <i class="icon-[lucide--chevron-up] size-4 text-[#8a8a8a]" />
            </div>
            <Button variant="primary" class="w-full justify-center gap-2 h-10 font-semibold rounded-xl">
              <i class="icon-[lucide--download] size-4" />
              Install
            </Button>
          </div>

          <!-- BASIC INFO SECTION -->
          <div class="flex flex-col gap-4 px-5 py-4">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-widest">Basic Info</span>
              <i class="icon-[lucide--chevron-up] size-4 text-[#8a8a8a]" />
            </div>
            <!-- Name -->
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-white">Name</span>
              <span class="text-sm text-[#8a8a8a]">{{ props.selectedPack.packId }}</span>
            </div>
            <!-- Created By -->
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-white">Created By</span>
              <span class="text-sm text-[#8a8a8a]">publisher</span>
            </div>
            <!-- Downloads -->
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-white">Downloads</span>
              <span class="text-sm text-[#8a8a8a]">539,373</span>
            </div>
            <!-- Last Updated -->
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-white">Last Updated</span>
              <span class="text-sm text-[#8a8a8a]">Jan 21, 2026</span>
            </div>
            <!-- Status -->
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-white">Status</span>
              <span
                class="inline-flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs text-white border border-[#494a50]"
                style="background:#262729;"
              >
                <span class="size-2 rounded-full bg-[#8a8a8a] shrink-0" />
                Unknown
              </span>
            </div>
            <!-- Version -->
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-white">Version</span>
              <span
                class="inline-flex items-center gap-1 w-fit px-2.5 py-1 rounded-full text-xs text-white border border-[#494a50]"
                style="background:#262729;"
              >
                1.8.0
                <i class="icon-[lucide--chevron-right] size-3 text-[#8a8a8a]" />
              </span>
            </div>
          </div>

          <!-- DESCRIPTION SECTION -->
          <div class="flex flex-col gap-4 px-5 py-4">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-widest">Description</span>
              <i class="icon-[lucide--chevron-up] size-4 text-[#8a8a8a]" />
            </div>
            <!-- Description -->
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-white">Description</span>
              <p class="m-0 text-sm text-[#8a8a8a] leading-relaxed">{{ props.selectedPack.description }}</p>
            </div>
            <!-- Repository -->
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-white">Repository</span>
              <div class="flex items-start gap-2">
                <i class="icon-[lucide--github] size-4 text-[#8a8a8a] shrink-0 mt-0.5" />
                <span class="text-sm text-[#8a8a8a] break-all flex-1">https://github.com/aria1th/{{ props.selectedPack.packId }}</span>
                <i class="icon-[lucide--external-link] size-4 text-[#8a8a8a] shrink-0 mt-0.5" />
              </div>
            </div>
            <!-- License -->
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-white">License</span>
              <span class="text-sm text-[#8a8a8a]">MIT</span>
            </div>
          </div>

          <!-- NODES SECTION -->
          <div class="flex flex-col gap-3 px-5 py-4">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-widest">Nodes</span>
              <i class="icon-[lucide--chevron-up] size-4 text-[#8a8a8a]" />
            </div>
          </div>

        </div>

        <!-- No Selection State -->
        <div v-else class="flex flex-col items-center justify-center h-full gap-3 px-6 opacity-40">
          <i class="icon-[lucide--package] size-8 text-white" />
          <p class="m-0 text-sm text-white text-center">Select a pack to view details</p>
        </div>
      </div>
    </aside>

  </div>
</template>
