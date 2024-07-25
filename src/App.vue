<template>
  <div class="relative min-h-screen">
    <router-view />
    <dt
      v-if="mainLoadingSpinner"
      class="absolute inset-0 bg-zinc-950/80 z-[1000] flex items-center justify-center"
    >
      <Loader class="text-[30px] text-zinc-300/80" />
    </dt>
  </div>

  <VueConfirm />
  <VueToast />

  <teleport to="body">
    <div id="comfy-user-selection" class="comfy-user-selection">
      <main class="comfy-user-selection-inner">
        <h1>ComfyUI</h1>
        <form>
          <section>
            <label
              >New user:
              <input placeholder="Enter a username" />
            </label>
          </section>
          <div class="comfy-user-existing">
            <span class="or-separator">OR</span>
            <section>
              <label>
                Existing user:
                <select>
                  <option hidden disabled selected value>Select a user</option>
                </select>
              </label>
            </section>
          </div>
          <footer>
            <span class="comfy-user-error">&nbsp;</span>
            <button class="comfy-btn comfy-user-button-next">Next</button>
          </footer>
        </form>
      </main>
    </div>
  </teleport>

  <!-- TODO refactor this -->
  <LiteGraphCanvasSplitterOverlay>
    <template #side-bar-panel>
      <SideToolBar />
    </template>
  </LiteGraphCanvasSplitterOverlay>

  <teleport to="#blockui">
    <BlockUI :open="status.spinning" />
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { VueConfirm } from '@/components/UI/VueConfirm/VueConfirm'
import { VueToast } from '@/components/UI/VueToast/VueToast'
import { useMainStore, useSettingStore, storeToRefs } from '@/stores'
import BlockUI from '@/components/UI/BlockUI.vue'
import Loader from '@/components/UI/Loader.vue'
import SideToolBar from '@/components/sidebar/SideToolBar.vue'
import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'

const mainStore = useMainStore()
const settingsStore = useSettingStore()
const { status } = storeToRefs(mainStore)
const mainLoadingSpinner = ref(false)

const theme = computed<string>(() => settingsStore.get('Comfy.ColorPalette'))

watch(
  theme,
  (newTheme) => {
    const DARK_THEME_CLASS = 'dark-theme'
    const isDarkTheme = newTheme !== 'light'
    if (isDarkTheme) {
      document.body.classList.add(DARK_THEME_CLASS)
    } else {
      document.body.classList.remove(DARK_THEME_CLASS)
    }
  },
  { immediate: true }
)
</script>
