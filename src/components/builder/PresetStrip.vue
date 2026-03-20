<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { BUILTIN_PRESET_IDS, useAppPresets } from '@/composables/useAppPresets'
import type { PresetDisplayMode } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useDialogService } from '@/services/dialogService'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

const { displayMode = 'tabs' } = defineProps<{
  displayMode?: PresetDisplayMode
}>()

const { t } = useI18n()
const {
  presets,
  savePreset,
  deletePreset,
  renamePreset,
  applyPreset,
  updatePreset
} = useAppPresets()
const appModeStore = useAppModeStore()
const { presetDisplayMode } = storeToRefs(appModeStore)

const activePresetId = ref<string>('')

const displayModes: { value: PresetDisplayMode; label: () => string }[] = [
  { value: 'tabs', label: () => t('linearMode.presets.displayTabs') },
  { value: 'buttons', label: () => t('linearMode.presets.displayButtons') },
  { value: 'menu', label: () => t('linearMode.presets.displayMenu') }
]

const allPresets = computed(() => [
  {
    id: BUILTIN_PRESET_IDS.min,
    name: t('linearMode.presets.builtinMin'),
    tooltip: t('linearMode.presets.builtinMinTip'),
    builtin: true
  },
  {
    id: BUILTIN_PRESET_IDS.mid,
    name: t('linearMode.presets.builtinMid'),
    tooltip: t('linearMode.presets.builtinMidTip'),
    builtin: true
  },
  {
    id: BUILTIN_PRESET_IDS.max,
    name: t('linearMode.presets.builtinMax'),
    tooltip: t('linearMode.presets.builtinMaxTip'),
    builtin: true
  },
  ...presets.value.map((p) => ({
    id: p.id,
    name: p.name,
    tooltip: p.name,
    builtin: false
  }))
])

function handleSelect(id: string) {
  activePresetId.value = id
  applyPreset(id)
}

function setDisplayMode(mode: PresetDisplayMode) {
  presetDisplayMode.value = mode
  appModeStore.persistLinearData()
}

async function handleSave() {
  const name = await useDialogService().prompt({
    title: t('linearMode.presets.saveTitle'),
    message: t('linearMode.presets.saveMessage'),
    placeholder: t('linearMode.presets.namePlaceholder')
  })
  if (name?.trim()) savePreset(name.trim())
}

async function handleRename(id: string, currentName: string) {
  const name = await useDialogService().prompt({
    title: t('g.rename'),
    message: '',
    defaultValue: currentName
  })
  if (name?.trim()) renamePreset(id, name.trim())
}
</script>
<template>
  <div class="rounded-lg pb-2">
    <!-- Label row: "Presets" + hamburger menu — matches widget label pattern -->
    <div class="mt-1.5 flex min-h-8 items-center gap-1 px-3">
      <span class="truncate text-sm/8">
        {{ t('linearMode.presets.label') }}
      </span>
      <div class="flex-1" />
      <Popover>
        <template #button>
          <Button
            variant="textonly"
            size="icon"
            data-testid="preset-actions-menu"
          >
            <i class="icon-[lucide--ellipsis]" />
          </Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col p-1">
            <div
              class="my-1 flex cursor-pointer flex-row gap-4 rounded-sm p-2 hover:bg-secondary-background-hover"
              @click="
                () => {
                  handleSave()
                  close()
                }
              "
            >
              <i class="icon-[lucide--plus]" />
              {{ t('linearMode.presets.save') }}
            </div>
            <template v-for="preset in presets" :key="preset.id">
              <div class="my-1 flex flex-row items-center gap-4 rounded-sm p-2">
                <span class="flex-1 truncate text-sm" v-text="preset.name" />
                <i
                  v-tooltip.top="t('linearMode.presets.overwrite')"
                  class="icon-[lucide--save] cursor-pointer text-muted-foreground transition-transform duration-150 ease-in-out hover:text-base-foreground active:scale-75"
                  @click="updatePreset(preset.id)"
                />
                <i
                  class="icon-[lucide--pencil] cursor-pointer text-muted-foreground hover:text-base-foreground"
                  @click="handleRename(preset.id, preset.name)"
                />
                <i
                  class="hover:text-danger icon-[lucide--x] cursor-pointer text-muted-foreground"
                  @click="
                    () => {
                      deletePreset(preset.id)
                      close()
                    }
                  "
                />
              </div>
            </template>
            <div
              v-if="presets.length > 0"
              class="w-full border-b border-border-subtle"
            />
            <div
              class="my-1 px-2 text-xs font-medium text-muted-foreground"
              v-text="t('linearMode.presets.displayAs')"
            />
            <div class="flex gap-1 px-1 pb-1">
              <div
                v-for="dm in displayModes"
                :key="dm.value"
                :class="
                  cn(
                    'my-1 flex-1 cursor-pointer rounded-sm p-2 text-center text-xs',
                    presetDisplayMode === dm.value
                      ? 'bg-secondary-background-hover'
                      : 'hover:bg-secondary-background-hover'
                  )
                "
                @click="setDisplayMode(dm.value)"
                v-text="dm.label()"
              />
            </div>
          </div>
        </template>
      </Popover>
    </div>

    <!-- Preset switcher -->
    <div class="px-3">
      <!-- Tabs mode -->
      <ToggleGroup
        v-if="displayMode === 'tabs'"
        type="single"
        :model-value="activePresetId"
        class="rounded-lg border border-border-subtle p-0.5"
        @update:model-value="(v: unknown) => v && handleSelect(String(v))"
      >
        <Tooltip
          v-for="p in allPresets"
          :key="p.id"
          :text="p.tooltip"
          side="bottom"
        >
          <ToggleGroupItem :value="p.id" size="sm">
            {{ p.name }}
          </ToggleGroupItem>
        </Tooltip>
      </ToggleGroup>

      <!-- Buttons mode -->
      <div v-else-if="displayMode === 'buttons'" class="flex flex-wrap gap-1">
        <Button
          v-for="p in allPresets"
          :key="p.id"
          size="sm"
          :variant="activePresetId === p.id ? 'secondary' : 'textonly'"
          :class="
            cn('text-xs', activePresetId === p.id && 'ring-1 ring-primary')
          "
          @click="handleSelect(p.id)"
        >
          {{ p.name }}
        </Button>
      </div>

      <!-- Menu/dropdown mode -->
      <select
        v-else-if="displayMode === 'menu'"
        :value="activePresetId"
        class="w-full rounded-md border border-border-subtle bg-comfy-menu-bg px-2 py-1 text-sm"
        @change="(e) => handleSelect((e.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>
          {{ t('linearMode.presets.label') }}
        </option>
        <option
          v-for="p in allPresets"
          :key="p.id"
          :value="p.id"
          v-text="p.name"
        />
      </select>
    </div>
  </div>
</template>
