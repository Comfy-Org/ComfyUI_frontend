export const CORE_TEMPLATES = [
  {
    moduleName: 'default',
    title: 'Comfy - Basic',
    type: 'image',
    templates: [
      'default',
      'image2image',
      'embedding_example',
      'gligen_textbox_example',
      'lora',
      'lora_multiple',
      'inpaint_example',
      'yosemite_outpaint_example',
      'inpain_model_outpainting'
    ]
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
      'hunyuan_video_text_to_video'
    ]
  },
  {
    moduleName: 'default',
    title: 'Comfy - Flux',
    type: 'image',
    templates: [
      'flux_schnell',
      'flux_dev_example',
      'flux_fill_outpaint_example',
      'flux_fill_inpaint_example',
      'flux_canny_model_example',
      'flux_depth_lora_example'
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
    title: 'Comfy - Upscaling',
    type: 'image',
    templates: [
      'upscale',
      'esrgan_example',
      'hiresfix_latent_workflow',
      'hiresfix_esrgan_workflow',
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
  }
]
