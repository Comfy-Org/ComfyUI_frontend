<script setup lang="ts">
import { useCinematicLeaveGuard } from '@/composables/useCinematicLeaveGuard'
import { useReshoot } from '@/composables/useReshoot'
import { reportStudioBusy } from '@/composables/useStudioSwitchGuard'
import type { Locale } from '@/i18n/translations'
import { useWorkshopFlag } from '@/scripts/posthog'
import RunLeaveDialog from '@/components/workshop/RunLeaveDialog.vue'
import ReshootEditor from './ReshootEditor.vue'
import ReshootPage from './ReshootPage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const fullScreen = useWorkshopFlag('workshop-reshoot-fullscreen-enabled')

// Reading the scene and every take run on the Comfy app proxy. The scene is
// read as soon as a clip is picked; the camera is then aimed against a live
// warp of the clip's own geometry.
const reshoot = useReshoot({ locale })

reportStudioBusy(() => reshoot.rendering.value)
const { leavingTo, leave, stay } = useCinematicLeaveGuard(
  () => reshoot.rendering.value,
  () => reshoot.cancel()
)
</script>

<template>
  <ReshootEditor v-if="fullScreen" :reshoot :locale />
  <ReshootPage v-else :reshoot :locale />
  <RunLeaveDialog
    :open="leavingTo !== undefined"
    :locale
    @update:open="(value: boolean) => !value && stay()"
    @leave="leave"
  />
</template>
