<template>
  <Message severity="info" icon="pi pi-palette" pt:text="w-full">
    <div class="flex items-center justify-between">
      <div>
        {{ $t('settingsCategories.ColorPalette') }}
      </div>
      <div class="actions">
        <Select
          v-model="activePaletteId"
          class="w-44"
          :options="palettes"
          option-label="name"
          option-value="id"
        />
        <Button
          icon="pi pi-file-export"
          text
          :title="$t('g.export')"
          @click="colorPaletteService.exportColorPalette(activePaletteId)"
        />
        <Button
          icon="pi pi-file-import"
          text
          :title="$t('g.import')"
          @click="importCustomPalette"
        />
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          :title="$t('g.delete')"
          :disabled="!colorPaletteStore.isCustomPalette(activePaletteId)"
          @click="colorPaletteService.deleteCustomColorPalette(activePaletteId)"
        />
      </div>
    </div>
  </Message>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'

import { useColorPaletteService } from '@/services/colorPaletteService'
import { useSettingStore } from '@/stores/settingStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const settingStore = useSettingStore()
const colorPaletteStore = useColorPaletteStore()
const colorPaletteService = useColorPaletteService()
const { palettes, activePaletteId } = storeToRefs(colorPaletteStore)

const importCustomPalette = async () => {
  const palette = await colorPaletteService.importColorPalette()
  if (palette) {
    await settingStore.set('Comfy.ColorPalette', palette.id)
  }
}
</script>
