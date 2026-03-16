<template>
  <div class="flex items-center gap-2">
    <Button v-if="showSaveButton" size="lg" @click="handleSavePreset">
      {{ $t('g.keybindingPresets.saveChanges') }}
    </Button>
    <Select v-model="selectedPreset">
      <SelectTrigger class="w-64">
        <SelectValue :placeholder="$t('g.keybindingPresets.default')">
          {{ displayLabel }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent class="max-w-64 min-w-0 **:[[role=listbox]]:gap-1">
        <div class="max-w-60">
          <SelectItem
            value="default"
            class="max-w-60 p-2 data-[state=checked]:bg-transparent"
          >
            {{ $t('g.keybindingPresets.default') }}
          </SelectItem>
          <SelectItem
            v-for="name in presetNames"
            :key="name"
            :value="name"
            class="max-w-60 p-2 data-[state=checked]:bg-transparent"
          >
            {{ name }}
          </SelectItem>
          <hr class="h-px max-w-60 border border-border-default" />
          <button
            class="relative flex w-full max-w-60 cursor-pointer items-center justify-between gap-3 rounded-sm border-none bg-transparent p-2 text-sm outline-none select-none hover:bg-secondary-background-hover focus:bg-secondary-background-hover"
            @click.stop="handleImportFromDropdown"
          >
            <span class="truncate">
              {{ $t('g.keybindingPresets.importKeybindingPreset') }}
            </span>
            <i
              class="icon-[lucide--file-input] shrink-0 text-base-foreground"
              aria-hidden="true"
            />
          </button>
        </div>
      </SelectContent>
    </Select>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import { useKeybindingPresetService } from '@/platform/keybindings/presetService'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'

const { presetNames } = defineProps<{
  presetNames: string[]
}>()

const emit = defineEmits<{
  'presets-changed': []
}>()

const { t } = useI18n()
const keybindingStore = useKeybindingStore()
const presetService = useKeybindingPresetService()

const selectedPreset = ref(keybindingStore.currentPresetName)

const displayLabel = computed(() => {
  const name =
    selectedPreset.value === 'default'
      ? t('g.keybindingPresets.default')
      : selectedPreset.value
  return keybindingStore.isCurrentPresetModified ? `${name} *` : name
})

watch(selectedPreset, async (newValue) => {
  if (newValue !== keybindingStore.currentPresetName) {
    await presetService.switchPreset(newValue)
    selectedPreset.value = keybindingStore.currentPresetName
    emit('presets-changed')
  }
})

watch(
  () => keybindingStore.currentPresetName,
  (name) => {
    selectedPreset.value = name
  }
)

const showSaveButton = computed(
  () =>
    keybindingStore.currentPresetName !== 'default' &&
    keybindingStore.isCurrentPresetModified
)

async function handleSavePreset() {
  await presetService.savePreset(keybindingStore.currentPresetName)
}

async function handleImportFromDropdown() {
  await presetService.importPreset()
  emit('presets-changed')
}
</script>
