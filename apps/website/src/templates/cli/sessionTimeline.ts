export interface SessionEvent {
  start: number
  end: number
  kind: 'cmd' | 'ok' | 'response'
  text: string
}
export const SESSION_DURATION = 39700
export const RESULTS_START = 35000
export const sessionEvents: readonly SessionEvent[] = [
  {
    start: 600,
    end: 10000,
    kind: 'cmd',
    text: 'comfy generate flux-pro --prompt "a cat on the moon, cinematic lighting" --width 1024 --height 1024 --download cat.png'
  },
  {
    start: 10800,
    end: 10800,
    kind: 'ok',
    text: 'Request accepted\nOutputs: cat.png\nSaved: cat.png'
  },
  {
    start: 13000,
    end: 16800,
    kind: 'cmd',
    text: 'comfy templates fetch image_z_image_turbo --out zimage.json'
  },
  {
    start: 17000,
    end: 17000,
    kind: 'response',
    text: '{"schema":"envelope/1","ok":true,"command":"templates fetch","data":{"title":"Z-Image-Turbo Text to Image","out":"zimage.json","node_count":11},"error":null}'
  },
  {
    start: 18100,
    end: 25200,
    kind: 'cmd',
    text: 'comfy workflow set-slot zimage.json 57.text="a lighthouse at dusk, volumetric fog, cinematic"'
  },
  {
    start: 25500,
    end: 25500,
    kind: 'response',
    text: '{"schema":"envelope/1","ok":true,"command":"workflow set-slot","data":{"workflow":"zimage.json","applied":["57.text"],"wrote":"zimage.json"},"error":null}'
  },
  {
    start: 27200,
    end: 30500,
    kind: 'cmd',
    text: 'comfy run --workflow zimage.json --where cloud --wait | comfy download'
  },
  {
    start: 31600,
    end: 31600,
    kind: 'response',
    text: '{"schema":"envelope/1","ok":true,"command":"download","data":{"files":[{"path":"f5308bc5_000.png"}]},"error":null}'
  },
  {
    start: 33700,
    end: 33700,
    kind: 'ok',
    text: '✓ 2 files saved'
  }
]
