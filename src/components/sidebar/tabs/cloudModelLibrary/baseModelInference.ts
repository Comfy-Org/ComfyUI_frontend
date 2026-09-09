/**
 * Filename-based base-model inference for assets that lack both a
 * `metadata.base_model` field and a [[BASE_MODEL_OVERRIDES]] entry — typically
 * Civitai-sourced LoRAs with no HuggingFace repo. The pattern set mirrors the
 * Python scraper's canonical rules so a `flux1-…` LoRA, a `zimage-…` LoRA, etc.
 * land in the right bucket without manual tagging.
 *
 * Underscores are normalised to hyphens before matching because `\b` treats
 * `_` as a word char and would otherwise miss `qwen-image_lora`.
 */

const CANONICAL_RULES: ReadonlyArray<
  readonly [label: string, pattern: RegExp]
> = [
  // Flux family — longest match first
  ['Flux.2 Klein', /\bflux[-.\s]?2[-.\s]?klein\b/i],
  ['Flux.2 dev', /\bflux[-.\s]?2\b/i],
  ['Flux.1 Krea', /\bflux[-.\s]?1?[-.\s]?krea\b/i],
  ['Flux.1 Kontext', /\bflux[-.\s]?1?[-.\s]?kontext\b/i],
  ['Flux.1 Redux', /\bflux[-.\s]?1?[-.\s]?redux\b/i],
  ['Flux.1 Schnell', /\bflux[-.\s]?1?[-.\s]?schnell\b/i],
  ['Flux.1 dev', /\bflux[-.\s]?1\b/i],
  ['Flux.1 dev', /\bflux\b/i],
  // Stable Diffusion family — require sd/stable_diffusion prefix
  ['SDXL', /\bsd[-.\s]?xl\b|\bstable[-.\s]?diffusion[-.\s]?xl\b/i],
  ['SD 3.5', /\b(?:sd|stable[-.\s]?diffusion)[-.\s]?v?3[-.\s]?\.?5\b/i],
  ['SD 3', /\b(?:sd|stable[-.\s]?diffusion)[-.\s]?v?3\b/i],
  ['SD 2.1', /\b(?:sd|stable[-.\s]?diffusion)[-.\s]?v?2[-.\s]?\.?1\b/i],
  ['SD 2', /\b(?:sd|stable[-.\s]?diffusion)[-.\s]?v?2\b/i],
  ['SD 1.5', /\b(?:sd|stable[-.\s]?diffusion)[-.\s]?v?1[-.\s]?\.?5\b/i],
  // Wan
  ['Wan 2.2', /\bwan[-.\s]?2[-.\s]?\.?2\b/i],
  ['Wan 2.1', /\bwan[-.\s]?2[-.\s]?\.?1\b/i],
  ['Wan', /\bwan\b/i],
  // Hunyuan
  ['HunyuanVideo 1.5', /\bhunyuan[-.\s]?video[-.\s]?1[-.\s]?\.?5\b/i],
  ['HunyuanVideo', /\bhunyuan[-.\s]?video\b/i],
  ['Hunyuan Image', /\bhunyuan[-.\s]?image\b/i],
  ['Hunyuan 3D', /\bhunyuan[-.\s]?3d\b/i],
  // Qwen — Image/Edit before plain Qwen
  ['Qwen Image Edit', /\bqwen[-.\s]?image[-.\s]?edit\b/i],
  ['Qwen Image', /\bqwen[-.\s]?image\b/i],
  ['Qwen', /\bqwen\b/i],
  // SDXL-derivative bases — community treats as their own family
  ['Pony', /\bpony\b/i],
  ['Illustrious', /\billustrious\b/i],
  // Other diffusion families — variants before family root
  ['HiDream I1', /\bhi[-_.\s]?dream[-_.\s]?i1\b/i],
  ['HiDream O1', /\bhi[-_.\s]?dream[-_.\s]?o1\b/i],
  ['HiDream', /\bhi[-.\s]?dream\b/i],
  ['Chroma1 Radiance', /\bchroma\d*[-_.\s]?radiance\b/i],
  ['Chroma1 HD', /\bchroma\d*[-_.\s]?hd\b/i],
  ['Chroma', /\bchroma\d*\b/i],
  // Captioner / VLM families — placed before LTX so LTXV-packaged
  // captioner files (e.g. `ltxv_florence2_promptgen_…`) classify by their
  // actual model family, not the packaging prefix.
  ['CogFlorence', /\bcog[-_.\s]?florence\b/i],
  ['Florence-2', /\bflorence[-_.\s]?2\b/i],
  ['JoyCaption', /\bjoy[-_.\s]?caption\d*\b/i],
  ['LLaVA', /\bllava\b/i],
  ['SmolVLM', /\bsmol[-_.\s]?vlm\b/i],
  ['SmolLM2', /\bsmol[-_.\s]?lm\d*\b/i],
  ['SuperPrompt', /\bsuper[-_.\s]?prompt\b/i],
  // Voice / TTS — Chatterbox Turbo before bare Chatterbox
  ['Chatterbox Turbo', /\bchatterbox[-_.\s]?turbo\b/i],
  ['Chatterbox', /\bchatterbox\b/i],
  // Depth — V2 before V1
  ['Depth Anything V2', /\bdepth[-_.\s]?anything[-_.\s]?v?2\b/i],
  ['Depth Anything', /\bdepth[-_.\s]?anything\b/i],
  // Other utility / motion / upscale families
  ['SegFormer', /\bsegformer\b/i],
  ['LivePortrait', /\blive[-_.\s]?portrait\b/i],
  ['DynamiCrafter', /\bdynami[-_.\s]?crafter\b/i],
  ['SeedVR2', /\bseed[-_.\s]?vr\d*\b/i],
  ['FlashVSR', /\bflash[-_.\s]?vsr\b/i],
  ['MimicMotion', /\bmimic[-_.\s]?motion\b/i],
  ['LatentSync', /\blatent[-_.\s]?sync\b/i],
  // Vision encoders — SigLIP before CLIP so CLIP-only matches don't swallow siglip-*
  ['SigLIP', /\bsiglip\b/i],
  ['CLIP-ViT', /\bclip[-_.\s]?vit\b/i],
  ['Llama 3.2', /\bllama[-_.\s]?3[-_.\s]?\.?2\b/i],
  ['LTX 2.3', /\bltx[-.\s]?v?2[-.\s]?\.?3\b/i],
  ['LTX 2', /\bltx[-.\s]?v?2\b/i],
  ['LTX Video', /\bltx\b/i],
  // Upscalers / restoration
  ['UltraSharp', /\bultrasharp\b/i],
  ['Real-ESRGAN', /\breal[-_.\s]?esrgan\b/i],
  // Depth / normal estimation
  ['Lotus', /\blotus\b/i],
  // Matting / background
  ['ViTMatte', /\bvit[-_.\s]?matte\b/i],
  ['LayerDiffusion', /\blayer[-_.\s]?diffusion\b|\blayer[-_.\s]?xl\b/i],
  // Motion / interpolation
  ['RIFE', /\brife\b/i],
  // Detection / pose
  ['GroundingDINO', /\bgrounding[-_.\s]?dino\b/i],
  ['DWPose', /\bdwpose\b|\bdw[-_.\s]?ll[-_.\s]?ucoco\b/i],
  ['Face Parsing', /\bface[-_.\s]?parsing\b/i],
  // Additional language models
  ['ChatGLM3', /\bchat[-_.\s]?glm\d*\b/i],
  ['Gemma', /\bgemma\d*\b/i],
  ['Cosmos', /\bcosmos\b/i],
  ['Mochi', /\bmochi\b/i],
  ['Stable Audio', /\bstable[-.\s]?audio\b/i],
  ['AuraFlow', /\bauraflow\b/i],
  ['PixArt', /\bpixart\b/i],
  ['Kandinsky', /\bkandinsky\b/i],
  ['Playground', /\bplayground\b/i],
  ['Kolors', /\bkolors\b/i],
  ['Z-Image', /\bz[-_.\s]?image(?:[-_.\s]?turbo)?\b/i],
  ['Lumina', /\blumina\b/i],
  ['CogVideo', /\bcogvideo\b/i],
  ['AnimateDiff', /\banimatediff\b/i],
  ['ERNIE', /\bernie\b/i],
  ['Omnigen', /\bomnigen\d*\b/i],
  ['Ovis', /\bovis\b/i],
  ['ACE-Step', /\bace[-.\s]?step\b/i],
  ['HuMo', /\bhumo\b/i],
  ['LongCat', /\blongcat\b/i],
  ['Trellis', /\btrellis\b/i],
  ['USO', /\buso\b/i],
  ['OneReward', /\bone[-.\s]?reward\b/i],
  ['MoGe', /\bmoge\b/i],
  ['UltraShape', /\bultrashape\b/i],
  ['NewBie', /\bnewbie\b/i],
  ['PixelDiT', /\bpixel[-.\s]?dit\b/i],
  ['SAM 3D', /\bsam[-.\s]?3d\b/i],
  ['SAM 3', /\bsam[-.\s]?3(?!d)\b/i],
  ['SAM 2', /\bsam[-.\s]?2\b/i],
  ['SAM', /\bsam\b/i],
  ['BiRefNet', /\bbirefnet\b/i]
] as const

export function inferBaseModelFromText(text: string): string | null {
  if (!text) return null
  // Underscores are word chars to regex \b — swap to hyphens so things like
  // "Qwen-Image_ComfyUI" or "flux1-foo" match cleanly.
  const normalized = text.replace(/_/g, '-')
  for (const [label, pattern] of CANONICAL_RULES) {
    if (pattern.test(normalized)) return label
  }
  return null
}

const CANONICAL_LABELS: ReadonlySet<string> = new Set(
  CANONICAL_RULES.map(([label]) => label)
)

/**
 * Family-prefix rules. Maps labels (canonical and common non-canonical
 * variants like `LTXV2`) onto a family bucket so refinement can spot when a
 * filename suggests a more specific variant of the same family.
 */
const FAMILY_PREFIX_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(?:ltxv|ltx)/i, 'ltx'],
  [/^(?:sdxl|sd|stable[-.\s]?diffusion)/i, 'sd'],
  [/^flux/i, 'flux'],
  [/^wan/i, 'wan'],
  [/^hunyuan/i, 'hunyuan'],
  [/^qwen/i, 'qwen'],
  [/^z[-_.\s]?image/i, 'zimage'],
  [/^hi[-_.\s]?dream/i, 'hidream'],
  [/^sam/i, 'sam']
] as const

function familyOf(label: string): string {
  for (const [pattern, family] of FAMILY_PREFIX_RULES) {
    if (pattern.test(label)) return family
  }
  return label.toLowerCase().match(/^[a-z]+/)?.[0] ?? label.toLowerCase()
}

/**
 * Refines metadata-derived base-model labels using filename inference. When
 * the filename suggests a more specific variant of the same family — e.g.
 * `LTX_2.3_…` whose HuggingFace card says only `Lightricks/LTX-Video` —
 * promote to the specific variant.
 *
 * Rules per existing label:
 *   1. If a filename-inferred label shares its family AND the existing label
 *      is non-canonical, replace with the canonical inferred label.
 *   2. If both are canonical and same family, prefer the one with a version
 *      digit when the other has none.
 */
export function refineBaseModelLabels(
  labels: readonly string[],
  filenameSources: readonly string[]
): string[] {
  if (labels.length === 0) return [...labels]
  const inferences = filenameSources
    .map((s) => inferBaseModelFromText(s))
    .filter((x): x is string => Boolean(x))
  if (inferences.length === 0) return [...labels]
  return labels.map((existing) => {
    const family = familyOf(existing)
    for (const inferred of inferences) {
      if (familyOf(inferred) !== family) continue
      if (inferred === existing) return existing
      const existingCanonical = CANONICAL_LABELS.has(existing)
      const inferredCanonical = CANONICAL_LABELS.has(inferred)
      if (!existingCanonical && inferredCanonical) return inferred
      if (existingCanonical && inferredCanonical) {
        const inferredHasDigit = /\d/.test(inferred)
        const existingHasDigit = /\d/.test(existing)
        if (inferredHasDigit && !existingHasDigit) return inferred
      }
    }
    return existing
  })
}
