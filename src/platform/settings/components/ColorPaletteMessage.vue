<template>
  <Message severity="info" icon="pi pi-palette" pt:text="w-full">
    <div class="flex items-center justify-between">
      <div>
        {{ $t('settingsCategories.ColorPalette') }}
      </div>
      <div class="actions">
        <SingleSelect
          v-model="activePaletteId"
          size="md"
          class="w-44"
          :options="paletteOptions"
        />
        <Button
          size="icon"
          variant="textonly"
          :title="$t('g.export')"
          @click="colorPaletteService.exportColorPalette(activePaletteId)"
        >
          <i class="icon-[lucide--file-up]" />
        </Button>
        <Button
          size="icon"
          variant="textonly"
          :title="$t('g.import')"
          @click="importCustomPalette"
        >
          <i class="icon-[lucide--file-down]" />
        </Button>
        <Button
          size="icon"
          variant="destructive-textonly"
          :title="$t('g.delete')"
          :disabled="!colorPaletteStore.isCustomPalette(activePaletteId)"
          @click="colorPaletteService.deleteCustomColorPalette(activePaletteId)"
        >
          <i class="icon-[lucide--trash-2]" />
        </Button>
      </div>
    </div>
  </Message>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Message from 'primevue/message'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const settingStore = useSettingStore()
const colorPaletteStore = useColorPaletteStore()
const colorPaletteService = useColorPaletteService()
const { palettes, activePaletteId } = storeToRefs(colorPaletteStore)

const paletteOptions = computed(() =>
  palettes.value.map((p) => ({ name: p.name, value: p.id }))
)

const importCustomPalette = async () => {
  const palette = await colorPaletteService.importColorPalette()
  if (palette) {
    await settingStore.set('Comfy.ColorPalette', palette.id)
  }
}
</script>
