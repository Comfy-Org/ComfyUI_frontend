export const CORE_TEMPLATES = [
  {
    moduleName: 'default',
    title: 'Comfy - Basic',
    type: 'image',
    templates: ['default', 'image2image', 'embedding_example']
  },
  {
    moduleName: 'default',
    title: 'Comfy - Advanced',
    templates: ['hypernetwork_example', 'noisy_latents_3_subjects']
  },
  {
    moduleName: 'default',
    title: 'Comfy - Video',
    type: 'video',
    templates: [
      'image_to_video',
      'txt_to_image_to_video',
      'ltxv_image_to_video',
      'ltxv_text_to_video',
      'mochi_text_to_video_example',
      // 'mochi_simple_checkpoint', // not able to extract workflow from this
      'hunyuan_video_text_to_video',
      'hunyuan_dit_1.2_example'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - Flux',
    type: 'image',
    templates: [
      'flux_schnell',
      'flux_fill_outpaint_example',
      'flux_redux_model_example',
      'flux_controlnet_example',
      'flux_dev_checkpoint_example',
      'flux_dev_example',
      'flux_fill_inpaint_example',
      'flux_canny_model_example',
      'flux_depth_lora_example'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - Aura Flow',
    type: 'image',
    templates: ['aura_flow_0.2_example', 'aura_flow_0.1_example']
  },
  {
    moduleName: 'default',
    title: 'Comfy - Stable Cascade',
    type: 'image',
    templates: [
      'stable_cascade__inpaint_controlnet',
      'stable_cascade__image_to_image',
      'stable_cascade__image_remixing',
      'stable_cascade__text_to_image',
      'stable_cascade__canny_controlnet',
      'stable_cascade__image_remixing_multiple'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - SDXL',
    type: 'image',
    templates: [
      'sdxl_simple_example',
      'sdxl_refiner_prompt_example',
      'sdxl_edit_model',
      'sdxl_revision_text_prompts',
      'sdxl_revision_zero_positive',
      'sdxlturbo_example'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - SD3.5',
    type: 'image',
    templates: [
      'sd3.5_simple_example',
      'sd3.5_text_encoders_example',
      'sd3.5_large_canny_controlnet_example'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - ControlNet',
    type: 'image',
    templates: [
      'controlnet_example',
      '2_pass_pose_worship',
      'depth_controlnet',
      'mixing_controlnets',
      'depth_t2i_adapter'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - Lora',
    type: 'image',
    templates: [
      'lora',
      'lora_multiple',
      'lcm_basic_example',
      'model_merging_lora'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - Model Merging',
    type: 'image',
    templates: [
      'model_merging_basic',
      'model_merging_cosxl',
      'model_merging_3_checkpoints'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - Inpainting/Outpainting',
    type: 'image',
    templates: [
      'inpaint_example',
      'yosemite_outpaint_example',
      'inpain_model_outpainting',
      'model_merging_inpaint'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - Upscaling',
    type: 'image',
    templates: [
      'upscale',
      'esrgan_example',
      'hiresfix_latent_workflow',
      'hiresfix_esrgan_workflow',
      'gligen_textbox_example',
      'latent_upscale_different_prompt_model'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - Area Composition',
    type: 'image',
    templates: [
      'area_composition',
      'area_composition_reversed',
      'area_composition_square_area_for_subject'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - UnCLIP',
    type: 'image',
    templates: ['unclip_example', 'unclip_2pass', 'unclip_example_multiple']
  },
  {
    moduleName: 'default',
    title: 'Comfy - Stable Zero',
    type: 'image',
    templates: ['stable_zero123_example']
  }
]
