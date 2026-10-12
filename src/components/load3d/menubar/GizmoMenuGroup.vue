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
    <i class="icon-[lucide--axis-3d] size-4" />
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
        <i :class="cn(m.icon, 'size-4')" />
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
        <i class="icon-[lucide--rotate-ccw] size-4" />
        <span>{{ t('load3d.gizmo.reset') }}</span>
      </Button>
    </template>
    <Popover v-else v-model:open="modeMenuOpen">
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
          <i :class="cn(activeModeDef.icon, 'size-4')" />
          <i class="icon-[lucide--chevron-down] size-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="8"
        :class="menuPanelClass"
      >
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
          <i :class="cn(m.icon, 'size-4')" />
          {{ t(m.labelKey) }}
        </button>
        <button type="button" :class="menuButtonClass" @click="selectReset">
          <i class="icon-[lucide--rotate-ccw] size-4" />
          {{ t('load3d.gizmo.reset') }}
        </button>
      </PopoverContent>
    </Popover>
  </template>
</template>

<script setup lang="ts">
import { PopoverTrigger } from 'reka-ui'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import {
  actionClass,
  menuPanelClass
} from '@/components/load3d/menubar/menuBarStyles'
import { usePopoverExclusivity } from '@/components/load3d/menubar/usePopoverExclusivity'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import {
  menuButtonClass,
  selectedMenuButtonClass
} from '@/components/ui/menu/menuStyles'
import type {
  GizmoMode,
  ModelConfig
} from '@/extensions/core/load3d/interfaces'

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
