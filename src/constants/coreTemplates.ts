export const CORE_TEMPLATES = [
  {
    moduleName: 'default',
    title: 'Basics',
    type: 'image',
    templates: [
      {
        name: 'default',
        tutorialUrl:
          'https://github.com/comfyanonymous/ComfyUI/wiki/Basic-Tutorial',
        mediaType: 'image',
        mediaSubtype: 'png'
      },
      {
        name: 'image2image',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/img2img/'
      },
      {
        name: 'lora',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/lora/'
      },
      {
        name: 'inpaint_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/inpaint/'
      },
      {
        name: 'yosemite_outpaint_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/inpaint/#outpainting'
      },
      {
        name: 'inpain_model_outpainting',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/inpaint/'
      },
      {
        name: 'embedding_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/textual_inversion_embeddings/'
      },
      {
        name: 'gligen_textbox_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/gligen/'
      },
      {
        name: 'lora_multiple',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/lora/'
      }
    ]
  },
  {
    moduleName: 'default',
    title: 'Flux',
    type: 'image',
    templates: [
      {
        name: 'flux_dev_checkpoint_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#flux-dev-1'
      },
      {
        name: 'flux_schnell',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#flux-schnell-1'
      },
      {
        name: 'flux_fill_inpaint_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#fill-inpainting-model'
      },
      {
        name: 'flux_fill_outpaint_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#fill-inpainting-model'
      },
      {
        name: 'flux_canny_model_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#canny-and-depth'
      },
      {
        name: 'flux_redux_model_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#redux'
      },
      {
        name: 'flux_depth_lora_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#canny-and-depth'
      }
    ]
  },
  {
    moduleName: 'default',
    title: 'ControlNet',
    type: 'image',
    templates: [
      {
        name: 'controlnet_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/controlnet/'
      },
      {
        name: '2_pass_pose_worship',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/controlnet/#2-pass-pose-worship'
      },
      {
        name: 'depth_controlnet',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/controlnet/#pose-controlnet'
      },
      {
        name: 'depth_t2i_adapter',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/controlnet/#t2i-adapter-vs-controlnets'
      },
      {
        name: 'mixing_controlnets',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/controlnet/#mixing-controlnets'
      }
    ]
  },
  {
    moduleName: 'default',
    title: 'Upscaling',
    type: 'image',
    templates: [
      {
        name: 'upscale',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/upscale_models/'
      },
      {
        name: 'esrgan_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/upscale_models/'
      },
      {
        name: 'hiresfix_latent_workflow',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/2_pass_txt2img/'
      },
      {
        name: 'hiresfix_esrgan_workflow',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/2_pass_txt2img/#non-latent-upscaling'
      },
      {
        name: 'latent_upscale_different_prompt_model',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/2_pass_txt2img/#more-examples'
      }
    ]
  },
  {
    moduleName: 'default',
    title: 'Video',
    type: 'video',
    templates: [
      {
        name: 'image_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/video/#image-to-video'
      },
      {
        name: 'txt_to_image_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/video/#image-to-video'
      },
      {
        name: 'ltxv_image_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/ltxv/'
      },
      {
        name: 'ltxv_text_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/ltxv/'
      },
      {
        name: 'mochi_text_to_video_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/mochi/'
      },
      {
        name: 'hunyuan_video_text_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/hunyuan_video/'
      }
    ]
  },
  {
    moduleName: 'default',
    title: 'SD3.5',
    type: 'image',
    templates: [
      {
        name: 'sd3.5_simple_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sd3/#sd35'
      },
      {
        name: 'sd3.5_large_canny_controlnet_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sd3/#sd35-controlnets'
      },
      {
        name: 'sd3.5_large_depth',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sd3/#sd35-controlnets'
      },
      {
        name: 'sd3.5_large_blur',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sd3/#sd35-controlnets'
      }
    ]
  },
  {
    moduleName: 'default',
    title: 'SDXL',
    type: 'image',
    templates: [
      {
        name: 'sdxl_simple_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/sdxl/'
      },
      {
        name: 'sdxl_refiner_prompt_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/sdxl/'
      },
      {
        name: 'sdxl_revision_text_prompts',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sdxl/#revision'
      },
      {
        name: 'sdxl_revision_zero_positive',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sdxl/#revision'
      },
      {
        name: 'sdxlturbo_example',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sdturbo/'
      }
    ]
  },
  {
    moduleName: 'default',
    title: 'Area Composition',
    type: 'image',
    templates: [
      {
        name: 'area_composition',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/area_composition/'
      },
      {
        name: 'area_composition_reversed',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/area_composition/'
      },
      {
        name: 'area_composition_square_area_for_subject',
        mediaType: 'image',
        mediaSubtype: 'png',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/area_composition/#increasing-consistency-of-images-with-area-composition'
      }
    ]
  },
  {
    moduleName: 'default',
    title: '3D',
    type: 'video',
    templates: [
      {
        name: 'stable_zero123_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/3d/'
      }
    ]
  },
  {
    moduleName: 'default',
    title: 'Audio',
    type: 'audio',
    templates: [
      {
        name: 'stable_audio_example',
        mediaType: 'audio',
        mediaSubtype: 'flac',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/audio/'
      }
    ]
  }
]
