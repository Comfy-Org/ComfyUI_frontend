<template>
  <div class="flex flex-col">
    <div class="relative">
      <Button
        ref="triggerRef"
        v-tooltip.right="{
          value: $t('load3d.hdri.label'),
          showDelay: 300
        }"
        size="icon"
        variant="textonly"
        :class="
          cn(
            'rounded-full',
            hdriConfig?.enabled && 'bg-button-active-surface text-highlight'
          )
        "
        :aria-label="$t('load3d.hdri.label')"
        :disabled="!hdriSupported"
        @click="toggleHDRIPanel"
      >
        <i class="pi pi-globe text-lg text-base-foreground" />
      </Button>

      <div
        v-show="showPanel"
        ref="panelRef"
        class="absolute top-0 left-12 z-30 w-[200px] rounded-lg bg-black/50 p-3 shadow-lg"
      >
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              class="w-full truncate text-xs"
              @click="triggerFileInput"
            >
              {{
                hdriConfig?.hdriPath
                  ? $t('load3d.hdri.changeFile')
                  : $t('load3d.hdri.uploadFile')
              }}
            </Button>
            <Button
              v-if="hdriConfig?.hdriPath"
              size="icon"
              variant="textonly"
              :aria-label="$t('load3d.hdri.removeFile')"
              @click="onRemoveHDRI"
            >
              <i class="pi pi-times text-sm text-base-foreground" />
            </Button>
          </div>

          <template v-if="hdriConfig?.hdriPath">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm text-base-foreground">{{
                $t('load3d.hdri.label')
              }}</span>
              <SwitchRoot
                :model-value="hdriConfig?.enabled ?? false"
                class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors data-[state=checked]:bg-primary-background data-[state=unchecked]:bg-node-stroke"
                @update:model-value="onEnabledChange"
              >
                <SwitchThumb
                  class="pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
                />
              </SwitchRoot>
            </div>

            <div class="flex items-center justify-between gap-2">
              <span class="text-sm text-base-foreground">{{
                $t('load3d.hdri.showAsBackground')
              }}</span>
              <SwitchRoot
                :model-value="hdriConfig?.showAsBackground ?? false"
                class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors data-[state=checked]:bg-primary-background data-[state=unchecked]:bg-node-stroke"
                @update:model-value="onShowAsBackgroundChange"
              >
                <SwitchThumb
                  class="pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
                />
              </SwitchRoot>
            </div>

            <div v-if="hdriConfig?.enabled" class="flex flex-col gap-1">
              <span class="text-sm text-base-foreground">{{
                $t('load3d.hdri.intensity')
              }}</span>
              <Slider
                :model-value="[hdriConfig?.intensity ?? 1]"
                class="w-full"
                :min="0"
                :max="5"
                :step="0.1"
                @update:model-value="onIntensityChange"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      :accept="SUPPORTED_HDRI_EXTENSIONS_ACCEPT"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import { useDismissableOverlay } from '@/composables/useDismissableOverlay'
import {
  SUPPORTED_HDRI_EXTENSIONS,
  SUPPORTED_HDRI_EXTENSIONS_ACCEPT
} from '@/extensions/core/load3d/constants'
import type { HDRIConfig } from '@/extensions/core/load3d/interfaces'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const { hdriSupported = false } = defineProps<{
  hdriSupported?: boolean
}>()

const hdriConfig = defineModel<HDRIConfig>('hdriConfig')

const emit = defineEmits<{
  (e: 'updateHdriFile', file: File | null): void
}>()

const showPanel = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<InstanceType<typeof Button> | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

useDismissableOverlay({
  isOpen: showPanel,
  getOverlayEl: () => panelRef.value,
  getTriggerEl: () => triggerRef.value?.$el ?? null,
  onDismiss: () => {
    showPanel.value = false
  }
})

function toggleHDRIPanel() {
  if (!hdriSupported) return
  showPanel.value = !showPanel.value
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (file) {
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!SUPPORTED_HDRI_EXTENSIONS.has(ext)) {
      useToastStore().addAlert(t('toastMessages.unsupportedHDRIFormat'))
      return
    }
  }
  emit('updateHdriFile', file)
}

function onEnabledChange(value: boolean) {
  if (!hdriConfig.value) return
  hdriConfig.value = { ...hdriConfig.value, enabled: value }
}

function onShowAsBackgroundChange(value: boolean) {
  if (!hdriConfig.value) return
  hdriConfig.value = { ...hdriConfig.value, showAsBackground: value }
}

function onIntensityChange(value: number[] | undefined) {
  if (!hdriConfig.value || !value?.length) return
  hdriConfig.value = { ...hdriConfig.value, intensity: value[0] }
}

function onRemoveHDRI() {
  emit('updateHdriFile', null)
  showPanel.value = false
}
</script>
