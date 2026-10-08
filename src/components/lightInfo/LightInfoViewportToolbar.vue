<template>
  <div class="pointer-events-none absolute inset-0 flex flex-col">
    <div
      class="pointer-events-auto flex h-10 items-center gap-1 bg-interface-menu-surface px-2"
      @wheel.stop
    >
      <button
        v-tooltip.bottom="tip(gizmosLabel)"
        type="button"
        :class="actionClass(gizmosOn)"
        :aria-pressed="gizmosOn"
        :aria-label="gizmosLabel"
        @click="gizmosOn = !gizmosOn"
      >
        <i
          :class="
            cn(
              'size-4',
              gizmosOn ? 'icon-[lucide--eye]' : 'icon-[lucide--eye-off]'
            )
          "
        />
        <span v-if="!compact">{{ gizmosLabel }}</span>
      </button>
      <div class="mx-1 h-5 w-px shrink-0 bg-interface-menu-stroke" />
      <button
        v-for="option in transformGizmoOptions"
        :key="option.value"
        v-tooltip.bottom="tip($t(option.labelKey))"
        type="button"
        :disabled="!option.enabled"
        :aria-pressed="effectiveTransformGizmoMode === option.value"
        :aria-label="$t(option.labelKey)"
        :class="
          cn(
            actionClass(effectiveTransformGizmoMode === option.value),
            !option.enabled && 'cursor-not-allowed opacity-40'
          )
        "
        @click="transformGizmoMode = option.value"
      >
        <i :class="cn('size-4', option.icon)" />
        <span v-if="!compact">{{ $t(option.labelKey) }}</span>
      </button>
    </div>
    <div class="flex-1" />
    <div
      class="pointer-events-auto flex h-10 items-center justify-end gap-1 bg-interface-menu-surface px-2"
      @wheel.stop
    >
      <button
        v-tooltip.top="tip($t('load3d.outputView'))"
        type="button"
        :class="iconBtnClass"
        :aria-label="$t('load3d.outputView')"
        @click="emit('resetView')"
      >
        <i class="icon-[lucide--focus] size-4" />
      </button>
      <button
        v-tooltip.top="tip(cameraLockLabel)"
        type="button"
        :class="cn(iconBtnClass, cameraLocked && 'bg-button-active-surface')"
        :aria-pressed="cameraLocked"
        :aria-label="cameraLockLabel"
        @click="cameraLocked = !cameraLocked"
      >
        <i
          :class="
            cn(
              'size-4',
              cameraLocked ? 'icon-[lucide--lock]' : 'icon-[lucide--lock-open]'
            )
          "
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  actionClass,
  iconBtnClass,
  tip
} from '@/components/load3d/menubar/menuBarStyles'
import type { LightTransformGizmoMode } from '@/extensions/core/lightInfo/LightInfoViewport'
import {
  lightPositionApplies,
  targetApplies
} from '@/extensions/core/lightInfo/LightInfoViewport'
import type { LightInfoType } from '@/extensions/core/lightInfo/types'
import { cn } from '@comfyorg/tailwind-utils'

const { compact, lightType } = defineProps<{
  compact: boolean
  lightType: LightInfoType | null
}>()

const gizmosOn = defineModel<boolean>('gizmosOn', { required: true })
const transformGizmoMode = defineModel<LightTransformGizmoMode>(
  'transformGizmoMode',
  { required: true }
)
const cameraLocked = defineModel<boolean>('cameraLocked', { required: true })

const emit = defineEmits<{
  resetView: []
}>()

const { t } = useI18n()

const gizmosLabel = computed(() =>
  gizmosOn.value ? t('load3d.hideGizmos') : t('load3d.showGizmos')
)

const cameraLockLabel = computed(() =>
  cameraLocked.value ? t('load3d.unlockCamera') : t('load3d.lockCamera')
)

const transformGizmoOptions = computed(() => [
  {
    value: 'none' as const,
    labelKey: 'load3d.transformGizmo.none',
    icon: 'icon-[lucide--ban]',
    enabled: true
  },
  {
    value: 'light-position' as const,
    labelKey: 'load3d.transformGizmo.lightPosition',
    icon: 'icon-[lucide--move-3d]',
    enabled: lightType !== null && lightPositionApplies(lightType)
  },
  {
    value: 'target' as const,
    labelKey: 'load3d.transformGizmo.target',
    icon: 'icon-[lucide--target]',
    enabled: lightType !== null && targetApplies(lightType)
  }
])

const effectiveTransformGizmoMode = computed<LightTransformGizmoMode>(() =>
  transformGizmoOptions.value.some(
    ({ value, enabled }) => value === transformGizmoMode.value && enabled
  )
    ? transformGizmoMode.value
    : 'none'
)
</script>
