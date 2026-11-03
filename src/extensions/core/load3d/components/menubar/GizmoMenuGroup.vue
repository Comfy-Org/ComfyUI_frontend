<template>
  <Button
    variant="textonly"
    size="unset"
    :tooltip="t('load3d.gizmo.toggle')"
    tooltip-side="bottom"
    :class="actionClass(gizmoEnabled)"
    :aria-pressed="gizmoEnabled"
    type="button"
    :aria-label="compact ? t('load3d.gizmo.toggle') : undefined"
    @click="toggleGizmo"
  >
    <i class="icon-[lucide--axis-3d]" />
    <span v-if="!compact">{{ t('load3d.gizmo.toggle') }}</span>
  </Button>

  <template v-if="gizmoEnabled">
    <template v-if="!compact">
      <Button
        v-for="m in modeDefs"
        :key="m.mode"
        variant="textonly"
        size="unset"
        :tooltip="t(m.labelKey)"
        tooltip-side="bottom"
        :class="actionClass(gizmoMode === m.mode)"
        :aria-pressed="gizmoMode === m.mode"
        type="button"
        @click="setGizmoMode(m.mode)"
      >
        <i :class="m.icon" />
        <span>{{ t(m.labelKey) }}</span>
      </Button>
      <Button
        variant="textonly"
        size="unset"
        :tooltip="t('load3d.gizmo.reset')"
        tooltip-side="bottom"
        :class="actionClass(false)"
        type="button"
        @click="resetGizmoTransform"
      >
        <i class="icon-[lucide--rotate-ccw]" />
        <span>{{ t('load3d.gizmo.reset') }}</span>
      </Button>
    </template>
    <PopoverRoot v-else v-model:open="modeMenuOpen">
      <PopoverTrigger as-child>
        <Button
          variant="textonly"
          size="unset"
          :tooltip="activeModeLabel"
          tooltip-side="bottom"
          :class="actionClass(false)"
          type="button"
          :aria-label="activeModeLabel"
          data-testid="gizmo-mode-menu"
        >
          <i :class="activeModeDef.icon" />
          <i class="icon-[lucide--chevron-down] opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" :side-offset="8" :class="menuPanelClass">
        <button
          v-for="m in modeDefs"
          :key="m.mode"
          type="button"
          :aria-pressed="gizmoMode === m.mode"
          :class="
            cn(menuButtonClass, gizmoMode === m.mode && selectedMenuButtonClass)
          "
          @click="selectMode(m.mode)"
        >
          <i :class="m.icon" />
          {{ t(m.labelKey) }}
        </button>
        <button type="button" :class="menuButtonClass" @click="selectReset">
          <i class="icon-[lucide--rotate-ccw]" />
          {{ t('load3d.gizmo.reset') }}
        </button>
      </PopoverContent>
    </PopoverRoot>
  </template>
</template>

<script setup lang="ts">
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import {
  actionClass,
  menuPanelClass
} from '@/extensions/core/load3d/components/menubar/menuBarStyles'
import { usePopoverExclusivity } from '@/extensions/core/load3d/components/menubar/usePopoverExclusivity'
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import {
  menuButtonClass,
  selectedMenuButtonClass
} from '@comfyorg/design-system/lib/menu/menuStyles'
import type {
  GizmoMode,
  ModelConfig
} from '@comfyorg/viewport3d/load3d/interfaces'

const { compact = false } = defineProps<{
  compact?: boolean
}>()

const config = defineModel<ModelConfig>('config')

const emit = defineEmits<{
  (e: 'toggleGizmo', enabled: boolean): void
  (e: 'setGizmoMode', mode: GizmoMode): void
  (e: 'resetGizmoTransform'): void
}>()

const { t } = useI18n()

const modeDefs = [
  {
    mode: 'translate' as GizmoMode,
    icon: 'icon-[lucide--move]',
    labelKey: 'load3d.gizmo.translate'
  },
  {
    mode: 'rotate' as GizmoMode,
    icon: 'icon-[lucide--rotate-3d]',
    labelKey: 'load3d.gizmo.rotate'
  },
  {
    mode: 'scale' as GizmoMode,
    icon: 'icon-[lucide--scale-3d]',
    labelKey: 'load3d.gizmo.scale'
  }
]

const gizmoEnabled = computed(() => config.value?.gizmo?.enabled ?? false)
const gizmoMode = computed(() => config.value?.gizmo?.mode ?? 'translate')
const activeModeDef = computed(
  () => modeDefs.find((m) => m.mode === gizmoMode.value) ?? modeDefs[0]
)
const activeModeLabel = computed(() => t(activeModeDef.value.labelKey))

const modeMenuOpen = usePopoverExclusivity()('gizmo-mode')
const modeMenuAvailable = computed(() => compact && gizmoEnabled.value)
watch(modeMenuAvailable, (available) => {
  if (!available) modeMenuOpen.value = false
})

function toggleGizmo() {
  const gizmo = config.value?.gizmo
  if (!gizmo) return
  gizmo.enabled = !gizmo.enabled
  emit('toggleGizmo', gizmo.enabled)
}

function setGizmoMode(mode: GizmoMode) {
  const gizmo = config.value?.gizmo
  if (!gizmo) return
  gizmo.mode = mode
  emit('setGizmoMode', mode)
}

function selectMode(mode: GizmoMode) {
  setGizmoMode(mode)
  modeMenuOpen.value = false
}

function selectReset() {
  resetGizmoTransform()
  modeMenuOpen.value = false
}

function resetGizmoTransform() {
  emit('resetGizmoTransform')
}
</script>
