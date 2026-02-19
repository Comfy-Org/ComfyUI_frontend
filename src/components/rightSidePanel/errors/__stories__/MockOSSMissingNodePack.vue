<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import type { MissingNodePack } from './MockManagerDialog.vue'

// Props / Emits

const emit = defineEmits<{
  'open-manager': [pack: MissingNodePack],
  'locate': [pack: MissingNodePack],
  'log': [msg: string]
}>()

// Mock Data

const MOCK_MISSING_PACKS: MissingNodePack[] = [
  {
    id: 'pack-1',
    displayName: 'MeshGraphormerDepthMapPreprocessor_for_SEGS  //Inspire',
    packId: 'comfyui-inspire-pack',
    description: 'Inspire Pack provides various creative and utility nodes for ComfyUI workflows.'
  },
  {
    id: 'pack-2',
    displayName: 'TilePreprocessor_Provider_for_SEGS',
    packId: 'comfyui-controlnet-aux',
    description: 'Auxiliary preprocessors for ControlNet including tile, depth, and pose processors.'
  },
  {
    id: 'pack-3',
    displayName: 'WD14Tagger | pysssss',
    packId: 'comfyui-wdv14-tagger',
    description: 'Automatic image tagging using WD14 model from pysssss.'
  },
  {
    id: 'pack-4',
    displayName: 'CR Simple Image Compare',
    packId: 'comfyui-crystools',
    description: 'Crystal Tools suite including image comparison and utility nodes.'
  },
  {
    id: 'pack-5',
    displayName: 'FaceDetailer | impact',
    packId: 'comfyui-impact-pack',
    description: 'Impact Pack provides face detailing, masking, and segmentation utilities.'
  }
]

// State

const isSectionCollapsed = ref(false)
const installStates = ref<Record<string, 'idle' | 'installing' | 'error'>>({})
const hasSuccessfulInstall = ref(false)

// Helpers

function getInstallState(packId: string) {
  return installStates.value[packId] ?? 'idle'
}

function getElementStyle(el: HTMLElement) {
  return {
    height: el.style.height,
    overflow: el.style.overflow,
    paddingTop: el.style.paddingTop,
    paddingBottom: el.style.paddingBottom,
    marginTop: el.style.marginTop,
    marginBottom: el.style.marginBottom
  }
}

// Actions

function onInstall(pack: MissingNodePack) {
  if (getInstallState(pack.id) !== 'idle') return
  installStates.value[pack.id] = 'installing'
  emit('log', `⤵ Installing: "${pack.packId}"`)
  
  const isErrorPack = pack.id === 'pack-2'
  const delay = isErrorPack ? 2000 : 3000
  
  setTimeout(() => {
    if (isErrorPack) {
      installStates.value[pack.id] = 'error'
      emit('log', `⚠️ Install failed: "${pack.packId}"`)
    } else {
      installStates.value[pack.id] = 'idle'
      hasSuccessfulInstall.value = true
      emit('log', `✓ Installed: "${pack.packId}"`)
    }
  }, delay)
}

function onInstallAll() {
  const idlePacks = MOCK_MISSING_PACKS.filter(p => getInstallState(p.id) === 'idle')
  if (!idlePacks.length) {
    emit('log', 'No packs to install')
    return
  }
  emit('log', `Install All → Starting sequential install of ${idlePacks.length} pack(s)`)
  idlePacks.forEach((pack, i) => {
    setTimeout(() => onInstall(pack), i * 1000)
  })
}

function resetAll() {
  installStates.value = {}
  hasSuccessfulInstall.value = false
  emit('log', '🔄 Reboot Server')
}

// Transitions

const DURATION = 150

function enterTransition(element: Element, done: () => void) {
  const el = element as HTMLElement
  const init = getElementStyle(el)
  const { width } = getComputedStyle(el)
  el.style.width = width
  el.style.position = 'absolute'
  el.style.visibility = 'hidden'
  el.style.height = ''
  const { height } = getComputedStyle(el)
  el.style.position = ''
  el.style.visibility = ''
  el.style.height = '0px'
  el.style.overflow = 'hidden'
  const anim = el.animate(
    [{ height: '0px', opacity: 0 }, { height, opacity: 1 }],
    { duration: DURATION, easing: 'ease-in-out' }
  )
  el.style.height = init.height
  anim.onfinish = () => { el.style.overflow = init.overflow; done() }
}

function leaveTransition(element: Element, done: () => void) {
  const el = element as HTMLElement
  const init = getElementStyle(el)
  const { height } = getComputedStyle(el)
  el.style.height = height
  el.style.overflow = 'hidden'
  const anim = el.animate(
    [{ height, opacity: 1 }, { height: '0px', opacity: 0 }],
    { duration: DURATION, easing: 'ease-in-out' }
  )
  el.style.height = init.height
  anim.onfinish = () => { el.style.overflow = init.overflow; done() }
}
</script>

<template>
  <div
    class="w-[320px] h-full shrink-0 flex flex-col gap-4 py-1 bg-[#171718] border-l border-[#494a50] shadow-[1px_1px_8px_0px_rgba(0,0,0,0.4)]"
  >
    <!-- ① Nav Item: "Workflow Overview" + panel-right button -->
    <div class="flex h-12 items-center overflow-hidden py-2 border-b border-[#55565e] shrink-0">
      <div class="flex flex-1 gap-2 items-center min-w-0 pl-4 pr-3">
        <p class="flex-1 min-w-0 font-bold text-sm text-white whitespace-pre-wrap">
          Workflow Overview
        </p>
        <div class="flex h-8 items-center justify-center overflow-hidden p-2 rounded-lg bg-[#262729] shrink-0 cursor-pointer hover:bg-[#303133]">
          <i class="icon-[lucide--panel-right] size-4 text-white" />
        </div>
      </div>
    </div>

    <!-- ② Node Header: tab bar + search -->
    <div class="flex flex-col gap-3 items-start px-4 shrink-0">
      <!-- Tab bar -->
      <div class="flex gap-2 items-center w-full overflow-x-auto no-scrollbar">
        <!-- "Error" tab (active) -->
        <div class="flex gap-1 h-8 items-center justify-center overflow-hidden px-2 rounded-lg shrink-0 bg-[#262729]">
          <span class="text-sm text-white">Error</span>
          <div class="flex items-center justify-center size-6 shrink-0">
            <i class="icon-[lucide--octagon-alert] size-4 text-[#e04e48]" />
          </div>
        </div>
        <!-- Other tabs -->
        <div class="flex h-8 items-center justify-center overflow-hidden px-2 rounded-lg shrink-0">
          <span class="text-sm text-[#8a8a8a]">Inputs</span>
        </div>
        <div class="flex h-8 items-center justify-center overflow-hidden px-2 rounded-lg shrink-0">
          <span class="text-sm text-[#8a8a8a]">Nodes</span>
        </div>
        <div class="flex h-8 items-center justify-center overflow-hidden px-2 rounded-lg shrink-0">
          <span class="text-sm whitespace-nowrap text-[#8a8a8a]">Global settings</span>
        </div>
      </div>

      <!-- Search bar -->
      <div class="flex gap-2 h-8 items-center min-h-[32px] px-2 py-1.5 rounded-lg bg-[#262729] w-full">
        <i class="icon-[lucide--search] size-4 text-[#8a8a8a] shrink-0" />
        <p class="flex-1 text-xs text-[#8a8a8a] truncate leading-normal">
          Search for nodes or inputs
        </p>
      </div>
    </div>

    <div class="h-px bg-[#55565e] shrink-0 w-full" />

    <!-- ③ Content: Nodes (Missing Node Packs) -->
    <div class="flex-1 overflow-y-auto min-w-0">
      <div class="px-4">
        <!-- Section Header -->
        <div class="flex h-8 items-center justify-center w-full">
          <div class="flex items-center justify-center size-6 shrink-0">
            <i class="icon-[lucide--octagon-alert] size-4 text-[#e04e48]" />
          </div>
          <p class="flex-1 min-w-0 text-sm text-[#e04e48] whitespace-pre-wrap">Missing Node Packs</p>
          <div
            class="flex h-8 items-center justify-center overflow-hidden p-2 rounded-lg bg-[#262729] shrink-0 cursor-pointer hover:bg-[#303133]"
            @click="onInstallAll"
          >
            <span class="text-sm text-white">Install All</span>
          </div>
          <div
            class="group flex h-8 items-center justify-center overflow-hidden p-2 rounded-lg shrink-0 cursor-pointer"
            @click="isSectionCollapsed = !isSectionCollapsed"
          >
            <i
              class="icon-[lucide--chevron-up] size-4 text-[#8a8a8a] group-hover:text-white transition-all"
              :class="isSectionCollapsed ? '-rotate-180' : ''"
            />
          </div>
        </div>
        <div class="h-2" />

        <div class="-mx-4 border-b border-[#55565e]">
          <Transition :css="false" @enter="enterTransition" @leave="leaveTransition">
            <div v-if="!isSectionCollapsed" class="px-4 pb-2">
              <div v-for="pack in MOCK_MISSING_PACKS" :key="pack.id" class="flex flex-col w-full group/card mb-1">
                <!-- Widget Header -->
                <div class="flex h-8 items-center w-full">
                  <p class="flex-1 min-w-0 text-sm text-white overflow-hidden text-ellipsis whitespace-nowrap">
                    {{ pack.displayName }}
                  </p>
                  <div
                    class="flex h-8 items-center justify-center overflow-hidden p-2 rounded-lg shrink-0 cursor-pointer hover:bg-[#262729]"
                    @click="emit('open-manager', pack)"
                  >
                    <i class="icon-[lucide--info] size-4 text-white" />
                  </div>
                  <div
                    class="flex h-8 items-center justify-center overflow-hidden p-2 rounded-lg shrink-0 cursor-pointer hover:bg-[#262729]"
                    @click="emit('locate', pack)"
                  >
                    <i class="icon-[lucide--locate] size-4 text-white" />
                  </div>
                </div>

                <!-- Install button -->
                <div class="flex items-start w-full pt-1 pb-2">
                  <div
                    class="flex flex-1 h-8 items-center justify-center overflow-hidden p-2 rounded-lg min-w-0 transition-colors select-none"
                    :class="[
                      getInstallState(pack.id) === 'idle'
                        ? 'bg-[#262729] cursor-pointer hover:bg-[#303133]'
                        : getInstallState(pack.id) === 'error'
                          ? 'bg-[#3a2020] cursor-pointer hover:bg-[#4a2a2a]'
                          : 'bg-[#262729] opacity-60 cursor-default'
                    ]"
                    @click="onInstall(pack)"
                  >
                    <svg
                      v-if="getInstallState(pack.id) === 'installing'"
                      class="animate-spin size-4 text-white shrink-0"
                      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                    >
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <i
                      v-else-if="getInstallState(pack.id) === 'error'"
                      class="icon-[lucide--triangle-alert] size-4 text-[#f59e0b] shrink-0"
                    />
                    <i v-else class="icon-[lucide--download] size-4 text-white shrink-0" />
                    <span class="text-sm text-white ml-1.5 shrink-0">
                      {{ getInstallState(pack.id) === 'installing' ? 'Installing...' : 'Install node pack' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Transition>

          <Transition
            enter-active-class="transition-opacity duration-300 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-200 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="hasSuccessfulInstall && !isSectionCollapsed" class="px-4 pb-4 pt-1">
              <Button
                variant="primary"
                class="w-full h-9 justify-center gap-2 text-sm font-semibold"
                @click="resetAll"
              >
                <i class="icon-[lucide--refresh-cw] size-4" />
                Apply Changes
              </Button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <div class="h-px bg-[#55565e] shrink-0 w-full" />
  </div>
</template>
