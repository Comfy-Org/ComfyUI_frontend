/**
 * Maps `Comfy-Org/<repo>` ids to the actual upstream provider.
 *
 * The Comfy-Org HuggingFace organisation hosts ~65 repackaged copies of
 * third-party models. Showing "Comfy-Org" as the provider is misleading —
 * users want to know the real upstream author (e.g. Black Forest Labs for
 * FLUX, NVIDIA for Cosmos).
 *
 * Built one-shot from a scrape of every Comfy-Org HF README (see
 * `temp/scripts/scrape-comfy-org-providers.py`). Entries omitted from this
 * map fall back to the default `Comfy-Org` provider string — keep that
 * behaviour for repos whose true upstream we couldn't identify with
 * confidence.
 */
export const COMFY_ORG_PROVIDER_OVERRIDES: Readonly<Record<string, string>> =
  Object.freeze({
    'Comfy-Org/ACE-Step_ComfyUI_repackaged': 'ACE-Step',
    'Comfy-Org/BiRefNet': 'ZhengPeng7',
    'Comfy-Org/CLIP-ViT-H-14-laion2B-s32B-b79K_repackaged': 'laion',
    'Comfy-Org/Chroma1-HD_repackaged': 'lodestones',
    'Comfy-Org/Chroma1-Radiance_Repackaged': 'lodestones',
    'Comfy-Org/Cosmos_Predict2_repackaged': 'nvidia',
    'Comfy-Org/ERNIE-Image': 'baidu',
    'Comfy-Org/FLUX.1-Krea-dev_ComfyUI': 'black-forest-labs',
    'Comfy-Org/Flux1-Redux-Dev': 'black-forest-labs',
    'Comfy-Org/HiDream-I1_ComfyUI': 'HiDream-ai',
    'Comfy-Org/HiDream-O1-Image': 'HiDream-ai',
    'Comfy-Org/HuMo_ComfyUI': 'bytedance-research',
    'Comfy-Org/HunyuanImage_2.1_ComfyUI': 'tencent',
    'Comfy-Org/HunyuanVideo_1.5_repackaged': 'tencent',
    'Comfy-Org/HunyuanVideo_repackaged': 'tencent',
    'Comfy-Org/Lens': 'microsoft',
    'Comfy-Org/LongCat-Image': 'meituan-longcat',
    'Comfy-Org/Lumina_Image_2.0_Repackaged': 'Alpha-VLLM',
    'Comfy-Org/MoGe': 'microsoft',
    'Comfy-Org/NewBie-image-Exp0.1_repackaged': 'NewBie-AI',
    'Comfy-Org/OneReward_repackaged': 'bytedance-research',
    'Comfy-Org/Omnigen2_ComfyUI_repackaged': 'OmniGen2',
    'Comfy-Org/Ovis-Image': 'AIDC-AI',
    'Comfy-Org/PixelDiT': 'nvidia',
    'Comfy-Org/Qwen-Image-DiffSynth-ControlNets': 'DiffSynth-Studio',
    'Comfy-Org/Qwen-Image-Edit_ComfyUI': 'dx8152',
    'Comfy-Org/Qwen-Image-InstantX-ControlNets': 'InstantX',
    'Comfy-Org/Qwen-Image-Layered_ComfyUI': 'Qwen',
    'Comfy-Org/Qwen-Image_ComfyUI': 'Qwen',
    'Comfy-Org/Qwen3.5': 'Qwen',
    'Comfy-Org/Real-ESRGAN_repackaged': 'xinntao',
    'Comfy-Org/T2I-Adapter_ComfyUI_Repackaged': 'TencentARC',
    'Comfy-Org/TRELLIS.2': 'microsoft',
    'Comfy-Org/USO_1.0_Repackaged': 'bytedance-research',
    'Comfy-Org/Wan_2.1_ComfyUI_repackaged': 'Wan-AI',
    'Comfy-Org/Wan_2.2_ComfyUI_Repackaged': 'Wan-AI',
    'Comfy-Org/ace_step_1.5_ComfyUI_files': 'ACE-Step',
    'Comfy-Org/flux1-dev': 'black-forest-labs',
    'Comfy-Org/flux1-kontext-dev_ComfyUI': 'black-forest-labs',
    'Comfy-Org/flux1-schnell': 'black-forest-labs',
    'Comfy-Org/flux2-dev': 'black-forest-labs',
    'Comfy-Org/frame_interpolation': 'google-research',
    'Comfy-Org/gemma-4': 'google',
    'Comfy-Org/hunyuan3D_2.0_repackaged': 'tencent',
    'Comfy-Org/hunyuan3D_2.1_repackaged': 'tencent',
    'Comfy-Org/lotus': 'jingheya',
    'Comfy-Org/ltx-2': 'ovi054',
    'Comfy-Org/ltx-2.3': 'Lightricks',
    'Comfy-Org/mediapipe': 'google',
    'Comfy-Org/mochi_preview_repackaged': 'genmo',
    'Comfy-Org/sam3.1': 'facebook',
    'Comfy-Org/sigclip_vision_384': 'google',
    'Comfy-Org/stable-audio-3': 'stabilityai',
    'Comfy-Org/stable-audio-open-1.0_repackaged': 'stabilityai',
    'Comfy-Org/stable-diffusion-3.5-controlnets_ComfyUI_repackaged':
      'stabilityai',
    'Comfy-Org/stable-diffusion-3.5-fp8': 'stabilityai',
    'Comfy-Org/stable-diffusion-v1-5-archive': 'runwayml',
    'Comfy-Org/stable_diffusion_2.1_repackaged': 'stabilityai',
    'Comfy-Org/stable_diffusion_2.1_unclip_repackaged': 'stabilityai',
    'Comfy-Org/void-model': 'netflix',
    'Comfy-Org/z_image': 'Tongyi-MAI',
    'Comfy-Org/z_image_turbo': 'Tongyi-MAI'
  })
