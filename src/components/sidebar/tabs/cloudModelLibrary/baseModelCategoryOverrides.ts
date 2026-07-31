/**
 * Maps a canonical base-model label to the category group its assets should
 * land under, regardless of the asset's file-type tag. Use when a base-model
 * family's companions (text encoders, VAEs, model patches, etc.) should be
 * displayed alongside the base instead of scattered across encoder / vae /
 * conditioning buckets.
 *
 * LoRAs are exempt — they always stay in the dedicated "LoRAs" group, since
 * LoRA is a cross-family file format and the [[Base model]] sort axis already
 * groups them by family.
 *
 * Family roots that span multiple modalities (e.g. bare "Qwen" can be either
 * a language model or an image model) are intentionally omitted; their tags
 * already classify correctly.
 */
const BASE_MODEL_CATEGORY_OVERRIDES: Readonly<Record<string, string>> =
  Object.freeze({
    // Audio bases
    'ACE-Step': 'audio',
    'Stable Audio': 'audio',
    // Video & motion bases
    Wan: 'video',
    'Wan 2.1': 'video',
    'Wan 2.2': 'video',
    HunyuanVideo: 'video',
    'HunyuanVideo 1.5': 'video',
    'LTX Video': 'video',
    'LTX 2': 'video',
    'LTX 2.3': 'video',
    CogVideo: 'video',
    Mochi: 'video',
    Cosmos: 'video',
    HuMo: 'video',
    AnimateDiff: 'video',
    // Image diffusion bases — encoders/VAEs/checkpoints stay with the base
    'Flux.1 dev': 'diffusion',
    'Flux.1 Krea': 'diffusion',
    'Flux.1 Kontext': 'diffusion',
    'Flux.1 Redux': 'diffusion',
    'Flux.1 Schnell': 'diffusion',
    'Flux.2 dev': 'diffusion',
    'Flux.2 Klein': 'diffusion',
    'SD 1.5': 'diffusion',
    'SD 2': 'diffusion',
    'SD 2.1': 'diffusion',
    'SD 3': 'diffusion',
    'SD 3.5': 'diffusion',
    SDXL: 'diffusion',
    Pony: 'diffusion',
    Illustrious: 'diffusion',
    Chroma: 'diffusion',
    'Chroma1 HD': 'diffusion',
    'Chroma1 Radiance': 'diffusion',
    HiDream: 'diffusion',
    'HiDream I1': 'diffusion',
    'HiDream O1': 'diffusion',
    'Z-Image': 'diffusion',
    'Qwen Image': 'diffusion',
    'Qwen Image Edit': 'diffusion',
    'Hunyuan Image': 'diffusion',
    Lumina: 'diffusion',
    Kolors: 'diffusion',
    AuraFlow: 'diffusion',
    PixArt: 'diffusion',
    Kandinsky: 'diffusion',
    Playground: 'diffusion',
    ERNIE: 'diffusion',
    Omnigen: 'diffusion',
    LongCat: 'diffusion',
    NewBie: 'diffusion',
    Ovis: 'diffusion',
    UltraShape: 'diffusion',
    OneReward: 'diffusion',
    USO: 'diffusion',
    PixelDiT: 'diffusion'
  })

export function getCategoryOverrideForBase(label: string): string | null {
  return BASE_MODEL_CATEGORY_OVERRIDES[label] ?? null
}
