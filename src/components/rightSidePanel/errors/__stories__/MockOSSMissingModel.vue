<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from '@/components/ui/button/Button.vue'

// Props / Emits

const emit = defineEmits<{
  'locate': [name: string],
}>()

// Mock Data

interface MissingModel {
  id: string
  name: string
  type: string
}

const INITIAL_MISSING_MODELS: Record<string, MissingModel[]> = {
  'Lora': [
    { id: 'm1', name: 'Flat_color_anime.safetensors', type: 'Lora' },
    { id: 'm2', name: 'Bokeh_blur_xl.safetensors', type: 'Lora' },
    { id: 'm3', name: 'Skin_texture_realism.safetensors', type: 'Lora' }
  ],
  'VAE': [
    { id: 'v1', name: 'vae-ft-mse-840000-ema-pruned.safetensors', type: 'VAE' },
    { id: 'v2', name: 'clear-vae-v1.safetensors', type: 'VAE' }
  ]
}

const LIBRARY_MODELS = [
  'v1-5-pruned-emaonly.safetensors',
  'sd_xl_base_1.0.safetensors',
  'dreamshaper_8.safetensors',
  'realisticVisionV51_v51VAE.safetensors'
]

// State

const collapsedCategories = ref<Record<string, boolean>>({
  'VAE': true
})

// Model Status: 'idle' | 'downloading' | 'downloaded' | 'using_library'
const importStatus = ref<Record<string, 'idle' | 'downloading' | 'downloaded' | 'using_library'>>({})
const downloadProgress = ref<Record<string, number>>({})
const downloadTimers = ref<Record<string, ReturnType<typeof setInterval>>>({})
const selectedLibraryModel = ref<Record<string, string>>({})

// Track hidden models (removed after clicking check button)
const removedModels = ref<Record<string, boolean>>({})

// Compute which categories have at least one visible model
const activeCategories = computed(() => {
  const result: Record<string, boolean> = {}
  for (const cat in INITIAL_MISSING_MODELS) {
    result[cat] = INITIAL_MISSING_MODELS[cat].some(m => !removedModels.value[m.id])
  }
  return result
})

// Tracks which model's library dropdown is currently open
const activeLibraryDropdown = ref<string | null>(null)

// Actions

function toggleLibraryDropdown(modelId: string) {
  if (activeLibraryDropdown.value === modelId) {
    activeLibraryDropdown.value = null
  } else {
    activeLibraryDropdown.value = modelId
  }
}

function selectFromLibrary(modelId: string, fileName: string) {
  selectedLibraryModel.value[modelId] = fileName
  importStatus.value[modelId] = 'using_library'
  activeLibraryDropdown.value = null
}

function startUpload(modelId: string) {
  if (downloadTimers.value[modelId]) {
    clearInterval(downloadTimers.value[modelId])
  }

  importStatus.value[modelId] = 'downloading'
  downloadProgress.value[modelId] = 0
  
  const startTime = Date.now()
  const duration = 3000 // Speed up for OSS simulation
  
  downloadTimers.value[modelId] = setInterval(() => {
    const elapsed = Date.now() - startTime
    const progress = Math.min((elapsed / duration) * 100, 100)
    downloadProgress.value[modelId] = progress
    
    if (progress >= 100) {
      clearInterval(downloadTimers.value[modelId])
      delete downloadTimers.value[modelId]
      importStatus.value[modelId] = 'downloaded'
    }
  }, 50)
}

function handleCheckClick(modelId: string) {
  if (importStatus.value[modelId] === 'downloaded' || importStatus.value[modelId] === 'using_library') {
    removedModels.value = { ...removedModels.value, [modelId]: true }
  }
}

function cancelImport(modelId: string) {
  if (downloadTimers.value[modelId]) {
    clearInterval(downloadTimers.value[modelId])
    delete downloadTimers.value[modelId]
  }
  importStatus.value[modelId] = 'idle'
  downloadProgress.value[modelId] = 0
  selectedLibraryModel.value[modelId] = ''
}

function resetAll() {
  for (const id in downloadTimers.value) {
    clearInterval(downloadTimers.value[id])
  }
  downloadTimers.value = {}
  importStatus.value = {}
  downloadProgress.value = {}
  selectedLibraryModel.value = {}
  removedModels.value = {}
  activeLibraryDropdown.value = null
}

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
    <!-- ① Nav Item -->
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

    <!-- ② Node Header -->
    <div class="flex flex-col gap-3 items-start px-4 shrink-0">
      <div class="flex gap-2 items-center w-full overflow-x-auto no-scrollbar">
        <div class="flex gap-1 h-8 items-center justify-center overflow-hidden px-2 rounded-lg shrink-0 bg-[#262729]">
          <span class="text-sm text-white">Error</span>
          <div class="flex items-center justify-center size-6 shrink-0">
            <i class="icon-[lucide--octagon-alert] size-4 text-[#e04e48]" />
          </div>
        </div>
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

      <div class="flex gap-2 h-8 items-center min-h-[32px] px-2 py-1.5 rounded-lg bg-[#262729] w-full">
        <i class="icon-[lucide--search] size-4 text-[#8a8a8a] shrink-0" />
        <p class="flex-1 text-xs text-[#8a8a8a] truncate leading-normal">
          Search for nodes or inputs
        </p>
      </div>
    </div>

    <div class="h-px bg-[#55565e] shrink-0 w-full" />

    <!-- ③ Content: Missing Models -->
    <div class="flex-1 overflow-y-auto min-w-0 no-scrollbar">
      <template v-for="(models, category) in INITIAL_MISSING_MODELS" :key="category">
        <div 
          v-if="activeCategories[category]"
          class="px-4 mb-4"
        >
          <!-- Category Header -->
          <div
            class="flex h-8 items-center justify-center w-full group"
            :class="category === 'VAE' ? 'cursor-default' : 'cursor-pointer'"
            @click="category !== 'VAE' && (collapsedCategories[category] = !collapsedCategories[category])"
          >
            <div class="flex items-center justify-center size-6 shrink-0">
              <i class="icon-[lucide--octagon-alert] size-4 text-[#e04e48]" />
            </div>
            <p class="flex-1 min-w-0 text-sm text-[#e04e48] whitespace-pre-wrap font-medium">
              {{ category }} ({{ models.filter(m => !removedModels[m.id]).length }})
            </p>
            <div class="flex h-8 items-center justify-center overflow-hidden p-2 rounded-lg shrink-0">
              <i
                class="icon-[lucide--chevron-up] size-4 text-[#8a8a8a] transition-all"
                :class="[
                  category !== 'VAE' ? 'group-hover:text-white' : '',
                  collapsedCategories[category] ? '-rotate-180' : ''
                ]"
              />
            </div>
          </div>

          <!-- Model List -->
          <Transition :css="false" @enter="enterTransition" @leave="leaveTransition">
            <div v-if="!collapsedCategories[category]" class="pt-2">
              <TransitionGroup :css="false" @enter="enterTransition" @leave="leaveTransition">
                <div v-for="model in models" v-show="!removedModels[model.id]" :key="model.id" class="flex flex-col w-full mb-6 last:mb-4">
                  
                  <!-- Model Header (Always visible) -->
                  <div class="flex h-8 items-center w-full gap-2 mb-1">
                    <i class="icon-[lucide--file-check] size-4 text-white shrink-0" />
                    <p class="flex-1 min-w-0 text-sm font-medium text-white overflow-hidden text-ellipsis whitespace-nowrap">
                      {{ model.name }}
                    </p>
                    
                    <div
                      class="flex h-8 items-center justify-center overflow-hidden p-2 rounded-lg shrink-0 transition-colors"
                      :class="[
                        (importStatus[model.id] === 'downloaded' || importStatus[model.id] === 'using_library')
                          ? 'cursor-pointer hover:bg-[#1e2d3d] bg-[#1e2d3d]' 
                          : 'opacity-20 cursor-default'
                      ]"
                      @click="handleCheckClick(model.id)"
                    >
                      <i 
                        class="icon-[lucide--check] size-4" 
                        :class="(importStatus[model.id] === 'downloaded' || importStatus[model.id] === 'using_library') ? 'text-[#3b82f6]' : 'text-white'"
                      />
                    </div>
                    
                    <div
                      class="flex h-8 items-center justify-center overflow-hidden p-2 rounded-lg shrink-0 cursor-pointer hover:bg-[#262729]"
                      @click="emit('locate', model.name)"
                    >
                      <i class="icon-[lucide--locate] size-4 text-white" />
                    </div>
                  </div>

                  <!-- Input or Progress Area -->
                  <div class="relative mt-1">
                    <Transition :css="false" @enter="enterTransition" @leave="leaveTransition">
                      <div 
                        v-if="importStatus[model.id] && importStatus[model.id] !== 'idle'"
                        class="relative bg-white/5 border border-[#55565e] rounded-lg overflow-hidden flex items-center p-2 gap-2"
                      >
                        <div 
                          v-if="importStatus[model.id] === 'downloading'"
                          class="absolute inset-y-0 left-0 bg-[#3b82f6]/10 transition-all duration-100 ease-linear pointer-events-none"
                          :style="{ width: downloadProgress[model.id] + '%' }"
                        />

                        <div class="relative z-10 size-[32px] flex items-center justify-center shrink-0">
                          <i class="icon-[lucide--file-check] size-5 text-[#8a8a8a]" />
                        </div>

                        <div class="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
                          <span class="text-[12px] font-medium text-white truncate leading-tight">
                            {{ importStatus[model.id] === 'using_library' ? selectedLibraryModel[model.id] : model.name }}
                          </span>
                          <span class="text-[12px] text-[#8a8a8a] leading-tight mt-0.5">
                            <template v-if="importStatus[model.id] === 'downloading'">Uploading ...</template>
                            <template v-else-if="importStatus[model.id] === 'downloaded'">Uploaded</template>
                            <template v-else-if="importStatus[model.id] === 'using_library'">Using from Library</template>
                          </span>
                        </div>

                        <div 
                          class="relative z-10 size-6 flex items-center justify-center text-[#55565e] hover:text-white cursor-pointer transition-colors shrink-0"
                          @click="cancelImport(model.id)"
                        >
                          <i class="icon-[lucide--circle-x] size-4" />
                        </div>
                      </div>
                    </Transition>

                    <!-- IDLE / UPLOAD AREA -->
                    <Transition :css="false" @enter="enterTransition" @leave="leaveTransition">
                      <div v-if="!importStatus[model.id] || importStatus[model.id] === 'idle'" class="flex flex-col gap-2">
                        <Transition :css="false" @enter="enterTransition" @leave="leaveTransition">
                          <div v-if="!selectedLibraryModel[model.id]" class="flex flex-col gap-2">
                            <!-- Direct Upload Section -->
                            <div 
                              class="h-8 rounded-lg flex items-center justify-center border border-dashed border-[#55565e] hover:border-white transition-colors cursor-pointer group"
                              @click="startUpload(model.id)"
                            >
                              <span class="text-xs text-[#8a8a8a] group-hover:text-white">Upload .safetensors or .ckpt</span>
                            </div>

                            <div class="flex flex-col gap-2">
                              <div class="flex items-center justify-center py-0.5 font-bold text-[10px] text-[#8a8a8a]">OR</div>
                              <div class="relative">
                                <div 
                                  class="h-8 bg-[#262729] rounded-lg flex items-center px-3 cursor-pointer group/lib hover:border-[#494a50] border border-transparent"
                                  @click="toggleLibraryDropdown(model.id)"
                                >
                                  <span class="flex-1 text-xs text-white truncate">Use from Library</span>
                                  <i class="icon-[lucide--chevron-down] size-3.5 text-[#8a8a8a] group-hover/lib:text-white" />
                                </div>
                                <div v-if="activeLibraryDropdown === model.id" class="absolute top-full left-0 w-full mt-1 bg-[#26272b] border border-[#3f4045] rounded-lg shadow-xl z-50 overflow-hidden py-1">
                                  <div 
                                    v-for="libModel in LIBRARY_MODELS" 
                                    :key="libModel" 
                                    class="px-3 py-2 text-xs text-[#e2e2e4] hover:bg-[#323338] cursor-pointer flex items-center gap-2"
                                    @click="selectFromLibrary(model.id, libModel)"
                                  >
                                    <i class="icon-[lucide--file-code] size-3.5 text-[#8a8a8a]" />
                                    {{ libModel }}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Transition>
                      </div>
                    </Transition>
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </Transition>
          
          <div class="-mx-4 mt-6 h-px bg-[#55565e]" />
        </div>
      </template>

      <div v-if="Object.keys(removedModels).length > 0" class="flex justify-center py-8">
        <Button variant="muted-textonly" class="text-xs gap-2 hover:text-white" @click="resetAll">
          <i class="icon-[lucide--rotate-ccw] size-3.5" />
          Reset Storybook Flow
        </Button>
      </div>
    </div>

    <div class="h-px bg-[#55565e] shrink-0 w-full" />
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
