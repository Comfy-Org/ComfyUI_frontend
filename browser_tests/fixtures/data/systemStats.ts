import type { SystemStatsResponse } from '@comfyorg/ingest-types'

export const mockSystemStats: SystemStatsResponse = {
  system: {
    os: 'posix',
    python_version: '3.11.9 (main, Apr  2 2024, 08:25:04) [GCC 13.2.0]',
    embedded_python: false,
    comfyui_version: '0.3.10',
    pytorch_version: '2.4.0+cu124',
    argv: ['main.py'],
    ram_total: 67108864000,
    ram_free: 52428800000
  },
  devices: [
    {
      name: 'NVIDIA GeForce RTX 4090',
      type: 'cuda',
      vram_total: 25769803776,
      vram_free: 23622320128
    }
  ]
}
