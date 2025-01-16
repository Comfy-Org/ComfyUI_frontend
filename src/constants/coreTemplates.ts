export const CORE_TEMPLATES = [
  {
    moduleName: 'default',
    title: 'Flux',
    type: 'image',
    templates: [
      'flux_dev_example',
      'flux_schnell',
      'flux_fill_inpaint_example',
      'flux_fill_outpaint_example',
      'flux_canny_model_example',
      'flux_redux_model_example',
      'flux_depth_lora_example'
    ]
  },
  {
    moduleName: 'default',
    title: 'Basics',
    type: 'image',
    templates: [
      'default', // txt2image
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
    title: 'ControlNet',
    type: 'image',
    templates: [
      'controlnet_example',
      '2_pass_pose_worship',
      'depth_controlnet',
      'depth_t2i_adapter',
      'mixing_controlnets'
    ]
  },
  {
    moduleName: 'default',
    title: 'Upscaling',
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
    title: 'Video',
    type: 'video',
    templates: [
      'image_to_video', // SVD
      'txt_to_image_to_video', // SVD
      'ltxv_image_to_video',
      'ltxv_text_to_video',
      'mochi_text_to_video_example',
      'hunyuan_video_text_to_video'
    ]
  },
  {
    moduleName: 'default',
    title: 'SD3.5',
    type: 'image',
    templates: [
      'sd3.5_simple_example',
      'sd3.5_large_canny_controlnet_example',
      'sd3.5_large_depth', // wf needs creation
      'sd3.5_large_blur' // wf needs creation
    ]
  },
  {
    moduleName: 'default',
    title: 'SDXL',
    type: 'image',
    templates: [
      'sdxl_simple_example',
      'sdxl_refiner_prompt_example',
      'sdxl_revision_text_prompts',
      'sdxl_revision_zero_positive',
      'sdxlturbo_example'
    ]
  },
  {
    moduleName: 'default',
    title: 'Area Composition',
    type: 'image',
    templates: [
      'area_composition',
      'area_composition_reversed',
      'area_composition_square_area_for_subject'
    ]
  },
  {
    moduleName: 'default',
    title: '3D',
    type: 'video',
    templates: ['stable_zero123_example']
  },
  {
    moduleName: 'default',
    title: 'Audio',
    type: 'audio',
    templates: ['stable_audio_example']
  }
]
