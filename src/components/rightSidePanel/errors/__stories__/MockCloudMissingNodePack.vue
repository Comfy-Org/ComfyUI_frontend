<script setup lang="ts">
import { ref } from 'vue'
import type { MissingNodePack } from './MockManagerDialog.vue'

// Props / Emits

const emit = defineEmits<{
  'locate': [pack: MissingNodePack]
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

// Helpers

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

    <!-- ③ Content: Nodes (Cloud Version) -->
    <div class="flex-1 overflow-y-auto min-w-0">
      <div class="px-4">
        <!-- Section Header: Unsupported Node Packs -->
        <div class="flex h-8 items-center justify-center w-full">
          <div class="flex items-center justify-center size-6 shrink-0">
            <i class="icon-[lucide--octagon-alert] size-4 text-[#e04e48]" />
          </div>
          <p class="flex-1 min-w-0 text-sm text-[#e04e48] whitespace-pre-wrap font-medium">Unsupported Node Packs</p>
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
        
        <!-- Cloud Warning Text -->
        <div v-if="!isSectionCollapsed" class="mt-3 mb-5">
          <p class="m-0 text-sm text-[#8a8a8a] leading-relaxed">
            This workflow requires custom nodes not yet available on Comfy Cloud.
          </p>
        </div>

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
                    @click="emit('locate', pack)"
                  >
                    <i class="icon-[lucide--locate] size-4 text-white" />
                  </div>
                </div>
                <!-- No Install button in Cloud version -->
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <div class="h-px bg-[#55565e] shrink-0 w-full" />
  </div>
</template>
