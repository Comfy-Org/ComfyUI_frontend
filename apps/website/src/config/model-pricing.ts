// Published-pricing links for model twins. Partner models deep-link to their
// provider's section of the docs pricing table; open-source models meter as
// Cloud GPU time. Links only — the rates live in the docs and change there.

export const PRICING_URL =
  'https://docs.comfy.org/tutorials/partner-nodes/pricing'

// Registry slug → section id on the pricing page (verified against the live
// page's heading ids). stability-ai is intentionally absent: the pricing page
// has no Stability section yet, so it falls back to the table root.
const partnerPricingAnchors: Record<string, string> = {
  'bria-ai': 'bria',
  'flux-api': 'bfl',
  'gemini-image': 'google',
  'grok-imagine': 'xai',
  'hailuo-minimax': 'minimax',
  'hunyuan-3d': 'tencent',
  ideogram: 'ideogram',
  'kling-ai': 'kling',
  'ltxv-api': 'lightricks',
  'luma-dream-machine': 'luma',
  'magnific-ai': 'magnific',
  'meshy-ai': 'meshy',
  'nano-banana': 'google',
  'openai-dall-e': 'openai',
  pixverse: 'pixverse',
  recraft: 'recraft',
  'rodin-3d': 'rodin-3d',
  runway: 'runway',
  'seedance-bytedance': 'bytedance',
  'topaz-labs': 'topaz',
  'tripo-3d': 'tripo',
  'veo-2': 'google',
  vidu: 'vidu',
  'wan-api': 'wan',
  wavespeed: 'wavespeed'
}

export function buildPricingFact(slug: string, isPartner: boolean): string {
  if (!isPartner) {
    return `Pricing: free to run locally on your own hardware; on Comfy Cloud it meters as GPU time at the published Cloud GPU rate: ${PRICING_URL}#cloud-gpu`
  }
  const anchor = partnerPricingAnchors[slug]
  const url = anchor ? `${PRICING_URL}#${anchor}` : PRICING_URL
  return `Pricing: published per-run credit rates for these partner nodes: ${url}`
}
