export const VIEWPORTS = [
  { name: '1-sm', width: 393, height: 851 },
  { name: '2-md', width: 768, height: 1024 },
  { name: '3-lg', width: 1280, height: 800 },
  { name: '4-xl', width: 1536, height: 864 }
] as const

export type ViewportName = (typeof VIEWPORTS)[number]['name']
