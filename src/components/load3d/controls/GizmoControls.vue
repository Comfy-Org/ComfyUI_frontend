<template>
  <div class="flex flex-col">
    <Button
      v-tooltip.right="{ value: t('load3d.gizmo.toggle'), showDelay: 300 }"
      variant="textonly"
      size="icon"
      :class="cn('rounded-full', gizmoEnabled && 'ring-2 ring-white/50')"
      :aria-label="t('load3d.gizmo.toggle')"
      @click="toggleGizmo"
    >
      <i class="pi pi-compass text-lg text-base-foreground" />
    </Button>

    <template v-if="gizmoEnabled">
      <Button
        v-tooltip.right="{
          value: t('load3d.gizmo.translate'),
          showDelay: 300
        }"
        variant="textonly"
        size="icon"
        :class="
          cn(
            'rounded-full',
            gizmoMode === 'translate' && 'ring-2 ring-white/50'
          )
        "
        :aria-label="t('load3d.gizmo.translate')"
        @click="setMode('translate')"
      >
        <i class="pi pi-arrows-alt text-lg text-base-foreground" />
      </Button>

      <Button
        v-tooltip.right="{
          value: t('load3d.gizmo.rotate'),
          showDelay: 300
        }"
        variant="textonly"
        size="icon"
        :class="
          cn('rounded-full', gizmoMode === 'rotate' && 'ring-2 ring-white/50')
        "
        :aria-label="t('load3d.gizmo.rotate')"
        @click="setMode('rotate')"
      >
        <i class="pi pi-sync text-lg text-base-foreground" />
      </Button>

      <Button
        v-tooltip.right="{
          value: t('load3d.gizmo.scale'),
          showDelay: 300
        }"
        variant="textonly"
        size="icon"
        :class="
          cn('rounded-full', gizmoMode === 'scale' && 'ring-2 ring-white/50')
        "
        :aria-label="t('load3d.gizmo.scale')"
        @click="setMode('scale')"
      >
        <i class="pi pi-expand text-lg text-base-foreground" />
      </Button>

      <Button
        v-tooltip.right="{
          value: t('load3d.gizmo.reset'),
          showDelay: 300
        }"
        variant="textonly"
        size="icon"
        class="rounded-full"
        :aria-label="t('load3d.gizmo.reset')"
        @click="resetTransform"
      >
        <i class="pi pi-refresh text-lg text-base-foreground" />
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type {
  GizmoConfig,
  GizmoMode
} from '@/extensions/core/load3d/interfaces'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const gizmoConfig = defineModel<GizmoConfig>('gizmoConfig')

const gizmoEnabled = ref(false)
const gizmoMode = ref<GizmoMode>('translate')

if (gizmoConfig.value) {
  gizmoEnabled.value = gizmoConfig.value.enabled
  gizmoMode.value = gizmoConfig.value.mode
}

const emit = defineEmits<{
  (e: 'toggleGizmo', enabled: boolean): void
  (e: 'setGizmoMode', mode: GizmoMode): void
  (e: 'resetGizmoTransform'): void
}>()

const toggleGizmo = () => {
  gizmoEnabled.value = !gizmoEnabled.value
  emit('toggleGizmo', gizmoEnabled.value)
}

const setMode = (mode: GizmoMode) => {
  gizmoMode.value = mode
  emit('setGizmoMode', mode)
}

const resetTransform = () => {
  emit('resetGizmoTransform')
}

watch(
  () => gizmoConfig.value,
  (newConfig) => {
    if (newConfig) {
      gizmoEnabled.value = newConfig.enabled
      gizmoMode.value = newConfig.mode
    }
  },
  { deep: true }
)

watch([gizmoEnabled, gizmoMode], () => {
  if (gizmoConfig.value) {
    gizmoConfig.value.enabled = gizmoEnabled.value
    gizmoConfig.value.mode = gizmoMode.value
  }
})
</script>
