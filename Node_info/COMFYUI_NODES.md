# ComfyUI Nodes Structure

> Auto-generated documentation of all ComfyUI built-in nodes

## Summary

| Source | Node Count |
|--------|------------|
| Core (`nodes.py`) | 64 |
| Extras (`comfy_extras/`) | 351 |
| API (`comfy_api_nodes/`) | 118 |
| **Total** | **533** |

---

## Table of Contents

1. [Core Nodes](#1-core-nodes)
2. [Extra Nodes](#2-extra-nodes)
3. [API Nodes](#3-api-nodes)
4. [Nodes by Category](#4-nodes-by-category)

---

## 1. Core Nodes

**Source:** `nodes.py`  
**Count:** 64 nodes

These are the fundamental nodes that ship with ComfyUI.

| Node Name | Category |
|-----------|----------|
| `CLIPLoader` | - |
| `CLIPSetLastLayer` | - |
| `CLIPTextEncode` | - |
| `CLIPVisionEncode` | - |
| `CLIPVisionLoader` | - |
| `CheckpointLoader` | - |
| `CheckpointLoaderSimple` | - |
| `ConditioningAverage` | - |
| `ConditioningCombine` | - |
| `ConditioningConcat` | - |
| `ConditioningSetArea` | - |
| `ConditioningSetAreaPercentage` | - |
| `ConditioningSetAreaStrength` | - |
| `ConditioningSetMask` | - |
| `ConditioningSetTimestepRange` | - |
| `ConditioningZeroOut` | - |
| `ControlNetApply` | - |
| `ControlNetApplyAdvanced` | - |
| `ControlNetLoader` | - |
| `DiffControlNetLoader` | - |
| `DiffusersLoader` | - |
| `DualCLIPLoader` | - |
| `EmptyImage` | - |
| `EmptyLatentImage` | - |
| `GLIGENLoader` | - |
| `GLIGENTextBoxApply` | - |
| `ImageBatch` | - |
| `ImageInvert` | - |
| `ImagePadForOutpaint` | - |
| `ImageScale` | - |
| `ImageScaleBy` | - |
| `InpaintModelConditioning` | - |
| `KSampler` | - |
| `KSamplerAdvanced` | - |
| `LatentBlend` | - |
| `LatentComposite` | - |
| `LatentCrop` | - |
| `LatentFlip` | - |
| `LatentFromBatch` | - |
| `LatentRotate` | - |
| `LatentUpscale` | - |
| `LatentUpscaleBy` | - |
| `LoadImage` | - |
| `LoadImageMask` | - |
| `LoadImageOutput` | - |
| `LoadLatent` | - |
| `LoraLoader` | - |
| `LoraLoaderModelOnly` | - |
| `PreviewImage` | - |
| `RepeatLatentBatch` | - |
| `SaveImage` | - |
| `SaveLatent` | - |
| `SetLatentNoiseMask` | - |
| `StyleModelApply` | - |
| `StyleModelLoader` | - |
| `UNETLoader` | - |
| `VAEDecode` | - |
| `VAEDecodeTiled` | - |
| `VAEEncode` | - |
| `VAEEncodeForInpaint` | - |
| `VAEEncodeTiled` | - |
| `VAELoader` | - |
| `unCLIPCheckpointLoader` | - |
| `unCLIPConditioning` | - |

---

## 2. Extra Nodes

**Source:** `comfy_extras/`  
**Count:** 351 nodes

Extended functionality organized by feature modules.


### Ace

**File:** `comfy_extras/nodes_ace.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `EmptyAceStepLatentAudio` | latent/audio |
| `TextEncodeAceStepAudio` | conditioning |

### Advanced Samplers

**File:** `comfy_extras/nodes_advanced_samplers.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `SamplerEulerCFGpp` | _for_testing |
| `SamplerLCMUpscale` | sampling/custom_sampling/samplers |

### Align Your Steps

**File:** `comfy_extras/nodes_align_your_steps.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `AlignYourStepsScheduler` | sampling/custom_sampling/schedulers |

### Apg

**File:** `comfy_extras/nodes_apg.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `APG` | sampling/custom_sampling |

### Attention Multiply

**File:** `comfy_extras/nodes_attention_multiply.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPAttentionMultiply` | _for_testing/attention_experiments |
| `UNetCrossAttentionMultiply` | _for_testing/attention_experiments |
| `UNetSelfAttentionMultiply` | _for_testing/attention_experiments |
| `UNetTemporalAttentionMultiply` | _for_testing/attention_experiments |

### Audio

**File:** `comfy_extras/nodes_audio.py`  
**Count:** 16 nodes

| Node Name | Category |
|-----------|----------|
| `AudioAdjustVolume` | - |
| `AudioConcat` | - |
| `AudioMerge` | - |
| `ConditioningStableAudio` | - |
| `EmptyAudio` | - |
| `EmptyLatentAudio` | - |
| `LoadAudio` | - |
| `PreviewAudio` | - |
| `RecordAudio` | - |
| `SaveAudio` | - |
| `SaveAudioMP3` | - |
| `SaveAudioOpus` | - |
| `SplitAudioChannels` | - |
| `TrimAudioDuration` | - |
| `VAEDecodeAudio` | - |
| `VAEEncodeAudio` | - |

### Audio Encoder

**File:** `comfy_extras/nodes_audio_encoder.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `AudioEncoderEncode` | conditioning |
| `AudioEncoderLoader` | loaders |

### Camera Trajectory

**File:** `comfy_extras/nodes_camera_trajectory.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `WanCameraEmbedding` | camera |

### Canny

**File:** `comfy_extras/nodes_canny.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `Canny` | image/preprocessors |

### Cfg

**File:** `comfy_extras/nodes_cfg.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `CFGNorm` | advanced/guidance |
| `CFGZeroStar` | advanced/guidance |

### Chroma Radiance

**File:** `comfy_extras/nodes_chroma_radiance.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `ChromaRadianceOptions` | model_patches/chroma_radiance |
| `EmptyChromaRadianceLatentImage` | latent/chroma_radiance |

### Clip Sdxl

**File:** `comfy_extras/nodes_clip_sdxl.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPTextEncodeSDXL` | advanced/conditioning |
| `CLIPTextEncodeSDXLRefiner` | advanced/conditioning |

### Compositing

**File:** `comfy_extras/nodes_compositing.py`  
**Count:** 3 nodes

| Node Name | Category |
|-----------|----------|
| `JoinImageWithAlpha` | mask/compositing |
| `PorterDuffImageComposite` | mask/compositing |
| `SplitImageWithAlpha` | mask/compositing |

### Cond

**File:** `comfy_extras/nodes_cond.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPTextEncodeControlnet` | _for_testing/conditioning |
| `T5TokenizerOptions` | _for_testing/conditioning |

### Context Windows

**File:** `comfy_extras/nodes_context_windows.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `ContextWindowsManual` | context |
| `WanContextWindowsManual` | - |

### Controlnet

**File:** `comfy_extras/nodes_controlnet.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `ControlNetInpaintingAliMamaApply` | conditioning/controlnet |
| `SetUnionControlNetType` | conditioning/controlnet |

### Cosmos

**File:** `comfy_extras/nodes_cosmos.py`  
**Count:** 3 nodes

| Node Name | Category |
|-----------|----------|
| `CosmosImageToVideoLatent` | conditioning/inpaint |
| `CosmosPredict2ImageToVideoLatent` | conditioning/inpaint |
| `EmptyCosmosLatentVideo` | latent/video |

### Custom Sampler

**File:** `comfy_extras/nodes_custom_sampler.py`  
**Count:** 33 nodes

| Node Name | Category |
|-----------|----------|
| `AddNoise` | _for_testing/custom_sampling/noise |
| `BasicGuider` | sampling/custom_sampling/guiders |
| `BasicScheduler` | sampling/custom_sampling/schedulers |
| `BetaSamplingScheduler` | sampling/custom_sampling/schedulers |
| `CFGGuider` | sampling/custom_sampling/guiders |
| `DisableNoise` | sampling/custom_sampling/noise |
| `DualCFGGuider` | sampling/custom_sampling/guiders |
| `ExponentialScheduler` | sampling/custom_sampling/schedulers |
| `ExtendIntermediateSigmas` | sampling/custom_sampling/sigmas |
| `FlipSigmas` | sampling/custom_sampling/sigmas |
| `KSamplerSelect` | sampling/custom_sampling/samplers |
| `KarrasScheduler` | sampling/custom_sampling/schedulers |
| `LaplaceScheduler` | sampling/custom_sampling/schedulers |
| `PolyexponentialScheduler` | sampling/custom_sampling/schedulers |
| `RandomNoise` | sampling/custom_sampling |
| `SDTurboScheduler` | sampling/custom_sampling/schedulers |
| `SamplerCustom` | sampling/custom_sampling |
| `SamplerCustomAdvanced` | sampling/custom_sampling |
| `SamplerDPMAdaptative` | sampling/custom_sampling/samplers |
| `SamplerDPMPP_2M_SDE` | sampling/custom_sampling/samplers |
| `SamplerDPMPP_2S_Ancestral` | sampling/custom_sampling/samplers |
| `SamplerDPMPP_3M_SDE` | sampling/custom_sampling/samplers |
| `SamplerDPMPP_SDE` | sampling/custom_sampling/samplers |
| `SamplerER_SDE` | sampling/custom_sampling/samplers |
| `SamplerEulerAncestral` | sampling/custom_sampling/samplers |
| `SamplerEulerAncestralCFGPP` | sampling/custom_sampling/samplers |
| `SamplerLMS` | sampling/custom_sampling/samplers |
| `SamplerSASolver` | sampling/custom_sampling/samplers |
| `SamplingPercentToSigma` | sampling/custom_sampling/sigmas |
| `SetFirstSigma` | sampling/custom_sampling/sigmas |
| `SplitSigmas` | sampling/custom_sampling/sigmas |
| `SplitSigmasDenoise` | sampling/custom_sampling/sigmas |
| `VPScheduler` | sampling/custom_sampling/schedulers |

### Dataset

**File:** `comfy_extras/nodes_dataset.py`  
**Count:** 27 nodes

| Node Name | Category |
|-----------|----------|
| `AddTextPrefix` | - |
| `AddTextSuffix` | - |
| `AdjustBrightness` | dataset/image |
| `AdjustContrast` | dataset/image |
| `CenterCropImages` | dataset/image |
| `ImageDeduplication` | - |
| `ImageGrid` | - |
| `LoadImageDataSetFromFolder` | dataset |
| `LoadImageTextDataSetFromFolder` | dataset |
| `LoadTrainingDataset` | dataset |
| `MakeTrainingDataset` | dataset |
| `MergeImageLists` | - |
| `MergeTextLists` | - |
| `NormalizeImages` | dataset/image |
| `RandomCropImages` | dataset/image |
| `ReplaceText` | - |
| `ResizeImagesByLongerEdge` | dataset/image |
| `ResizeImagesByShorterEdge` | dataset/image |
| `SaveImageDataSetToFolder` | dataset |
| `SaveImageTextDataSetToFolder` | dataset |
| `SaveTrainingDataset` | dataset |
| `ShuffleDataset` | dataset/image |
| `ShuffleImageTextDataset` | dataset/image |
| `StripWhitespace` | - |
| `TextToLowercase` | - |
| `TextToUppercase` | - |
| `TruncateText` | - |

### Differential Diffusion

**File:** `comfy_extras/nodes_differential_diffusion.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `DifferentialDiffusion` | _for_testing |

### Easycache

**File:** `comfy_extras/nodes_easycache.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `EasyCache` | advanced/debug/model |
| `LazyCache` | advanced/debug/model |

### Edit Model

**File:** `comfy_extras/nodes_edit_model.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `ReferenceLatent` | advanced/conditioning/edit_models |

### Eps

**File:** `comfy_extras/nodes_eps.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `Epsilon Scaling` | model_patches/unet |
| `TemporalScoreRescaling` | model_patches/unet |

### Flux

**File:** `comfy_extras/nodes_flux.py`  
**Count:** 7 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPTextEncodeFlux` | advanced/conditioning/flux |
| `EmptyFlux2LatentImage` | latent |
| `Flux2Scheduler` | sampling/custom_sampling/schedulers |
| `FluxDisableGuidance` | advanced/conditioning/flux |
| `FluxGuidance` | advanced/conditioning/flux |
| `FluxKontextImageScale` | advanced/conditioning/flux |
| `FluxKontextMultiReferenceLatentMethod` | advanced/conditioning/flux |

### Freelunch

**File:** `comfy_extras/nodes_freelunch.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `FreeU` | - |
| `FreeU_V2` | - |

### Fresca

**File:** `comfy_extras/nodes_fresca.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `FreSca` | _for_testing |

### Gits

**File:** `comfy_extras/nodes_gits.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `GITSScheduler` | sampling/custom_sampling/schedulers |

### Hidream

**File:** `comfy_extras/nodes_hidream.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPTextEncodeHiDream` | advanced/conditioning |
| `QuadrupleCLIPLoader` | advanced/loaders |

### Hooks

**File:** `comfy_extras/nodes_hooks.py`  
**Count:** 20 nodes

| Node Name | Category |
|-----------|----------|
| `CombineHooks2` | - |
| `CombineHooks4` | - |
| `CombineHooks8` | - |
| `ConditioningSetDefaultCombine` | - |
| `ConditioningSetProperties` | - |
| `ConditioningSetPropertiesAndCombine` | - |
| `ConditioningTimestepsRange` | - |
| `CreateHookKeyframe` | - |
| `CreateHookKeyframesFromFloats` | - |
| `CreateHookKeyframesInterpolated` | - |
| `CreateHookLora` | - |
| `CreateHookLoraModelOnly` | - |
| `CreateHookModelAsLora` | - |
| `CreateHookModelAsLoraModelOnly` | - |
| `PairConditioningCombine` | - |
| `PairConditioningSetDefaultCombine` | - |
| `PairConditioningSetProperties` | - |
| `PairConditioningSetPropertiesAndCombine` | - |
| `SetClipHooks` | - |
| `SetHookKeyframes` | - |

### Hunyuan

**File:** `comfy_extras/nodes_hunyuan.py`  
**Count:** 11 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPTextEncodeHunyuanDiT` | advanced/conditioning |
| `EmptyHunyuanImageLatent` | latent |
| `EmptyHunyuanLatentVideo` | latent/video |
| `EmptyHunyuanVideo15Latent` | - |
| `HunyuanImageToVideo` | conditioning/video_models |
| `HunyuanRefinerLatent` | - |
| `HunyuanVideo15ImageToVideo` | conditioning/video_models |
| `HunyuanVideo15LatentUpscaleWithModel` | latent |
| `HunyuanVideo15SuperResolution` | - |
| `LatentUpscaleModelLoader` | loaders |
| `TextEncodeHunyuanVideo_ImageToVideo` | advanced/conditioning |

### Hunyuan3D

**File:** `comfy_extras/nodes_hunyuan3d.py`  
**Count:** 7 nodes

| Node Name | Category |
|-----------|----------|
| `EmptyLatentHunyuan3Dv2` | latent/3d |
| `Hunyuan3Dv2Conditioning` | conditioning/video_models |
| `Hunyuan3Dv2ConditioningMultiView` | conditioning/video_models |
| `SaveGLB` | 3d |
| `VAEDecodeHunyuan3D` | latent/3d |
| `VoxelToMesh` | 3d |
| `VoxelToMeshBasic` | 3d |

### Hypernetwork

**File:** `comfy_extras/nodes_hypernetwork.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `HypernetworkLoader` | loaders |

### Hypertile

**File:** `comfy_extras/nodes_hypertile.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `HyperTile` | model_patches/unet |

### Images

**File:** `comfy_extras/nodes_images.py`  
**Count:** 13 nodes

| Node Name | Category |
|-----------|----------|
| `GetImageSize` | - |
| `ImageAddNoise` | - |
| `ImageCrop` | - |
| `ImageFlip` | - |
| `ImageFromBatch` | - |
| `ImageRotate` | - |
| `ImageScaleToMaxDimension` | - |
| `ImageStitch` | - |
| `RepeatImageBatch` | - |
| `ResizeAndPadImage` | - |
| `SaveAnimatedPNG` | - |
| `SaveAnimatedWEBP` | - |
| `SaveSVGNode` | - |

### Ip2P

**File:** `comfy_extras/nodes_ip2p.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `InstructPixToPixConditioning` | conditioning/instructpix2pix |

### Latent

**File:** `comfy_extras/nodes_latent.py`  
**Count:** 12 nodes

| Node Name | Category |
|-----------|----------|
| `LatentAdd` | latent/advanced |
| `LatentApplyOperation` | latent/advanced/operations |
| `LatentApplyOperationCFG` | latent/advanced/operations |
| `LatentBatch` | latent/batch |
| `LatentBatchSeedBehavior` | latent/advanced |
| `LatentConcat` | latent/advanced |
| `LatentCut` | latent/advanced |
| `LatentInterpolate` | latent/advanced |
| `LatentMultiply` | latent/advanced |
| `LatentOperationSharpen` | latent/advanced/operations |
| `LatentOperationTonemapReinhard` | latent/advanced/operations |
| `LatentSubtract` | latent/advanced |

### Load 3D

**File:** `comfy_extras/nodes_load_3d.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `Load3D` | - |
| `Preview3D` | - |

### Lora Extract

**File:** `comfy_extras/nodes_lora_extract.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `LoraSave` | _for_testing |

### Lotus

**File:** `comfy_extras/nodes_lotus.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `LotusConditioning` | conditioning/lotus |

### Lt

**File:** `comfy_extras/nodes_lt.py`  
**Count:** 8 nodes

| Node Name | Category |
|-----------|----------|
| `EmptyLTXVLatentVideo` | latent/video/ltxv |
| `LTXVAddGuide` | conditioning/video_models |
| `LTXVConditioning` | conditioning/video_models |
| `LTXVCropGuides` | conditioning/video_models |
| `LTXVImgToVideo` | conditioning/video_models |
| `LTXVPreprocess` | image |
| `LTXVScheduler` | sampling/custom_sampling/schedulers |
| `ModelSamplingLTXV` | advanced/model |

### Lumina2

**File:** `comfy_extras/nodes_lumina2.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPTextEncodeLumina2` | conditioning |
| `RenormCFG` | advanced/model |

### Mahiro

**File:** `comfy_extras/nodes_mahiro.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `Mahiro` | _for_testing |

### Mask

**File:** `comfy_extras/nodes_mask.py`  
**Count:** 13 nodes

| Node Name | Category |
|-----------|----------|
| `CropMask` | - |
| `FeatherMask` | - |
| `GrowMask` | - |
| `ImageColorToMask` | - |
| `ImageCompositeMasked` | - |
| `ImageToMask` | - |
| `InvertMask` | - |
| `LatentCompositeMasked` | - |
| `MaskComposite` | - |
| `MaskPreview` | - |
| `MaskToImage` | - |
| `SolidMask` | - |
| `ThresholdMask` | - |

### Mochi

**File:** `comfy_extras/nodes_mochi.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `EmptyMochiLatentVideo` | latent/video |

### Model Advanced

**File:** `comfy_extras/nodes_model_advanced.py`  
**Count:** 9 nodes

| Node Name | Category |
|-----------|----------|
| `ModelComputeDtype` | - |
| `ModelSamplingAuraFlow` | - |
| `ModelSamplingContinuousEDM` | - |
| `ModelSamplingContinuousV` | - |
| `ModelSamplingDiscrete` | - |
| `ModelSamplingFlux` | - |
| `ModelSamplingSD3` | - |
| `ModelSamplingStableCascade` | - |
| `RescaleCFG` | - |

### Model Downscale

**File:** `comfy_extras/nodes_model_downscale.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `PatchModelAddDownscale` | model_patches/unet |

### Model Merging

**File:** `comfy_extras/nodes_model_merging.py`  
**Count:** 11 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPMergeAdd` | - |
| `CLIPMergeSimple` | - |
| `CLIPMergeSubtract` | - |
| `CLIPSave` | - |
| `CheckpointSave` | - |
| `ModelMergeAdd` | - |
| `ModelMergeBlocks` | - |
| `ModelMergeSimple` | - |
| `ModelMergeSubtract` | - |
| `ModelSave` | - |
| `VAESave` | - |

### Model Merging Model Specific

**File:** `comfy_extras/nodes_model_merging_model_specific.py`  
**Count:** 15 nodes

| Node Name | Category |
|-----------|----------|
| `ModelMergeAuraflow` | - |
| `ModelMergeCosmos14B` | - |
| `ModelMergeCosmos7B` | - |
| `ModelMergeCosmosPredict2_14B` | - |
| `ModelMergeCosmosPredict2_2B` | - |
| `ModelMergeFlux1` | - |
| `ModelMergeLTXV` | - |
| `ModelMergeMochiPreview` | - |
| `ModelMergeQwenImage` | - |
| `ModelMergeSD1` | - |
| `ModelMergeSD2` | - |
| `ModelMergeSD35_Large` | - |
| `ModelMergeSD3_2B` | - |
| `ModelMergeSDXL` | - |
| `ModelMergeWAN2_1` | - |

### Model Patch

**File:** `comfy_extras/nodes_model_patch.py`  
**Count:** 3 nodes

| Node Name | Category |
|-----------|----------|
| `ModelPatchLoader` | - |
| `QwenImageDiffsynthControlnet` | - |
| `USOStyleReference` | - |

### Morphology

**File:** `comfy_extras/nodes_morphology.py`  
**Count:** 3 nodes

| Node Name | Category |
|-----------|----------|
| `ImageRGBToYUV` | image/batch |
| `ImageYUVToRGB` | image/batch |
| `Morphology` | image/postprocessing |

### Nop

**File:** `comfy_extras/nodes_nop.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `wanBlockSwap` | - |

### Optimalsteps

**File:** `comfy_extras/nodes_optimalsteps.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `OptimalStepsScheduler` | sampling/custom_sampling/schedulers |

### Pag

**File:** `comfy_extras/nodes_pag.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `PerturbedAttentionGuidance` | model_patches/unet |

### Perpneg

**File:** `comfy_extras/nodes_perpneg.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `PerpNeg` | _for_testing |
| `PerpNegGuider` | _for_testing |

### Photomaker

**File:** `comfy_extras/nodes_photomaker.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `PhotoMakerEncode` | _for_testing/photomaker |
| `PhotoMakerLoader` | _for_testing/photomaker |

### Pixart

**File:** `comfy_extras/nodes_pixart.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPTextEncodePixArtAlpha` | advanced/conditioning |

### Post Processing

**File:** `comfy_extras/nodes_post_processing.py`  
**Count:** 5 nodes

| Node Name | Category |
|-----------|----------|
| `ImageBlend` | image/postprocessing |
| `ImageBlur` | image/postprocessing |
| `ImageQuantize` | image/postprocessing |
| `ImageScaleToTotalPixels` | image/upscaling |
| `ImageSharpen` | image/postprocessing |

### Preview Any

**File:** `comfy_extras/nodes_preview_any.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `PreviewAny` | - |

### Primitive

**File:** `comfy_extras/nodes_primitive.py`  
**Count:** 5 nodes

| Node Name | Category |
|-----------|----------|
| `PrimitiveBoolean` | utils/primitive |
| `PrimitiveFloat` | utils/primitive |
| `PrimitiveInt` | utils/primitive |
| `PrimitiveString` | utils/primitive |
| `PrimitiveStringMultiline` | utils/primitive |

### Qwen

**File:** `comfy_extras/nodes_qwen.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `TextEncodeQwenImageEdit` | advanced/conditioning |
| `TextEncodeQwenImageEditPlus` | advanced/conditioning |

### Rebatch

**File:** `comfy_extras/nodes_rebatch.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `RebatchImages` | image/batch |
| `RebatchLatents` | latent/batch |

### Rope

**File:** `comfy_extras/nodes_rope.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `ScaleROPE` | advanced/model_patches |

### Sag

**File:** `comfy_extras/nodes_sag.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `SelfAttentionGuidance` | _for_testing |

### Sd3

**File:** `comfy_extras/nodes_sd3.py`  
**Count:** 5 nodes

| Node Name | Category |
|-----------|----------|
| `CLIPTextEncodeSD3` | advanced/conditioning |
| `ControlNetApplySD3` | conditioning/controlnet |
| `EmptySD3LatentImage` | latent/sd3 |
| `SkipLayerGuidanceSD3` | advanced/guidance |
| `TripleCLIPLoader` | advanced/loaders |

### Sdupscale

**File:** `comfy_extras/nodes_sdupscale.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `SD_4XUpscale_Conditioning` | conditioning/upscale_diffusion |

### Slg

**File:** `comfy_extras/nodes_slg.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `SkipLayerGuidanceDiT` | advanced/guidance |
| `SkipLayerGuidanceDiTSimple` | advanced/guidance |

### Stable3D

**File:** `comfy_extras/nodes_stable3d.py`  
**Count:** 3 nodes

| Node Name | Category |
|-----------|----------|
| `SV3D_Conditioning` | conditioning/3d_models |
| `StableZero123_Conditioning` | conditioning/3d_models |
| `StableZero123_Conditioning_Batched` | conditioning/3d_models |

### Stable Cascade

**File:** `comfy_extras/nodes_stable_cascade.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `StableCascade_EmptyLatentImage` | latent/stable_cascade |
| `StableCascade_StageB_Conditioning` | conditioning/stable_cascade |
| `StableCascade_StageC_VAEEncode` | latent/stable_cascade |
| `StableCascade_SuperResolutionControlnet` | _for_testing/stable_cascade |

### String

**File:** `comfy_extras/nodes_string.py`  
**Count:** 11 nodes

| Node Name | Category |
|-----------|----------|
| `CaseConverter` | utils/string |
| `RegexExtract` | utils/string |
| `RegexMatch` | utils/string |
| `RegexReplace` | utils/string |
| `StringCompare` | utils/string |
| `StringConcatenate` | utils/string |
| `StringContains` | utils/string |
| `StringLength` | utils/string |
| `StringReplace` | utils/string |
| `StringSubstring` | utils/string |
| `StringTrim` | utils/string |

### Tcfg

**File:** `comfy_extras/nodes_tcfg.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `TCFG` | advanced/guidance |

### Tomesd

**File:** `comfy_extras/nodes_tomesd.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `TomePatchModel` | model_patches/unet |

### Torch Compile

**File:** `comfy_extras/nodes_torch_compile.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `TorchCompileModel` | _for_testing |

### Train

**File:** `comfy_extras/nodes_train.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `LoraModelLoader` | loaders |
| `LossGraphNode` | training |
| `SaveLoRA` | loaders |
| `TrainLoraNode` | training |

### Upscale Model

**File:** `comfy_extras/nodes_upscale_model.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `ImageUpscaleWithModel` | image/upscaling |
| `UpscaleModelLoader` | loaders |

### Video

**File:** `comfy_extras/nodes_video.py`  
**Count:** 5 nodes

| Node Name | Category |
|-----------|----------|
| `CreateVideo` | image/video |
| `GetVideoComponents` | image/video |
| `LoadVideo` | image/video |
| `SaveVideo` | image/video |
| `SaveWEBM` | image/video |

### Video Model

**File:** `comfy_extras/nodes_video_model.py`  
**Count:** 6 nodes

| Node Name | Category |
|-----------|----------|
| `ConditioningSetAreaPercentageVideo` | - |
| `ImageOnlyCheckpointLoader` | - |
| `ImageOnlyCheckpointSave` | - |
| `SVD_img2vid_Conditioning` | - |
| `VideoLinearCFGGuidance` | - |
| `VideoTriangleCFGGuidance` | - |

### Wan

**File:** `comfy_extras/nodes_wan.py`  
**Count:** 15 nodes

| Node Name | Category |
|-----------|----------|
| `TrimVideoLatent` | latent/video |
| `Wan22FunControlToVideo` | conditioning/video_models |
| `Wan22ImageToVideoLatent` | conditioning/inpaint |
| `WanAnimateToVideo` | conditioning/video_models |
| `WanCameraImageToVideo` | conditioning/video_models |
| `WanFirstLastFrameToVideo` | conditioning/video_models |
| `WanFunControlToVideo` | conditioning/video_models |
| `WanFunInpaintToVideo` | conditioning/video_models |
| `WanHuMoImageToVideo` | conditioning/video_models |
| `WanImageToVideo` | conditioning/video_models |
| `WanPhantomSubjectToVideo` | conditioning/video_models |
| `WanSoundImageToVideo` | conditioning/video_models |
| `WanSoundImageToVideoExtend` | conditioning/video_models |
| `WanTrackToVideo` | conditioning/video_models |
| `WanVaceToVideo` | conditioning/video_models |

### Webcam

**File:** `comfy_extras/nodes_webcam.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `WebcamCapture` | - |

---

## 3. API Nodes

**Source:** `comfy_api_nodes/`  
**Count:** 118 nodes

External API integrations for cloud services.


### BFL

**File:** `comfy_api_nodes/nodes_bfl.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `Flux2ProImageNode` | api node/image/BFL |
| `FluxProExpandNode` | api node/image/BFL |
| `FluxProFillNode` | api node/image/BFL |
| `FluxProUltraImageNode` | api node/image/BFL |

### BYTEDANCE

**File:** `comfy_api_nodes/nodes_bytedance.py`  
**Count:** 7 nodes

| Node Name | Category |
|-----------|----------|
| `ByteDanceFirstLastFrameNode` | api node/video/ByteDance |
| `ByteDanceImageEditNode` | api node/image/ByteDance |
| `ByteDanceImageNode` | api node/image/ByteDance |
| `ByteDanceImageReferenceNode` | api node/video/ByteDance |
| `ByteDanceImageToVideoNode` | api node/video/ByteDance |
| `ByteDanceSeedreamNode` | api node/image/ByteDance |
| `ByteDanceTextToVideoNode` | api node/video/ByteDance |

### GEMINI

**File:** `comfy_api_nodes/nodes_gemini.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `GeminiImage2Node` | api node/image/Gemini |
| `GeminiImageNode` | api node/image/Gemini |
| `GeminiInputFiles` | api node/text/Gemini |
| `GeminiNode` | api node/text/Gemini |

### IDEOGRAM

**File:** `comfy_api_nodes/nodes_ideogram.py`  
**Count:** 3 nodes

| Node Name | Category |
|-----------|----------|
| `IdeogramV1` | api node/image/Ideogram |
| `IdeogramV2` | api node/image/Ideogram |
| `IdeogramV3` | api node/image/Ideogram |

### KLING

**File:** `comfy_api_nodes/nodes_kling.py`  
**Count:** 13 nodes

| Node Name | Category |
|-----------|----------|
| `KlingCameraControlI2VNode` | api node/video/Kling |
| `KlingCameraControlT2VNode` | api node/video/Kling |
| `KlingCameraControls` | api node/video/Kling |
| `KlingDualCharacterVideoEffectNode` | api node/video/Kling |
| `KlingImage2VideoNode` | api node/video/Kling |
| `KlingImageGenerationNode` | api node/image/Kling |
| `KlingLipSyncAudioToVideoNode` | api node/video/Kling |
| `KlingLipSyncTextToVideoNode` | api node/video/Kling |
| `KlingSingleImageVideoEffectNode` | api node/video/Kling |
| `KlingStartEndFrameNode` | api node/video/Kling |
| `KlingTextToVideoNode` | api node/video/Kling |
| `KlingVideoExtendNode` | api node/video/Kling |
| `KlingVirtualTryOnNode` | api node/image/Kling |

### LTXV

**File:** `comfy_api_nodes/nodes_ltxv.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `LtxvApiImageToVideo` | api node/video/LTXV |
| `LtxvApiTextToVideo` | api node/video/LTXV |

### LUMA

**File:** `comfy_api_nodes/nodes_luma.py`  
**Count:** 6 nodes

| Node Name | Category |
|-----------|----------|
| `LumaConceptsNode` | api node/video/Luma |
| `LumaImageModifyNode` | api node/image/Luma |
| `LumaImageNode` | api node/image/Luma |
| `LumaImageToVideoNode` | api node/video/Luma |
| `LumaReferenceNode` | api node/image/Luma |
| `LumaVideoNode` | api node/video/Luma |

### MINIMAX

**File:** `comfy_api_nodes/nodes_minimax.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `MinimaxHailuoVideoNode` | api node/video/MiniMax |
| `MinimaxImageToVideoNode` | api node/video/MiniMax |
| `MinimaxSubjectToVideoNode` | api node/video/MiniMax |
| `MinimaxTextToVideoNode` | api node/video/MiniMax |

### MOONVALLEY

**File:** `comfy_api_nodes/nodes_moonvalley.py`  
**Count:** 3 nodes

| Node Name | Category |
|-----------|----------|
| `MoonvalleyImg2VideoNode` | api node/video/Moonvalley Marey |
| `MoonvalleyTxt2VideoNode` | api node/video/Moonvalley Marey |
| `MoonvalleyVideo2VideoNode` | api node/video/Moonvalley Marey |

### OPENAI

**File:** `comfy_api_nodes/nodes_openai.py`  
**Count:** 6 nodes

| Node Name | Category |
|-----------|----------|
| `OpenAIChatConfig` | api node/text/OpenAI |
| `OpenAIChatNode` | api node/text/OpenAI |
| `OpenAIDalle2` | api node/image/OpenAI |
| `OpenAIDalle3` | api node/image/OpenAI |
| `OpenAIGPTImage1` | api node/image/OpenAI |
| `OpenAIInputFiles` | api node/text/OpenAI |

### PIKA

**File:** `comfy_api_nodes/nodes_pika.py`  
**Count:** 7 nodes

| Node Name | Category |
|-----------|----------|
| `PikaImageToVideoNode2_2` | api node/video/Pika |
| `PikaScenesV2_2` | api node/video/Pika |
| `PikaStartEndFrameNode2_2` | api node/video/Pika |
| `PikaTextToVideoNode2_2` | api node/video/Pika |
| `Pikadditions` | api node/video/Pika |
| `Pikaffects` | api node/video/Pika |
| `Pikaswaps` | api node/video/Pika |

### PIXVERSE

**File:** `comfy_api_nodes/nodes_pixverse.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `PixverseImageToVideoNode` | api node/video/PixVerse |
| `PixverseTemplateNode` | api node/video/PixVerse |
| `PixverseTextToVideoNode` | api node/video/PixVerse |
| `PixverseTransitionVideoNode` | api node/video/PixVerse |

### RECRAFT

**File:** `comfy_api_nodes/nodes_recraft.py`  
**Count:** 16 nodes

| Node Name | Category |
|-----------|----------|
| `RecraftColorRGB` | api node/image/Recraft |
| `RecraftControls` | api node/image/Recraft |
| `RecraftCreativeUpscaleNode` | api node/image/Recraft |
| `RecraftCrispUpscaleNode` | api node/image/Recraft |
| `RecraftImageInpaintingNode` | api node/image/Recraft |
| `RecraftImageToImageNode` | api node/image/Recraft |
| `RecraftRemoveBackgroundNode` | api node/image/Recraft |
| `RecraftReplaceBackgroundNode` | api node/image/Recraft |
| `RecraftStyleV3DigitalIllustration` | api node/image/Recraft |
| `RecraftStyleV3InfiniteStyleLibrary` | api node/image/Recraft |
| `RecraftStyleV3LogoRaster` | api node/image/Recraft |
| `RecraftStyleV3RealisticImage` | api node/image/Recraft |
| `RecraftStyleV3VectorIllustrationNode` | api node/image/Recraft |
| `RecraftTextToImageNode` | api node/image/Recraft |
| `RecraftTextToVectorNode` | api node/image/Recraft |
| `RecraftVectorizeImageNode` | api node/image/Recraft |

### RODIN

**File:** `comfy_api_nodes/nodes_rodin.py`  
**Count:** 5 nodes

| Node Name | Category |
|-----------|----------|
| `Rodin3D_Detail` | api node/3d/Rodin |
| `Rodin3D_Gen2` | api node/3d/Rodin |
| `Rodin3D_Regular` | api node/3d/Rodin |
| `Rodin3D_Sketch` | api node/3d/Rodin |
| `Rodin3D_Smooth` | api node/3d/Rodin |

### RUNWAY

**File:** `comfy_api_nodes/nodes_runway.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `RunwayFirstLastFrameNode` | api node/video/Runway |
| `RunwayImageToVideoNodeGen3a` | api node/video/Runway |
| `RunwayImageToVideoNodeGen4` | api node/video/Runway |
| `RunwayTextToImageNode` | api node/image/Runway |

### SORA

**File:** `comfy_api_nodes/nodes_sora.py`  
**Count:** 1 nodes

| Node Name | Category |
|-----------|----------|
| `OpenAIVideoSora2` | api node/video/Sora |

### STABILITY

**File:** `comfy_api_nodes/nodes_stability.py`  
**Count:** 8 nodes

| Node Name | Category |
|-----------|----------|
| `StabilityAudioInpaint` | api node/image/Stability AI |
| `StabilityAudioToAudio` | api node/image/Stability AI |
| `StabilityStableImageSD_3_5Node` | api node/image/Stability AI |
| `StabilityStableImageUltraNode` | api node/image/Stability AI |
| `StabilityTextToAudio` | api node/image/Stability AI |
| `StabilityUpscaleConservativeNode` | api node/image/Stability AI |
| `StabilityUpscaleCreativeNode` | api node/image/Stability AI |
| `StabilityUpscaleFastNode` | api node/image/Stability AI |

### TOPAZ

**File:** `comfy_api_nodes/nodes_topaz.py`  
**Count:** 2 nodes

| Node Name | Category |
|-----------|----------|
| `TopazImageEnhance` | api node/image/Topaz |
| `TopazVideoEnhance` | api node/video/Topaz |

### TRIPO

**File:** `comfy_api_nodes/nodes_tripo.py`  
**Count:** 8 nodes

| Node Name | Category |
|-----------|----------|
| `TripoConversionNode` | api node/3d/Tripo |
| `TripoImageToModelNode` | api node/3d/Tripo |
| `TripoMultiviewToModelNode` | api node/3d/Tripo |
| `TripoRefineNode` | api node/3d/Tripo |
| `TripoRetargetNode` | api node/3d/Tripo |
| `TripoRigNode` | api node/3d/Tripo |
| `TripoTextToModelNode` | api node/3d/Tripo |
| `TripoTextureNode` | api node/3d/Tripo |

### VEO2

**File:** `comfy_api_nodes/nodes_veo2.py`  
**Count:** 3 nodes

| Node Name | Category |
|-----------|----------|
| `Veo3FirstLastFrameNode` | api node/video/Veo |
| `Veo3VideoGenerationNode` | api node/video/Veo |
| `VeoVideoGenerationNode` | api node/video/Veo |

### VIDU

**File:** `comfy_api_nodes/nodes_vidu.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `ViduImageToVideoNode` | api node/video/Vidu |
| `ViduReferenceVideoNode` | api node/video/Vidu |
| `ViduStartEndToVideoNode` | api node/video/Vidu |
| `ViduTextToVideoNode` | api node/video/Vidu |

### WAN

**File:** `comfy_api_nodes/nodes_wan.py`  
**Count:** 4 nodes

| Node Name | Category |
|-----------|----------|
| `WanImageToImageApi` | api node/image/Wan |
| `WanImageToVideoApi` | api node/video/Wan |
| `WanTextToImageApi` | api node/image/Wan |
| `WanTextToVideoApi` | api node/video/Wan |

---

## 4. Nodes by Category

Nodes grouped by their functional category.


### 3d

**Count:** 3 nodes

- `SaveGLB` [extras]
- `VoxelToMesh` [extras]
- `VoxelToMeshBasic` [extras]

### _for_testing

**Count:** 9 nodes

- `DifferentialDiffusion` [extras]
- `FreSca` [extras]
- `LoraSave` [extras]
- `Mahiro` [extras]
- `PerpNeg` [extras]
- `PerpNegGuider` [extras]
- `SamplerEulerCFGpp` [extras]
- `SelfAttentionGuidance` [extras]
- `TorchCompileModel` [extras]

### _for_testing/attention_experiments

**Count:** 4 nodes

- `CLIPAttentionMultiply` [extras]
- `UNetCrossAttentionMultiply` [extras]
- `UNetSelfAttentionMultiply` [extras]
- `UNetTemporalAttentionMultiply` [extras]

### _for_testing/conditioning

**Count:** 2 nodes

- `CLIPTextEncodeControlnet` [extras]
- `T5TokenizerOptions` [extras]

### _for_testing/custom_sampling/noise

**Count:** 1 nodes

- `AddNoise` [extras]

### _for_testing/photomaker

**Count:** 2 nodes

- `PhotoMakerEncode` [extras]
- `PhotoMakerLoader` [extras]

### _for_testing/stable_cascade

**Count:** 1 nodes

- `StableCascade_SuperResolutionControlnet` [extras]

### advanced/conditioning

**Count:** 9 nodes

- `CLIPTextEncodeHiDream` [extras]
- `CLIPTextEncodeHunyuanDiT` [extras]
- `CLIPTextEncodePixArtAlpha` [extras]
- `CLIPTextEncodeSD3` [extras]
- `CLIPTextEncodeSDXL` [extras]
- `CLIPTextEncodeSDXLRefiner` [extras]
- `TextEncodeHunyuanVideo_ImageToVideo` [extras]
- `TextEncodeQwenImageEdit` [extras]
- `TextEncodeQwenImageEditPlus` [extras]

### advanced/conditioning/edit_models

**Count:** 1 nodes

- `ReferenceLatent` [extras]

### advanced/conditioning/flux

**Count:** 5 nodes

- `CLIPTextEncodeFlux` [extras]
- `FluxDisableGuidance` [extras]
- `FluxGuidance` [extras]
- `FluxKontextImageScale` [extras]
- `FluxKontextMultiReferenceLatentMethod` [extras]

### advanced/debug/model

**Count:** 2 nodes

- `EasyCache` [extras]
- `LazyCache` [extras]

### advanced/guidance

**Count:** 6 nodes

- `CFGNorm` [extras]
- `CFGZeroStar` [extras]
- `SkipLayerGuidanceDiT` [extras]
- `SkipLayerGuidanceDiTSimple` [extras]
- `SkipLayerGuidanceSD3` [extras]
- `TCFG` [extras]

### advanced/loaders

**Count:** 2 nodes

- `QuadrupleCLIPLoader` [extras]
- `TripleCLIPLoader` [extras]

### advanced/model

**Count:** 2 nodes

- `ModelSamplingLTXV` [extras]
- `RenormCFG` [extras]

### advanced/model_patches

**Count:** 1 nodes

- `ScaleROPE` [extras]

### api node/3d/Rodin

**Count:** 5 nodes

- `Rodin3D_Detail` [api]
- `Rodin3D_Gen2` [api]
- `Rodin3D_Regular` [api]
- `Rodin3D_Sketch` [api]
- `Rodin3D_Smooth` [api]

### api node/3d/Tripo

**Count:** 8 nodes

- `TripoConversionNode` [api]
- `TripoImageToModelNode` [api]
- `TripoMultiviewToModelNode` [api]
- `TripoRefineNode` [api]
- `TripoRetargetNode` [api]
- `TripoRigNode` [api]
- `TripoTextToModelNode` [api]
- `TripoTextureNode` [api]

### api node/image/BFL

**Count:** 4 nodes

- `Flux2ProImageNode` [api]
- `FluxProExpandNode` [api]
- `FluxProFillNode` [api]
- `FluxProUltraImageNode` [api]

### api node/image/ByteDance

**Count:** 3 nodes

- `ByteDanceImageEditNode` [api]
- `ByteDanceImageNode` [api]
- `ByteDanceSeedreamNode` [api]

### api node/image/Gemini

**Count:** 2 nodes

- `GeminiImage2Node` [api]
- `GeminiImageNode` [api]

### api node/image/Ideogram

**Count:** 3 nodes

- `IdeogramV1` [api]
- `IdeogramV2` [api]
- `IdeogramV3` [api]

### api node/image/Kling

**Count:** 2 nodes

- `KlingImageGenerationNode` [api]
- `KlingVirtualTryOnNode` [api]

### api node/image/Luma

**Count:** 3 nodes

- `LumaImageModifyNode` [api]
- `LumaImageNode` [api]
- `LumaReferenceNode` [api]

### api node/image/OpenAI

**Count:** 3 nodes

- `OpenAIDalle2` [api]
- `OpenAIDalle3` [api]
- `OpenAIGPTImage1` [api]

### api node/image/Recraft

**Count:** 16 nodes

- `RecraftColorRGB` [api]
- `RecraftControls` [api]
- `RecraftCreativeUpscaleNode` [api]
- `RecraftCrispUpscaleNode` [api]
- `RecraftImageInpaintingNode` [api]
- `RecraftImageToImageNode` [api]
- `RecraftRemoveBackgroundNode` [api]
- `RecraftReplaceBackgroundNode` [api]
- `RecraftStyleV3DigitalIllustration` [api]
- `RecraftStyleV3InfiniteStyleLibrary` [api]
- `RecraftStyleV3LogoRaster` [api]
- `RecraftStyleV3RealisticImage` [api]
- `RecraftStyleV3VectorIllustrationNode` [api]
- `RecraftTextToImageNode` [api]
- `RecraftTextToVectorNode` [api]
- `RecraftVectorizeImageNode` [api]

### api node/image/Runway

**Count:** 1 nodes

- `RunwayTextToImageNode` [api]

### api node/image/Stability AI

**Count:** 8 nodes

- `StabilityAudioInpaint` [api]
- `StabilityAudioToAudio` [api]
- `StabilityStableImageSD_3_5Node` [api]
- `StabilityStableImageUltraNode` [api]
- `StabilityTextToAudio` [api]
- `StabilityUpscaleConservativeNode` [api]
- `StabilityUpscaleCreativeNode` [api]
- `StabilityUpscaleFastNode` [api]

### api node/image/Topaz

**Count:** 1 nodes

- `TopazImageEnhance` [api]

### api node/image/Wan

**Count:** 2 nodes

- `WanImageToImageApi` [api]
- `WanTextToImageApi` [api]

### api node/text/Gemini

**Count:** 2 nodes

- `GeminiInputFiles` [api]
- `GeminiNode` [api]

### api node/text/OpenAI

**Count:** 3 nodes

- `OpenAIChatConfig` [api]
- `OpenAIChatNode` [api]
- `OpenAIInputFiles` [api]

### api node/video/ByteDance

**Count:** 4 nodes

- `ByteDanceFirstLastFrameNode` [api]
- `ByteDanceImageReferenceNode` [api]
- `ByteDanceImageToVideoNode` [api]
- `ByteDanceTextToVideoNode` [api]

### api node/video/Kling

**Count:** 11 nodes

- `KlingCameraControlI2VNode` [api]
- `KlingCameraControlT2VNode` [api]
- `KlingCameraControls` [api]
- `KlingDualCharacterVideoEffectNode` [api]
- `KlingImage2VideoNode` [api]
- `KlingLipSyncAudioToVideoNode` [api]
- `KlingLipSyncTextToVideoNode` [api]
- `KlingSingleImageVideoEffectNode` [api]
- `KlingStartEndFrameNode` [api]
- `KlingTextToVideoNode` [api]
- `KlingVideoExtendNode` [api]

### api node/video/LTXV

**Count:** 2 nodes

- `LtxvApiImageToVideo` [api]
- `LtxvApiTextToVideo` [api]

### api node/video/Luma

**Count:** 3 nodes

- `LumaConceptsNode` [api]
- `LumaImageToVideoNode` [api]
- `LumaVideoNode` [api]

### api node/video/MiniMax

**Count:** 4 nodes

- `MinimaxHailuoVideoNode` [api]
- `MinimaxImageToVideoNode` [api]
- `MinimaxSubjectToVideoNode` [api]
- `MinimaxTextToVideoNode` [api]

### api node/video/Moonvalley Marey

**Count:** 3 nodes

- `MoonvalleyImg2VideoNode` [api]
- `MoonvalleyTxt2VideoNode` [api]
- `MoonvalleyVideo2VideoNode` [api]

### api node/video/Pika

**Count:** 7 nodes

- `PikaImageToVideoNode2_2` [api]
- `PikaScenesV2_2` [api]
- `PikaStartEndFrameNode2_2` [api]
- `PikaTextToVideoNode2_2` [api]
- `Pikadditions` [api]
- `Pikaffects` [api]
- `Pikaswaps` [api]

### api node/video/PixVerse

**Count:** 4 nodes

- `PixverseImageToVideoNode` [api]
- `PixverseTemplateNode` [api]
- `PixverseTextToVideoNode` [api]
- `PixverseTransitionVideoNode` [api]

### api node/video/Runway

**Count:** 3 nodes

- `RunwayFirstLastFrameNode` [api]
- `RunwayImageToVideoNodeGen3a` [api]
- `RunwayImageToVideoNodeGen4` [api]

### api node/video/Sora

**Count:** 1 nodes

- `OpenAIVideoSora2` [api]

### api node/video/Topaz

**Count:** 1 nodes

- `TopazVideoEnhance` [api]

### api node/video/Veo

**Count:** 3 nodes

- `Veo3FirstLastFrameNode` [api]
- `Veo3VideoGenerationNode` [api]
- `VeoVideoGenerationNode` [api]

### api node/video/Vidu

**Count:** 4 nodes

- `ViduImageToVideoNode` [api]
- `ViduReferenceVideoNode` [api]
- `ViduStartEndToVideoNode` [api]
- `ViduTextToVideoNode` [api]

### api node/video/Wan

**Count:** 2 nodes

- `WanImageToVideoApi` [api]
- `WanTextToVideoApi` [api]

### audio

**Count:** 16 nodes

- `AudioAdjustVolume` [extras]
- `AudioConcat` [extras]
- `AudioMerge` [extras]
- `ConditioningStableAudio` [extras]
- `EmptyAudio` [extras]
- `EmptyLatentAudio` [extras]
- `LoadAudio` [extras]
- `PreviewAudio` [extras]
- `RecordAudio` [extras]
- `SaveAudio` [extras]
- `SaveAudioMP3` [extras]
- `SaveAudioOpus` [extras]
- `SplitAudioChannels` [extras]
- `TrimAudioDuration` [extras]
- `VAEDecodeAudio` [extras]
- `VAEEncodeAudio` [extras]

### camera

**Count:** 1 nodes

- `WanCameraEmbedding` [extras]

### conditioning

**Count:** 3 nodes

- `AudioEncoderEncode` [extras]
- `CLIPTextEncodeLumina2` [extras]
- `TextEncodeAceStepAudio` [extras]

### conditioning/3d_models

**Count:** 3 nodes

- `SV3D_Conditioning` [extras]
- `StableZero123_Conditioning` [extras]
- `StableZero123_Conditioning_Batched` [extras]

### conditioning/controlnet

**Count:** 3 nodes

- `ControlNetApplySD3` [extras]
- `ControlNetInpaintingAliMamaApply` [extras]
- `SetUnionControlNetType` [extras]

### conditioning/inpaint

**Count:** 3 nodes

- `CosmosImageToVideoLatent` [extras]
- `CosmosPredict2ImageToVideoLatent` [extras]
- `Wan22ImageToVideoLatent` [extras]

### conditioning/instructpix2pix

**Count:** 1 nodes

- `InstructPixToPixConditioning` [extras]

### conditioning/lotus

**Count:** 1 nodes

- `LotusConditioning` [extras]

### conditioning/stable_cascade

**Count:** 1 nodes

- `StableCascade_StageB_Conditioning` [extras]

### conditioning/upscale_diffusion

**Count:** 1 nodes

- `SD_4XUpscale_Conditioning` [extras]

### conditioning/video_models

**Count:** 21 nodes

- `Hunyuan3Dv2Conditioning` [extras]
- `Hunyuan3Dv2ConditioningMultiView` [extras]
- `HunyuanImageToVideo` [extras]
- `HunyuanVideo15ImageToVideo` [extras]
- `LTXVAddGuide` [extras]
- `LTXVConditioning` [extras]
- `LTXVCropGuides` [extras]
- `LTXVImgToVideo` [extras]
- `Wan22FunControlToVideo` [extras]
- `WanAnimateToVideo` [extras]
- `WanCameraImageToVideo` [extras]
- `WanFirstLastFrameToVideo` [extras]
- `WanFunControlToVideo` [extras]
- `WanFunInpaintToVideo` [extras]
- `WanHuMoImageToVideo` [extras]
- `WanImageToVideo` [extras]
- `WanPhantomSubjectToVideo` [extras]
- `WanSoundImageToVideo` [extras]
- `WanSoundImageToVideoExtend` [extras]
- `WanTrackToVideo` [extras]
- `WanVaceToVideo` [extras]

### context

**Count:** 1 nodes

- `ContextWindowsManual` [extras]

### context_windows

**Count:** 1 nodes

- `WanContextWindowsManual` [extras]

### core

**Count:** 64 nodes

- `CLIPLoader` 
- `CLIPSetLastLayer` 
- `CLIPTextEncode` 
- `CLIPVisionEncode` 
- `CLIPVisionLoader` 
- `CheckpointLoader` 
- `CheckpointLoaderSimple` 
- `ConditioningAverage` 
- `ConditioningCombine` 
- `ConditioningConcat` 
- `ConditioningSetArea` 
- `ConditioningSetAreaPercentage` 
- `ConditioningSetAreaStrength` 
- `ConditioningSetMask` 
- `ConditioningSetTimestepRange` 
- `ConditioningZeroOut` 
- `ControlNetApply` 
- `ControlNetApplyAdvanced` 
- `ControlNetLoader` 
- `DiffControlNetLoader` 
- `DiffusersLoader` 
- `DualCLIPLoader` 
- `EmptyImage` 
- `EmptyLatentImage` 
- `GLIGENLoader` 
- `GLIGENTextBoxApply` 
- `ImageBatch` 
- `ImageInvert` 
- `ImagePadForOutpaint` 
- `ImageScale` 
- `ImageScaleBy` 
- `InpaintModelConditioning` 
- `KSampler` 
- `KSamplerAdvanced` 
- `LatentBlend` 
- `LatentComposite` 
- `LatentCrop` 
- `LatentFlip` 
- `LatentFromBatch` 
- `LatentRotate` 
- `LatentUpscale` 
- `LatentUpscaleBy` 
- `LoadImage` 
- `LoadImageMask` 
- `LoadImageOutput` 
- `LoadLatent` 
- `LoraLoader` 
- `LoraLoaderModelOnly` 
- `PreviewImage` 
- `RepeatLatentBatch` 
- `SaveImage` 
- `SaveLatent` 
- `SetLatentNoiseMask` 
- `StyleModelApply` 
- `StyleModelLoader` 
- `UNETLoader` 
- `VAEDecode` 
- `VAEDecodeTiled` 
- `VAEEncode` 
- `VAEEncodeForInpaint` 
- `VAEEncodeTiled` 
- `VAELoader` 
- `unCLIPCheckpointLoader` 
- `unCLIPConditioning` 

### dataset

**Count:** 18 nodes

- `AddTextPrefix` [extras]
- `AddTextSuffix` [extras]
- `ImageDeduplication` [extras]
- `ImageGrid` [extras]
- `LoadImageDataSetFromFolder` [extras]
- `LoadImageTextDataSetFromFolder` [extras]
- `LoadTrainingDataset` [extras]
- `MakeTrainingDataset` [extras]
- `MergeImageLists` [extras]
- `MergeTextLists` [extras]
- `ReplaceText` [extras]
- `SaveImageDataSetToFolder` [extras]
- `SaveImageTextDataSetToFolder` [extras]
- `SaveTrainingDataset` [extras]
- `StripWhitespace` [extras]
- `TextToLowercase` [extras]
- `TextToUppercase` [extras]
- `TruncateText` [extras]

### dataset/image

**Count:** 9 nodes

- `AdjustBrightness` [extras]
- `AdjustContrast` [extras]
- `CenterCropImages` [extras]
- `NormalizeImages` [extras]
- `RandomCropImages` [extras]
- `ResizeImagesByLongerEdge` [extras]
- `ResizeImagesByShorterEdge` [extras]
- `ShuffleDataset` [extras]
- `ShuffleImageTextDataset` [extras]

### freelunch

**Count:** 2 nodes

- `FreeU` [extras]
- `FreeU_V2` [extras]

### hooks

**Count:** 20 nodes

- `CombineHooks2` [extras]
- `CombineHooks4` [extras]
- `CombineHooks8` [extras]
- `ConditioningSetDefaultCombine` [extras]
- `ConditioningSetProperties` [extras]
- `ConditioningSetPropertiesAndCombine` [extras]
- `ConditioningTimestepsRange` [extras]
- `CreateHookKeyframe` [extras]
- `CreateHookKeyframesFromFloats` [extras]
- `CreateHookKeyframesInterpolated` [extras]
- `CreateHookLora` [extras]
- `CreateHookLoraModelOnly` [extras]
- `CreateHookModelAsLora` [extras]
- `CreateHookModelAsLoraModelOnly` [extras]
- `PairConditioningCombine` [extras]
- `PairConditioningSetDefaultCombine` [extras]
- `PairConditioningSetProperties` [extras]
- `PairConditioningSetPropertiesAndCombine` [extras]
- `SetClipHooks` [extras]
- `SetHookKeyframes` [extras]

### hunyuan

**Count:** 3 nodes

- `EmptyHunyuanVideo15Latent` [extras]
- `HunyuanRefinerLatent` [extras]
- `HunyuanVideo15SuperResolution` [extras]

### image

**Count:** 1 nodes

- `LTXVPreprocess` [extras]

### image/batch

**Count:** 3 nodes

- `ImageRGBToYUV` [extras]
- `ImageYUVToRGB` [extras]
- `RebatchImages` [extras]

### image/postprocessing

**Count:** 5 nodes

- `ImageBlend` [extras]
- `ImageBlur` [extras]
- `ImageQuantize` [extras]
- `ImageSharpen` [extras]
- `Morphology` [extras]

### image/preprocessors

**Count:** 1 nodes

- `Canny` [extras]

### image/upscaling

**Count:** 2 nodes

- `ImageScaleToTotalPixels` [extras]
- `ImageUpscaleWithModel` [extras]

### image/video

**Count:** 5 nodes

- `CreateVideo` [extras]
- `GetVideoComponents` [extras]
- `LoadVideo` [extras]
- `SaveVideo` [extras]
- `SaveWEBM` [extras]

### images

**Count:** 13 nodes

- `GetImageSize` [extras]
- `ImageAddNoise` [extras]
- `ImageCrop` [extras]
- `ImageFlip` [extras]
- `ImageFromBatch` [extras]
- `ImageRotate` [extras]
- `ImageScaleToMaxDimension` [extras]
- `ImageStitch` [extras]
- `RepeatImageBatch` [extras]
- `ResizeAndPadImage` [extras]
- `SaveAnimatedPNG` [extras]
- `SaveAnimatedWEBP` [extras]
- `SaveSVGNode` [extras]

### latent

**Count:** 3 nodes

- `EmptyFlux2LatentImage` [extras]
- `EmptyHunyuanImageLatent` [extras]
- `HunyuanVideo15LatentUpscaleWithModel` [extras]

### latent/3d

**Count:** 2 nodes

- `EmptyLatentHunyuan3Dv2` [extras]
- `VAEDecodeHunyuan3D` [extras]

### latent/advanced

**Count:** 7 nodes

- `LatentAdd` [extras]
- `LatentBatchSeedBehavior` [extras]
- `LatentConcat` [extras]
- `LatentCut` [extras]
- `LatentInterpolate` [extras]
- `LatentMultiply` [extras]
- `LatentSubtract` [extras]

### latent/advanced/operations

**Count:** 4 nodes

- `LatentApplyOperation` [extras]
- `LatentApplyOperationCFG` [extras]
- `LatentOperationSharpen` [extras]
- `LatentOperationTonemapReinhard` [extras]

### latent/audio

**Count:** 1 nodes

- `EmptyAceStepLatentAudio` [extras]

### latent/batch

**Count:** 2 nodes

- `LatentBatch` [extras]
- `RebatchLatents` [extras]

### latent/chroma_radiance

**Count:** 1 nodes

- `EmptyChromaRadianceLatentImage` [extras]

### latent/sd3

**Count:** 1 nodes

- `EmptySD3LatentImage` [extras]

### latent/stable_cascade

**Count:** 2 nodes

- `StableCascade_EmptyLatentImage` [extras]
- `StableCascade_StageC_VAEEncode` [extras]

### latent/video

**Count:** 4 nodes

- `EmptyCosmosLatentVideo` [extras]
- `EmptyHunyuanLatentVideo` [extras]
- `EmptyMochiLatentVideo` [extras]
- `TrimVideoLatent` [extras]

### latent/video/ltxv

**Count:** 1 nodes

- `EmptyLTXVLatentVideo` [extras]

### load_3d

**Count:** 2 nodes

- `Load3D` [extras]
- `Preview3D` [extras]

### loaders

**Count:** 6 nodes

- `AudioEncoderLoader` [extras]
- `HypernetworkLoader` [extras]
- `LatentUpscaleModelLoader` [extras]
- `LoraModelLoader` [extras]
- `SaveLoRA` [extras]
- `UpscaleModelLoader` [extras]

### mask

**Count:** 13 nodes

- `CropMask` [extras]
- `FeatherMask` [extras]
- `GrowMask` [extras]
- `ImageColorToMask` [extras]
- `ImageCompositeMasked` [extras]
- `ImageToMask` [extras]
- `InvertMask` [extras]
- `LatentCompositeMasked` [extras]
- `MaskComposite` [extras]
- `MaskPreview` [extras]
- `MaskToImage` [extras]
- `SolidMask` [extras]
- `ThresholdMask` [extras]

### mask/compositing

**Count:** 3 nodes

- `JoinImageWithAlpha` [extras]
- `PorterDuffImageComposite` [extras]
- `SplitImageWithAlpha` [extras]

### model_advanced

**Count:** 9 nodes

- `ModelComputeDtype` [extras]
- `ModelSamplingAuraFlow` [extras]
- `ModelSamplingContinuousEDM` [extras]
- `ModelSamplingContinuousV` [extras]
- `ModelSamplingDiscrete` [extras]
- `ModelSamplingFlux` [extras]
- `ModelSamplingSD3` [extras]
- `ModelSamplingStableCascade` [extras]
- `RescaleCFG` [extras]

### model_merging

**Count:** 11 nodes

- `CLIPMergeAdd` [extras]
- `CLIPMergeSimple` [extras]
- `CLIPMergeSubtract` [extras]
- `CLIPSave` [extras]
- `CheckpointSave` [extras]
- `ModelMergeAdd` [extras]
- `ModelMergeBlocks` [extras]
- `ModelMergeSimple` [extras]
- `ModelMergeSubtract` [extras]
- `ModelSave` [extras]
- `VAESave` [extras]

### model_merging_model_specific

**Count:** 15 nodes

- `ModelMergeAuraflow` [extras]
- `ModelMergeCosmos14B` [extras]
- `ModelMergeCosmos7B` [extras]
- `ModelMergeCosmosPredict2_14B` [extras]
- `ModelMergeCosmosPredict2_2B` [extras]
- `ModelMergeFlux1` [extras]
- `ModelMergeLTXV` [extras]
- `ModelMergeMochiPreview` [extras]
- `ModelMergeQwenImage` [extras]
- `ModelMergeSD1` [extras]
- `ModelMergeSD2` [extras]
- `ModelMergeSD35_Large` [extras]
- `ModelMergeSD3_2B` [extras]
- `ModelMergeSDXL` [extras]
- `ModelMergeWAN2_1` [extras]

### model_patch

**Count:** 3 nodes

- `ModelPatchLoader` [extras]
- `QwenImageDiffsynthControlnet` [extras]
- `USOStyleReference` [extras]

### model_patches/chroma_radiance

**Count:** 1 nodes

- `ChromaRadianceOptions` [extras]

### model_patches/unet

**Count:** 6 nodes

- `Epsilon Scaling` [extras]
- `HyperTile` [extras]
- `PatchModelAddDownscale` [extras]
- `PerturbedAttentionGuidance` [extras]
- `TemporalScoreRescaling` [extras]
- `TomePatchModel` [extras]

### nop

**Count:** 1 nodes

- `wanBlockSwap` [extras]

### preview_any

**Count:** 1 nodes

- `PreviewAny` [extras]

### sampling/custom_sampling

**Count:** 4 nodes

- `APG` [extras]
- `RandomNoise` [extras]
- `SamplerCustom` [extras]
- `SamplerCustomAdvanced` [extras]

### sampling/custom_sampling/guiders

**Count:** 3 nodes

- `BasicGuider` [extras]
- `CFGGuider` [extras]
- `DualCFGGuider` [extras]

### sampling/custom_sampling/noise

**Count:** 1 nodes

- `DisableNoise` [extras]

### sampling/custom_sampling/samplers

**Count:** 12 nodes

- `KSamplerSelect` [extras]
- `SamplerDPMAdaptative` [extras]
- `SamplerDPMPP_2M_SDE` [extras]
- `SamplerDPMPP_2S_Ancestral` [extras]
- `SamplerDPMPP_3M_SDE` [extras]
- `SamplerDPMPP_SDE` [extras]
- `SamplerER_SDE` [extras]
- `SamplerEulerAncestral` [extras]
- `SamplerEulerAncestralCFGPP` [extras]
- `SamplerLCMUpscale` [extras]
- `SamplerLMS` [extras]
- `SamplerSASolver` [extras]

### sampling/custom_sampling/schedulers

**Count:** 13 nodes

- `AlignYourStepsScheduler` [extras]
- `BasicScheduler` [extras]
- `BetaSamplingScheduler` [extras]
- `ExponentialScheduler` [extras]
- `Flux2Scheduler` [extras]
- `GITSScheduler` [extras]
- `KarrasScheduler` [extras]
- `LTXVScheduler` [extras]
- `LaplaceScheduler` [extras]
- `OptimalStepsScheduler` [extras]
- `PolyexponentialScheduler` [extras]
- `SDTurboScheduler` [extras]
- `VPScheduler` [extras]

### sampling/custom_sampling/sigmas

**Count:** 6 nodes

- `ExtendIntermediateSigmas` [extras]
- `FlipSigmas` [extras]
- `SamplingPercentToSigma` [extras]
- `SetFirstSigma` [extras]
- `SplitSigmas` [extras]
- `SplitSigmasDenoise` [extras]

### training

**Count:** 2 nodes

- `LossGraphNode` [extras]
- `TrainLoraNode` [extras]

### utils/primitive

**Count:** 5 nodes

- `PrimitiveBoolean` [extras]
- `PrimitiveFloat` [extras]
- `PrimitiveInt` [extras]
- `PrimitiveString` [extras]
- `PrimitiveStringMultiline` [extras]

### utils/string

**Count:** 11 nodes

- `CaseConverter` [extras]
- `RegexExtract` [extras]
- `RegexMatch` [extras]
- `RegexReplace` [extras]
- `StringCompare` [extras]
- `StringConcatenate` [extras]
- `StringContains` [extras]
- `StringLength` [extras]
- `StringReplace` [extras]
- `StringSubstring` [extras]
- `StringTrim` [extras]

### video_model

**Count:** 6 nodes

- `ConditioningSetAreaPercentageVideo` [extras]
- `ImageOnlyCheckpointLoader` [extras]
- `ImageOnlyCheckpointSave` [extras]
- `SVD_img2vid_Conditioning` [extras]
- `VideoLinearCFGGuidance` [extras]
- `VideoTriangleCFGGuidance` [extras]

### webcam

**Count:** 1 nodes

- `WebcamCapture` [extras]

---

## Node Registration Patterns

ComfyUI uses two main patterns for registering nodes:

### 1. Legacy Pattern (NODE_CLASS_MAPPINGS)

```python
NODE_CLASS_MAPPINGS = {
    "NodeName": NodeClass,
}
```

### 2. New Pattern (ComfyExtension + io.Schema)

```python
class MyNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MyNodeName",
            category="category/subcategory",
            inputs=[...],
            outputs=[...]
        )

class MyExtension(ComfyExtension):
    async def get_node_list(self):
        return [MyNode]
```

---

*Generated from ComfyUI source code*
