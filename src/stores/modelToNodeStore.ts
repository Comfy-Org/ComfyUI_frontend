import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/** Helper class that defines how to construct a node from a model. */
export class ModelNodeProvider {
  /** The node definition to use for this model. */
  public nodeDef: ComfyNodeDefImpl

  /** The node input key for where to insert the model name. */
  public key: string

  constructor(nodeDef: ComfyNodeDefImpl, key: string) {
    this.nodeDef = nodeDef
    this.key = key
  }
}

/** Service for mapping model types (by folder name) to nodes. */
export const useModelToNodeStore = defineStore('modelToNode', () => {
  const modelToNodeMap = ref<Record<string, ModelNodeProvider[]>>({})
  const nodeDefStore = useNodeDefStore()
  const haveDefaultsLoaded = ref(false)

  /** Internal computed for reactive caching of registered node types */
  const registeredNodeTypes = computed<Record<string, string>>(() => {
    return Object.fromEntries(
      Object.values(modelToNodeMap.value)
        .flat()
        .filter((provider) => !!provider.nodeDef)
        .map((provider) => [provider.nodeDef.name, provider.key])
    )
  })

  /** Internal computed for efficient reverse lookup: nodeType -> category */
  const nodeTypeToCategory = computed(() => {
    const lookup: Record<string, string> = {}
    for (const [category, providers] of Object.entries(modelToNodeMap.value)) {
      for (const provider of providers) {
        // Extension nodes may not be installed
        if (!provider.nodeDef) continue
        // Only store the first category for each node type (matches current assetService behavior)
        if (!lookup[provider.nodeDef.name]) {
          lookup[provider.nodeDef.name] = category
        }
      }
    }
    return lookup
  })

  /** Get set of all registered node types for efficient lookup */
  function getRegisteredNodeTypes(): Record<string, string> {
    registerDefaults()
    return registeredNodeTypes.value
  }

  /**
   * Get the category for a given node type.
   * Performs efficient O(1) lookup using cached reverse map.
   * @param nodeType The node type name to find the category for
   * @returns The category name, or undefined if not found
   */
  function getCategoryForNodeType(nodeType: string): string | undefined {
    registerDefaults()

    // Handle invalid input gracefully
    if (!nodeType || typeof nodeType !== 'string') {
      return undefined
    }

    return nodeTypeToCategory.value[nodeType]
  }

  /**
   * Find providers for modelType with hierarchical fallback.
   * Tries exact match first, then falls back to top-level segment (e.g., "parent/child" → "parent").
   * Note: Only falls back one level; "a/b/c" tries "a/b/c" then "a", not "a/b".
   */
  function findProvidersWithFallback(
    modelType: string
  ): ModelNodeProvider[] | undefined {
    if (!modelType || typeof modelType !== 'string') {
      return undefined
    }

    const exactMatch = modelToNodeMap.value[modelType]
    if (exactMatch && exactMatch.length > 0) return exactMatch

    const topLevel = modelType.split('/')[0]
    if (topLevel === modelType) return undefined

    const fallback = modelToNodeMap.value[topLevel]

    if (fallback && fallback.length > 0) return fallback

    return undefined
  }

  /**
   * Get the node provider for the given model type name.
   * Supports hierarchical lookups: if "parent/child" has no match, falls back to "parent".
   * @param modelType The name of the model type to get the node provider for.
   * @returns The node provider for the given model type name.
   */
  function getNodeProvider(modelType: unknown): ModelNodeProvider | undefined {
    if (typeof modelType !== 'string') return undefined
    registerDefaults()
    return findProvidersWithFallback(modelType)?.[0]
  }

  /**
   * Get the list of all valid node providers for the given model type name.
   * Supports hierarchical lookups: if "parent/child" has no match, falls back to "parent".
   * @param modelType The name of the model type to get the node providers for.
   * @returns The list of all valid node providers for the given model type name.
   */
  function getAllNodeProviders(modelType: unknown): ModelNodeProvider[] {
    if (typeof modelType !== 'string') return []
    registerDefaults()
    return findProvidersWithFallback(modelType) ?? []
  }
  /**
   * Register a node provider for the given model type name.
   * @param modelType The name of the model type to register the node provider for.
   * @param nodeProvider The node provider to register.
   */
  function registerNodeProvider(
    modelType: string,
    nodeProvider: ModelNodeProvider
  ) {
    registerDefaults()
    if (!nodeProvider.nodeDef) return
    if (!modelToNodeMap.value[modelType]) {
      modelToNodeMap.value[modelType] = []
    }
    modelToNodeMap.value[modelType].push(nodeProvider)
  }
  /**
   * Register a node provider for the given simple names.
   * @param modelType The name of the model type to register the node provider for.
   * @param nodeClass The node class name to register.
   * @param key The key to use for the node input.
   */
  function quickRegister(modelType: string, nodeClass: string, key: string) {
    registerNodeProvider(
      modelType,
      new ModelNodeProvider(nodeDefStore.nodeDefsByName[nodeClass], key)
    )
  }

  function registerDefaults() {
    if (haveDefaultsLoaded.value) {
      return
    }
    if (Object.keys(nodeDefStore.nodeDefsByName).length === 0) {
      return
    }
    haveDefaultsLoaded.value = true

    quickRegister('checkpoints', 'CheckpointLoaderSimple', 'ckpt_name')
    quickRegister('checkpoints', 'ImageOnlyCheckpointLoader', 'ckpt_name')
    quickRegister('loras', 'LoraLoader', 'lora_name')
    quickRegister('loras', 'LoraLoaderModelOnly', 'lora_name')
    quickRegister('vae', 'VAELoader', 'vae_name')
    quickRegister('controlnet', 'ControlNetLoader', 'control_net_name')
    quickRegister('diffusion_models', 'UNETLoader', 'unet_name')
    quickRegister('upscale_models', 'UpscaleModelLoader', 'model_name')
    quickRegister('style_models', 'StyleModelLoader', 'style_model_name')
    quickRegister('gligen', 'GLIGENLoader', 'gligen_name')
    quickRegister('clip_vision', 'CLIPVisionLoader', 'clip_name')
    quickRegister('text_encoders', 'CLIPLoader', 'clip_name')
    quickRegister('audio_encoders', 'AudioEncoderLoader', 'audio_encoder_name')
    quickRegister('model_patches', 'ModelPatchLoader', 'name')
    quickRegister(
      'animatediff_models',
      'ADE_LoadAnimateDiffModel',
      'model_name'
    )
    quickRegister(
      'animatediff_motion_lora',
      'ADE_AnimateDiffLoRALoader',
      'name'
    )

    // Chatterbox TTS nodes: empty key means the node auto-loads models without
    // a widget selector (createModelNodeFromAsset skips widget assignment)
    quickRegister('chatterbox/chatterbox', 'FL_ChatterboxTTS', '')
    quickRegister('chatterbox/chatterbox_turbo', 'FL_ChatterboxTurboTTS', '')
    quickRegister(
      'chatterbox/chatterbox_multilingual',
      'FL_ChatterboxMultilingualTTS',
      ''
    )
    quickRegister('chatterbox/chatterbox_vc', 'FL_ChatterboxVC', '')

    // Latent upscale models (ComfyUI core - nodes_hunyuan.py)
    quickRegister(
      'latent_upscale_models',
      'LatentUpscaleModelLoader',
      'model_name'
    )

    // SAM/SAM2 segmentation models (comfyui-segment-anything-2, comfyui-impact-pack)
    quickRegister('sam2', 'DownloadAndLoadSAM2Model', 'model')
    quickRegister('sams', 'SAMLoader', 'model_name')

    // Ultralytics detection models (comfyui-impact-subpack)
    // Note: ultralytics/bbox and ultralytics/segm fall back to this via hierarchical lookup
    quickRegister('ultralytics', 'UltralyticsDetectorProvider', 'model_name')

    // DepthAnything models (comfyui-depthanythingv2)
    quickRegister(
      'depthanything',
      'DownloadAndLoadDepthAnythingV2Model',
      'model'
    )

    // IP-Adapter models (comfyui_ipadapter_plus)
    quickRegister('ipadapter', 'IPAdapterModelLoader', 'ipadapter_file')

    // Segformer clothing/fashion segmentation models (comfyui_layerstyle)
    quickRegister('segformer_b2_clothes', 'LS_LoadSegformerModel', 'model_name')
    quickRegister('segformer_b3_clothes', 'LS_LoadSegformerModel', 'model_name')
    quickRegister('segformer_b3_fashion', 'LS_LoadSegformerModel', 'model_name')

    // NLF pose estimation models (ComfyUI-WanVideoWrapper)
    quickRegister('nlf', 'LoadNLFModel', 'nlf_model')

    // FlashVSR video super-resolution (ComfyUI-FlashVSR_Ultra_Fast)
    // Empty key means the node auto-loads models without a widget selector
    quickRegister('FlashVSR', 'FlashVSRNode', '')
    quickRegister('FlashVSR-v1.1', 'FlashVSRNode', '')

    // SEEDVR2 video upscaling (comfyui-seedvr2)
    quickRegister('SEEDVR2', 'SeedVR2LoadDiTModel', 'model')

    // Qwen VL vision-language models (comfyui-qwen-vl)
    // Register each specific path to avoid LLM fallback catching unrelated models
    // (e.g., LLM/llava-* should NOT map to AILab_QwenVL)
    quickRegister(
      'LLM/Qwen-VL/Qwen2.5-VL-3B-Instruct',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen2.5-VL-7B-Instruct',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-VL-2B-Instruct',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-VL-2B-Thinking',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-VL-4B-Instruct',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-VL-4B-Thinking',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-VL-8B-Instruct',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-VL-8B-Thinking',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-VL-32B-Instruct',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-VL-32B-Thinking',
      'AILab_QwenVL',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-0.6B',
      'AILab_QwenVL_PromptEnhancer',
      'model_name'
    )
    quickRegister(
      'LLM/Qwen-VL/Qwen3-4B-Instruct-2507',
      'AILab_QwenVL_PromptEnhancer',
      'model_name'
    )
    quickRegister('LLM/checkpoints', 'LoadChatGLM3', 'chatglm3_checkpoint')

    // Qwen3 TTS speech models (ComfyUI-FunBox)
    // Top-level 'qwen-tts' catches all qwen-tts/* subdirs via hierarchical fallback
    quickRegister('qwen-tts', 'FB_Qwen3TTSVoiceClone', 'model_choice')

    // DepthAnything V3 models (comfyui-depthanythingv2)
    quickRegister(
      'depthanything3',
      'DownloadAndLoadDepthAnythingV3Model',
      'model'
    )

    // LivePortrait face animation models (comfyui-liveportrait)
    quickRegister('liveportrait', 'DownloadAndLoadLivePortraitModels', '')

    // MimicMotion video generation models (ComfyUI-MimicMotionWrapper)
    quickRegister('mimicmotion', 'DownloadAndLoadMimicMotionModel', 'model')
    quickRegister('dwpose', 'MimicMotionGetPoses', '')

    // Face parsing segmentation models (comfyui_face_parsing)
    quickRegister('face_parsing', 'FaceParsingModelLoader(FaceParsing)', '')

    // Kolors image generation models (ComfyUI-KolorsWrapper)
    // Top-level 'diffusers' catches diffusers/Kolors/* subdirs
    quickRegister('diffusers', 'DownloadAndLoadKolorsModel', 'model')

    // CLIP models for HunyuanVideo (clip/clip-vit-large-patch14 subdir)
    quickRegister('clip', 'CLIPVisionLoader', 'clip_name')

    // RIFE video frame interpolation (ComfyUI-RIFE)
    quickRegister('rife', 'RIFE VFI', 'ckpt_name')

    // SAM3 3D segmentation models (comfyui-sam3)
    quickRegister('sam3', 'LoadSAM3Model', 'model_path')

    // UltraShape 3D model generation
    quickRegister('UltraShape', 'UltraShapeLoadModel', 'checkpoint')

    // SHaRP depth estimation
    quickRegister('sharp', 'LoadSharpModel', 'checkpoint_path')

    // ONNX upscale models (used by OnnxDetectionModelLoader and upscale nodes)
    quickRegister('onnx', 'UpscaleModelLoader', 'model_name')

    // Detection models (vitpose, yolo)
    quickRegister('detection', 'OnnxDetectionModelLoader', 'yolo_model')

    // HunyuanVideo text encoders (ComfyUI-HunyuanVideoWrapper)
    quickRegister(
      'LLM/llava-llama-3-8b-text-encoder-tokenizer',
      'DownloadAndLoadHyVideoTextEncoder',
      'llm_model'
    )
    quickRegister(
      'LLM/llava-llama-3-8b-v1_1-transformers',
      'DownloadAndLoadHyVideoTextEncoder',
      'llm_model'
    )

    // CogVideoX models (comfyui-cogvideoxwrapper)
    quickRegister('CogVideo/GGUF', 'DownloadAndLoadCogVideoGGUFModel', 'model')
    quickRegister(
      'CogVideo/ControlNet',
      'DownloadAndLoadCogVideoControlNet',
      'model'
    )

    // DynamiCrafter models (ComfyUI-DynamiCrafterWrapper)
    quickRegister(
      'checkpoints/dynamicrafter',
      'DownloadAndLoadDynamiCrafterModel',
      'model'
    )
    quickRegister(
      'checkpoints/dynamicrafter/controlnet',
      'DownloadAndLoadDynamiCrafterCNModel',
      'model'
    )

    // LayerStyle models (ComfyUI_LayerStyle_Advance)
    quickRegister('BEN', 'LS_LoadBenModel', 'model')
    quickRegister('BiRefNet/pth', 'LS_LoadBiRefNetModel', 'model')
    quickRegister('onnx/human-parts', 'LS_HumanPartsUltra', '')
    quickRegister('lama', 'LaMa', 'lama_model')

    // CogVideoX video generation models (comfyui-cogvideoxwrapper)
    quickRegister('CogVideo', 'DownloadAndLoadCogVideoModel', 'model')

    // Inpaint models (comfyui-inpaint-nodes)
    quickRegister('inpaint', 'INPAINT_LoadInpaintModel', 'model_name')

    // LayerDiffuse transparent image generation (comfyui-layerdiffuse)
    quickRegister('layer_model', 'LayeredDiffusionApply', 'config')

    // LTX Video prompt enhancer models (ComfyUI-LTXTricks)
    quickRegister(
      'LLM/Llama-3.2-3B-Instruct',
      'LTXVPromptEnhancerLoader',
      'llm_name'
    )
    quickRegister(
      'LLM/Florence-2-large-PromptGen-v2.0',
      'LTXVPromptEnhancerLoader',
      'image_captioner_name'
    )
  }

  return {
    modelToNodeMap,
    getRegisteredNodeTypes,
    getCategoryForNodeType,
    getNodeProvider,
    getAllNodeProviders,
    registerNodeProvider,
    quickRegister,
    registerDefaults
  }
})
