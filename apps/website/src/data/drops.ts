// Single-drop tracer for slice 5; full 10-drop set lands in slice 6.
// Image URLs are placeholders at media.comfy.org/website/drops/<id>.png —
// asset uploads and native zh-CN review are pending follow-ups (see
// apps/website/.scratch/drops-page/PRD.md).
import type { LocalizedText } from '../i18n/translations'

export type Drop = {
  id: string
  badge?: LocalizedText
  category: LocalizedText
  image: { src: string; alt: LocalizedText }
  title: LocalizedText
  description: LocalizedText
  cta: { label: LocalizedText; href: LocalizedText }
}

export const drops: readonly Drop[] = [
  {
    id: 'desktop-client',
    badge: { en: 'NEW', 'zh-CN': '新' },
    category: { en: 'Platform', 'zh-CN': '平台' },
    image: {
      src: 'https://media.comfy.org/website/drops/desktop-client.png',
      alt: { en: 'New Desktop Client', 'zh-CN': '新桌面客户端' }
    },
    title: { en: 'New Desktop Client', 'zh-CN': '新桌面客户端' },
    description: {
      en: 'A faster, redesigned desktop app for ComfyUI — one-click install and managed updates.',
      'zh-CN': '更快、重新设计的 ComfyUI 桌面应用程序 — 一键安装与受管更新。'
    },
    cta: {
      label: { en: 'EXPLORE', 'zh-CN': '探索' },
      href: { en: '/download', 'zh-CN': '/zh-CN/download' }
    }
  }
]
