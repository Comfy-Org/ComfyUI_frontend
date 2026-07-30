<template>
  <button
    v-tooltip.bottom="tip(t('load3d.gizmo.toggle'))"
    :class="actionClass(gizmoEnabled)"
    :aria-pressed="gizmoEnabled"
    type="button"
    :aria-label="compact ? t('load3d.gizmo.toggle') : undefined"
    @click="toggleGizmo"
  >
    <i class="icon-[lucide--axis-3d] size-4" />
    <span v-if="!compact">{{ t('load3d.gizmo.toggle') }}</span>
  </button>

  <template v-if="gizmoEnabled">
    <button
      v-tooltip.bottom="tip(t('load3d.gizmo.translate'))"
      :class="actionClass(gizmoMode === 'translate')"
      :aria-pressed="gizmoMode === 'translate'"
      type="button"
      :aria-label="compact ? t('load3d.gizmo.translate') : undefined"
      @click="setGizmoMode('translate')"
    >
      <i class="icon-[lucide--move] size-4" />
      <span v-if="!compact">{{ t('load3d.gizmo.translate') }}</span>
    </button>
    <button
      v-tooltip.bottom="tip(t('load3d.gizmo.rotate'))"
      :class="actionClass(gizmoMode === 'rotate')"
      :aria-pressed="gizmoMode === 'rotate'"
      type="button"
      :aria-label="compact ? t('load3d.gizmo.rotate') : undefined"
      @click="setGizmoMode('rotate')"
    >
      <i class="icon-[lucide--rotate-3d] size-4" />
      <span v-if="!compact">{{ t('load3d.gizmo.rotate') }}</span>
    </button>
    <button
      v-tooltip.bottom="tip(t('load3d.gizmo.scale'))"
      :class="actionClass(gizmoMode === 'scale')"
      :aria-pressed="gizmoMode === 'scale'"
      type="button"
      :aria-label="compact ? t('load3d.gizmo.scale') : undefined"
      @click="setGizmoMode('scale')"
    >
      <i class="icon-[lucide--scale-3d] size-4" />
      <span v-if="!compact">{{ t('load3d.gizmo.scale') }}</span>
    </button>
    <button
      v-tooltip.bottom="tip(t('load3d.gizmo.reset'))"
      :class="actionClass(false)"
      type="button"
      :aria-label="compact ? t('load3d.gizmo.reset') : undefined"
      @click="resetGizmoTransform"
    >
      <i class="icon-[lucide--rotate-ccw] size-4" />
      <span v-if="!compact">{{ t('load3d.gizmo.reset') }}</span>
    </button>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { actionClass, tip } from '@/components/load3d/menubar/menuBarStyles'
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

const gizmoEnabled = computed(() => config.value?.gizmo?.enabled ?? false)
const gizmoMode = computed(() => config.value?.gizmo?.mode ?? 'translate')

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

function resetGizmoTransform() {
  emit('resetGizmoTransform')
}
</script>
