<template>
  <Message severity="info">
    <template #icon>
      <i class="icon-[lucide--palette]" />
    </template>
    <div class="flex items-center justify-between">
      <div>
        {{ $t('settingsCategories.ColorPalette') }}
      </div>
      <div class="actions">
        <AppSingleSelect
          v-model="activePresetId"
          class="w-44"
          :options="paletteOptions"
        />
        <Button
          size="icon"
          variant="textonly"
          :title="$t('g.export')"
          @click="themeService.exportThemePreset(activePresetId)"
        >
          <i class="icon-[lucide--file-output]" />
        </Button>
        <Button
          size="icon"
          variant="textonly"
          :title="$t('g.import')"
          @click="importCustomPalette"
        >
          <i class="icon-[lucide--file-input]" />
        </Button>
        <Button
          size="icon"
          variant="destructive-textonly"
          :title="$t('g.delete')"
          :disabled="!themeStore.isCustomPreset(activePresetId)"
          @click="themeService.deleteCustomThemePreset(activePresetId)"
        >
          <i class="icon-[lucide--trash-2]" />
        </Button>
      </div>
    </div>
  </Message>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Message from '@comfyorg/design-system/message/Message'
import AppSingleSelect from '@/components/common/AppSingleSelect.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useThemeService } from '@/platform/theme/themeService'
import { useThemeStore } from '@/platform/theme/themeStore'

const settingStore = useSettingStore()
const themeStore = useThemeStore()
const themeService = useThemeService()
const { presets, activePresetId } = storeToRefs(themeStore)
const paletteOptions = computed(() =>
  presets.value.map(({ id, name }) => ({ name, value: id }))
)

const importCustomPalette = async () => {
  const palette = await themeService.importThemePreset()
  if (palette) {
    await settingStore.set('Comfy.ColorPalette', palette.id)
  }
}
</script>
