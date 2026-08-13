import type { TranslationKey } from '../../i18n/translations'

const THUMB_BASE = 'https://media.comfy.org/website/mcp/hero-demo'

export type McpDemoPrompt = {
  id: string
  promptKey: TranslationKey
  toolKey: TranslationKey
  result: string
  via?: string
  variants?: number
  stacked?: boolean
}

export const mcpDemoPrompts = [
  {
    id: 'keyframe-board',
    promptKey: 'mcp.hero.demoPromptKeyframeBoard',
    toolKey: 'mcp.hero.demoToolKeyframeBoard',
    result: 'keyframes/ · ×8',
    via: 'Notion',
    stacked: true
  },
  {
    id: 'character-concepts',
    promptKey: 'mcp.hero.demoPromptCharacterConcepts',
    toolKey: 'mcp.hero.demoToolCharacterConcepts',
    result: 'hero_concepts/ · ×4',
    variants: 4
  },
  {
    id: 'style-transfer',
    promptKey: 'mcp.hero.demoPromptStyleTransfer',
    toolKey: 'mcp.hero.demoToolStyleTransfer',
    result: 'previz_styled/ · ×12',
    stacked: true
  },
  {
    id: 'frame-to-video',
    promptKey: 'mcp.hero.demoPromptFrameToVideo',
    toolKey: 'mcp.hero.demoToolFrameToVideo',
    result: 'ugc_shots.mp4 · ×8'
  },
  {
    id: 'product-placement',
    promptKey: 'mcp.hero.demoPromptProductPlacement',
    toolKey: 'mcp.hero.demoToolProductPlacement',
    result: 'placements.png · ×8',
    via: 'Photoshop'
  },
  {
    id: 'character-design',
    promptKey: 'mcp.hero.demoPromptCharacterDesign',
    toolKey: 'mcp.hero.demoToolCharacterDesign',
    result: 'hero_turnaround.png · 4-view',
    via: 'Blender'
  },
  {
    id: '3d-asset',
    promptKey: 'mcp.hero.demoPrompt3dAsset',
    toolKey: 'mcp.hero.demoTool3dAsset',
    result: 'hero_prop.glb · 24k tris',
    via: 'Blender'
  },
  {
    id: 'campaign-key-art',
    promptKey: 'mcp.hero.demoPromptCampaignKeyArt',
    toolKey: 'mcp.hero.demoToolCampaignKeyArt',
    result: 'campaign_keyart.png',
    via: 'Figma'
  },
  {
    id: 'set-extension',
    promptKey: 'mcp.hero.demoPromptSetExtension',
    toolKey: 'mcp.hero.demoToolSetExtension',
    result: 'set_extension.png'
  }
] as const satisfies readonly McpDemoPrompt[]

export function thumbUrls({ id, variants }: McpDemoPrompt): string[] {
  return variants
    ? Array.from(
        { length: variants },
        (_, i) => `${THUMB_BASE}/${id}-${i + 1}.webp`
      )
    : [`${THUMB_BASE}/${id}.webp`]
}

/**
 * The `count` most recent prompts ending at `index`, newest first, wrapping
 * around the list. The window is always full, so the rendered card count never
 * changes and the demo cannot shift the page.
 */
export function visibleWindow<T>(
  items: readonly T[],
  index: number,
  count: number
): T[] {
  const size = Math.min(count, items.length)

  return Array.from(
    { length: size },
    (_, offset) =>
      items[(((index - offset) % items.length) + items.length) % items.length]
  )
}
