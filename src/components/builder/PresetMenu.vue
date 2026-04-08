<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { BUILTIN_PRESET_IDS, useAppPresets } from '@/composables/useAppPresets'
import type { PresetDisplayMode } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useDialogService } from '@/services/dialogService'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const { presets, savePreset, deletePreset, applyPreset } = useAppPresets()
const appModeStore = useAppModeStore()
const { presetDisplayMode } = storeToRefs(appModeStore)

const builtinPresets = [
  {
    id: BUILTIN_PRESET_IDS.min,
    label: () => t('linearMode.presets.builtinMin'),
    icon: 'icon-[lucide--arrow-down-to-line]'
  },
  {
    id: BUILTIN_PRESET_IDS.mid,
    label: () => t('linearMode.presets.builtinMid'),
    icon: 'icon-[lucide--minus]'
  },
  {
    id: BUILTIN_PRESET_IDS.max,
    label: () => t('linearMode.presets.builtinMax'),
    icon: 'icon-[lucide--arrow-up-to-line]'
  }
]

const displayModes: { value: PresetDisplayMode; label: () => string }[] = [
  { value: 'tabs', label: () => t('linearMode.presets.displayTabs') },
  { value: 'buttons', label: () => t('linearMode.presets.displayButtons') },
  { value: 'menu', label: () => t('linearMode.presets.displayMenu') }
]

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
</script>
<template>
  <Popover>
    <template #button>
      <Button
        variant="textonly"
        size="sm"
        :aria-label="t('linearMode.presets.label')"
        :class="
          cn(
            'gap-1 text-xs text-muted-foreground hover:text-base-foreground',
            presets.length > 0 && 'text-base-foreground'
          )
        "
      >
        <i class="icon-[lucide--bookmark]" />
        {{ t('linearMode.presets.label') }}
      </Button>
    </template>
    <template #default="{ close }">
      <div class="flex min-w-48 flex-col">
        <!-- Built-in quick presets -->
        <div
          class="px-3 py-1 text-xs font-medium text-muted-foreground"
          v-text="t('linearMode.presets.builtinSection')"
        />
        <div class="flex gap-1 px-2 pb-2">
          <button
            v-for="bp in builtinPresets"
            :key="bp.id"
            class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-secondary-background-hover"
            @click="
              () => {
                applyPreset(bp.id)
                close()
              }
            "
          >
            <i :class="cn(bp.icon, 'size-3')" />
            {{ bp.label() }}
          </button>
        </div>

        <!-- Saved presets -->
        <div class="border-t border-border-subtle">
          <div
            class="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground"
            v-text="t('linearMode.presets.savedSection')"
          />
          <div
            v-if="presets.length === 0"
            class="px-3 py-1.5 text-xs text-muted-foreground"
            v-text="t('linearMode.presets.empty')"
          />
          <div
            v-for="preset in presets"
            :key="preset.id"
            class="group flex items-center gap-2 rounded-sm px-3 py-1.5 hover:bg-secondary-background-hover"
          >
            <button
              class="flex-1 cursor-pointer truncate text-left text-sm"
              @click="
                () => {
                  applyPreset(preset.id)
                  close()
                }
              "
              v-text="preset.name"
            />
            <button
              class="hover:text-danger invisible shrink-0 cursor-pointer text-muted-foreground group-hover:visible"
              :aria-label="t('g.remove')"
              @click="deletePreset(preset.id)"
            >
              <i class="icon-[lucide--x] size-3.5" />
            </button>
          </div>
        </div>

        <!-- Save action -->
        <div class="border-t border-border-subtle pt-1">
          <button
            class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm hover:bg-secondary-background-hover"
            @click="
              () => {
                handleSave()
                close()
              }
            "
          >
            <i class="icon-[lucide--plus] size-3.5" />
            {{ t('linearMode.presets.save') }}
          </button>
        </div>

        <!-- Display mode -->
        <div class="border-t border-border-subtle pt-1">
          <div
            class="px-3 py-1 text-xs font-medium text-muted-foreground"
            v-text="t('linearMode.presets.displayAs')"
          />
          <div class="flex gap-1 px-2 pb-1">
            <button
              v-for="dm in displayModes"
              :key="dm.value"
              :class="
                cn(
                  'flex-1 cursor-pointer rounded-md px-2 py-1 text-xs',
                  presetDisplayMode === dm.value
                    ? 'bg-secondary-background-hover font-medium'
                    : 'hover:bg-secondary-background-hover'
                )
              "
              @click="setDisplayMode(dm.value)"
              v-text="dm.label()"
            />
          </div>
        </div>
      </div>
    </template>
  </Popover>
</template>
