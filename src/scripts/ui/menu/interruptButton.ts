import { StatusWsMessageStatus } from '@/types/apiTypes'
import { api } from '../../api'
import { ComfyButton } from '../components/button'
import { useToastStore } from '@/stores/toastStore'

export function getInterruptButton(visibility: string) {
  const btn = new ComfyButton({
    icon: 'close',
    tooltip: 'Cancel current generation',
    enabled: false,
    action: async () => {
      await api.interrupt()
      useToastStore().add({
        severity: 'info',
        summary: 'Interrupted',
        detail: 'Execution has been interrupted',
        life: 1000
      })
    },
    classList: ['comfyui-button', 'comfyui-interrupt-button', visibility]
  })

  api.addEventListener(
    'status',
    ({ detail }: CustomEvent<StatusWsMessageStatus>) => {
      const sz = detail?.exec_info?.queue_remaining
      btn.enabled = sz > 0
    }
  )

  return btn
}
