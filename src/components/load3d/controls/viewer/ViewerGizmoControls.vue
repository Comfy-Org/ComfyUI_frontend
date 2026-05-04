<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label>{{ $t('load3d.gizmo.toggle') }}</label>
      <ToggleGroup
        type="single"
        :model-value="gizmoEnabled ? 'on' : 'off'"
        @update:model-value="(v) => (gizmoEnabled = v === 'on')"
      >
        <ToggleGroupItem value="off" size="sm">
          {{ $t('g.off') }}
        </ToggleGroupItem>
        <ToggleGroupItem value="on" size="sm">
          {{ $t('g.on') }}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <template v-if="gizmoEnabled">
      <div>
        <ToggleGroup
          type="single"
          :model-value="gizmoMode"
          @update:model-value="
            (v) => {
              if (v) gizmoMode = v as GizmoMode
            }
          "
        >
          <ToggleGroupItem value="translate">
            {{ $t('load3d.gizmo.translate') }}
          </ToggleGroupItem>
          <ToggleGroupItem value="rotate">
            {{ $t('load3d.gizmo.rotate') }}
          </ToggleGroupItem>
          <ToggleGroupItem value="scale">
            {{ $t('load3d.gizmo.scale') }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div>
        <Button variant="secondary" @click="$emit('reset-transform')">
          <i class="pi pi-refresh" />
          {{ $t('load3d.gizmo.reset') }}
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { GizmoMode } from '@/extensions/core/load3d/interfaces'

const gizmoEnabled = defineModel<boolean>('gizmoEnabled')
const gizmoMode = defineModel<GizmoMode>('gizmoMode')

defineEmits<{
  (e: 'reset-transform'): void
}>()
</script>
