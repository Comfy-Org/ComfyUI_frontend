/**
 * Default mappings from model directories to loader nodes.
 *
 * Each entry maps a model folder (as it appears in the model browser)
 * to the node class that loads models from that folder and the
 * input key where the model name is inserted.
 *
 * An empty key ('') means the node auto-loads models without a widget
 * selector (createModelNodeFromAsset skips widget assignment).
 *
 * Hierarchical fallback is handled by the store: "a/b/c" tries
 * "a/b/c" → "a/b" → "a", so registering a parent directory covers
 * all its children unless a more specific entry exists.
 *
 * Format: [modelDirectory, nodeClass, inputKey]
 */
export const MODEL_NODE_MAPPINGS: ReadonlyArray<
  readonly [string, string, string]
> = [
  // ---- ComfyUI core loaders ----
  ['checkpoints', 'CheckpointLoaderSimple', 'ckpt_name'],
  ['checkpoints', 'ImageOnlyCheckpointLoader', 'ckpt_name'],
  ['loras', 'LoraLoader', 'lora_name'],
  ['loras', 'LoraLoaderModelOnly', 'lora_name'],
  ['vae', 'VAELoader', 'vae_name'],
  ['controlnet', 'ControlNetLoader', 'control_net_name'],
  ['diffusion_models', 'UNETLoader', 'unet_name'],
  ['upscale_models', 'UpscaleModelLoader', 'model_name'],
  ['style_models', 'StyleModelLoader', 'style_model_name'],
  ['gligen', 'GLIGENLoader', 'gligen_name'],
  ['clip_vision', 'CLIPVisionLoader', 'clip_name'],
  ['text_encoders', 'CLIPLoader', 'clip_name'],
  ['audio_encoders', 'AudioEncoderLoader', 'audio_encoder_name'],
  ['model_patches', 'ModelPatchLoader', 'name'],
  ['latent_upscale_models', 'LatentUpscaleModelLoader', 'model_name'],
  ['clip', 'CLIPVisionLoader', 'clip_name'],

  // ---- AnimateDiff (comfyui-animatediff-evolved) ----
  ['animatediff_models', 'ADE_LoadAnimateDiffModel', 'model_name'],
  ['animatediff_motion_lora', 'ADE_AnimateDiffLoRALoader', 'name'],

  // ---- Chatterbox TTS (ComfyUI-Fill-Nodes) ----
  ['chatterbox/chatterbox', 'FL_ChatterboxTTS', ''],
  ['chatterbox/chatterbox_turbo', 'FL_ChatterboxTurboTTS', ''],
  ['chatterbox/chatterbox_multilingual', 'FL_ChatterboxMultilingualTTS', ''],
  ['chatterbox/chatterbox_vc', 'FL_ChatterboxVC', ''],

  // ---- SAM / SAM2 (comfyui-segment-anything-2, comfyui-impact-pack) ----
  ['sam2', 'DownloadAndLoadSAM2Model', 'model'],
  ['sams', 'SAMLoader', 'model_name'],

  // ---- SAM3 3D segmentation (comfyui-sam3) ----
  ['sam3', 'LoadSAM3Model', 'model_path'],

  // ---- Ultralytics detection (comfyui-impact-subpack) ----
  ['ultralytics', 'UltralyticsDetectorProvider', 'model_name'],

  // ---- DepthAnything (comfyui-depthanythingv2, comfyui-depthanythingv3) ----
  ['depthanything', 'DownloadAndLoadDepthAnythingV2Model', 'model'],
  ['depthanything3', 'DownloadAndLoadDepthAnythingV3Model', 'model'],

  // ---- IP-Adapter (comfyui_ipadapter_plus) ----
  ['ipadapter', 'IPAdapterModelLoader', 'ipadapter_file'],

  // ---- Segformer (comfyui_layerstyle) ----
  ['segformer_b2_clothes', 'LS_LoadSegformerModel', 'model_name'],
  ['segformer_b3_clothes', 'LS_LoadSegformerModel', 'model_name'],
  ['segformer_b3_fashion', 'LS_LoadSegformerModel', 'model_name'],

  // ---- NLF pose estimation (ComfyUI-WanVideoWrapper) ----
  ['nlf', 'LoadNLFModel', 'nlf_model'],

  // ---- FlashVSR video super-resolution (ComfyUI-FlashVSR_Ultra_Fast) ----
  ['FlashVSR', 'FlashVSRNode', ''],
  ['FlashVSR-v1.1', 'FlashVSRNode', ''],

  // ---- SEEDVR2 video upscaling (comfyui-seedvr2) ----
  ['SEEDVR2', 'SeedVR2LoadDiTModel', 'model'],

  // ---- Qwen VL vision-language (comfyui-qwen-vl) ----
  ['LLM/Qwen-VL/Qwen2.5-VL-3B-Instruct', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen2.5-VL-7B-Instruct', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen3-VL-2B-Instruct', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen3-VL-2B-Thinking', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen3-VL-4B-Instruct', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen3-VL-4B-Thinking', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen3-VL-8B-Instruct', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen3-VL-8B-Thinking', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen3-VL-32B-Instruct', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen3-VL-32B-Thinking', 'AILab_QwenVL', 'model_name'],
  ['LLM/Qwen-VL/Qwen3-0.6B', 'AILab_QwenVL_PromptEnhancer', 'model_name'],
  [
    'LLM/Qwen-VL/Qwen3-4B-Instruct-2507',
    'AILab_QwenVL_PromptEnhancer',
    'model_name'
  ],
  ['LLM/checkpoints', 'LoadChatGLM3', 'chatglm3_checkpoint'],

  // ---- Qwen3 TTS (ComfyUI-FunBox) ----
  ['qwen-tts', 'FB_Qwen3TTSVoiceClone', 'model_choice'],

  // ---- LivePortrait (comfyui-liveportrait) ----
  ['liveportrait', 'DownloadAndLoadLivePortraitModels', ''],

  // ---- MimicMotion (ComfyUI-MimicMotionWrapper) ----
  ['mimicmotion', 'DownloadAndLoadMimicMotionModel', 'model'],
  ['dwpose', 'MimicMotionGetPoses', ''],

  // ---- Face parsing (comfyui_face_parsing) ----
  ['face_parsing', 'FaceParsingModelLoader(FaceParsing)', ''],

  // ---- Kolors (ComfyUI-KolorsWrapper) ----
  ['diffusers', 'DownloadAndLoadKolorsModel', 'model'],

  // ---- RIFE video frame interpolation (ComfyUI-RIFE) ----
  ['rife', 'RIFE VFI', 'ckpt_name'],

  // ---- UltraShape 3D model generation ----
  ['UltraShape', 'UltraShapeLoadModel', 'checkpoint'],

  // ---- SHaRP depth estimation ----
  ['sharp', 'LoadSharpModel', 'checkpoint_path'],

  // ---- ONNX upscale models ----
  ['onnx', 'UpscaleModelLoader', 'model_name'],

  // ---- Detection models (vitpose, yolo) ----
  ['detection', 'OnnxDetectionModelLoader', 'yolo_model'],

  // ---- HunyuanVideo text encoders (ComfyUI-HunyuanVideoWrapper) ----
  [
    'LLM/llava-llama-3-8b-text-encoder-tokenizer',
    'DownloadAndLoadHyVideoTextEncoder',
    'llm_model'
  ],
  [
    'LLM/llava-llama-3-8b-v1_1-transformers',
    'DownloadAndLoadHyVideoTextEncoder',
    'llm_model'
  ],

  // ---- CogVideoX (comfyui-cogvideoxwrapper) ----
  ['CogVideo', 'DownloadAndLoadCogVideoModel', ''],
  ['CogVideo/GGUF', 'DownloadAndLoadCogVideoGGUFModel', 'model'],
  ['CogVideo/ControlNet', 'DownloadAndLoadCogVideoControlNet', ''],

  // ---- DynamiCrafter (ComfyUI-DynamiCrafterWrapper) ----
  ['checkpoints/dynamicrafter', 'DownloadAndLoadDynamiCrafterModel', 'model'],
  [
    'checkpoints/dynamicrafter/controlnet',
    'DownloadAndLoadDynamiCrafterCNModel',
    'model'
  ],

  // ---- LayerStyle (ComfyUI_LayerStyle_Advance) ----
  ['BEN', 'LS_LoadBenModel', 'model'],
  ['BiRefNet/pth', 'LS_LoadBiRefNetModel', 'model'],
  ['onnx/human-parts', 'LS_HumanPartsUltra', ''],
  ['lama', 'LaMa', 'lama_model'],

  // ---- Inpaint (comfyui-inpaint-nodes) ----
  ['inpaint', 'INPAINT_LoadInpaintModel', 'model_name'],

  // ---- LayerDiffuse (comfyui-layerdiffuse) ----
  ['layer_model', 'LayeredDiffusionApply', 'config'],

  // ---- LTX Video prompt enhancer (ComfyUI-LTXTricks) ----
  ['LLM/Llama-3.2-3B-Instruct', 'LTXVPromptEnhancerLoader', 'llm_name'],
  [
    'LLM/Florence-2-large-PromptGen-v2.0',
    'LTXVPromptEnhancerLoader',
    'image_captioner_name'
  ]
] as const satisfies ReadonlyArray<
  readonly [string, string, string]
>
