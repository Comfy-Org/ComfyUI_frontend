import type { SystemStats } from '@/schemas/apiSchema'

interface VramSnapshot {
  torchVramTotal: number
  torchVramFree: number
}

export function extractVramSnapshot({ devices }: SystemStats): VramSnapshot {
  return devices.reduce(
    (snapshot, device) => ({
      torchVramTotal: snapshot.torchVramTotal + (device.torch_vram_total ?? 0),
      torchVramFree: snapshot.torchVramFree + (device.torch_vram_free ?? 0)
    }),
    {
      torchVramTotal: 0,
      torchVramFree: 0
    }
  )
}
