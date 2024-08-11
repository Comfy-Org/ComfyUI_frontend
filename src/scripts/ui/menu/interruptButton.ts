import { StatusWsMessageStatus } from '@/types/apiTypes'
import { api } from '../../api'
import { ComfyButton } from '../components/button'

export function getInteruptButton(visibility: string) {
  const btn = new ComfyButton({
    icon: 'close',
    tooltip: 'Cancel current generation',
    enabled: false,
    action: () => {
      api.interrupt()
    },
    classList: ['comfyui-button', 'comfyui-interrupt-button', visibility]
  })

  api.addEventListener(
    'status',
    ({ detail }: CustomEvent<StatusWsMessageStatus>) => {
      const sz = detail.exec_info.queue_remaining
      btn.enabled = sz > 0
    }
  )

  return btn
}
