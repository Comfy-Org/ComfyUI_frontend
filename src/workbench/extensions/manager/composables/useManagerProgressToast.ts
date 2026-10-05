import { useDockedToast } from '@/components/ui/toast/useDockedToast'
import ManagerProgressToast from '@/workbench/extensions/manager/components/ManagerProgressToast.vue'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

export function useManagerProgressToast() {
  const comfyManagerStore = useComfyManagerStore()
  useDockedToast(
    () => comfyManagerStore.taskLogs.length > 0,
    ManagerProgressToast
  )
}
