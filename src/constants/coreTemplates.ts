export const CORE_TEMPLATES = [
  {
    moduleName: 'default',
    title: 'Basics',
    type: 'image',
    templates: [
      {
        name: 'default',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Generate images from text descriptions.'
      },
      {
        name: 'image2image',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Transform existing images using text prompts.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/img2img/'
      },
      {
        name: 'lora',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Apply LoRA models for specialized styles or subjects.',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/lora/'
      },
      {
        name: 'inpaint_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Edit specific parts of images seamlessly.',
        thumbnailVariant: 'compareSlider',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/inpaint/'
      },
      {
        name: 'inpain_model_outpainting',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Extend images beyond their original boundaries.',
        thumbnailVariant: 'compareSlider',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/inpaint/#outpainting'
      },
      {
        name: 'embedding_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Use textual inversion for consistent styles',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/textual_inversion_embeddings/'
      },
      {
        name: 'gligen_textbox_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Specify the location and size of objects.',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/gligen/'
      },
      {
        name: 'lora_multiple',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Combine multiple LoRA models for unique results.',
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
        mediaSubtype: 'webp',
        description: 'Create images using Flux development models.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#flux-dev-1'
      },
      {
        name: 'flux_schnell',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Generate images quickly with Flux Schnell.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#flux-schnell-1'
      },
      {
        name: 'flux_fill_inpaint_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Fill in missing parts of images.',
        thumbnailVariant: 'compareSlider',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#fill-inpainting-model'
      },
      {
        name: 'flux_fill_outpaint_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Extend images using Flux outpainting.',
        thumbnailVariant: 'compareSlider',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#fill-inpainting-model'
      },
      {
        name: 'flux_canny_model_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Generate images from edge detection.',
        thumbnailVariant: 'hoverDissolve',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#canny-and-depth'
      },
      {
        name: 'flux_depth_lora_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Create images with depth-aware LoRA.',
        thumbnailVariant: 'hoverDissolve',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#canny-and-depth'
      },
      {
        name: 'flux_redux_model_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description:
          'Transfer style from a reference image to guide image generation with Flux.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/flux/#redux'
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
        mediaSubtype: 'webp',
        description: 'Control image generation with reference images.',
        thumbnailVariant: 'hoverDissolve',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/controlnet/'
      },
      {
        name: '2_pass_pose_worship',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Generate images from pose references.',
        thumbnailVariant: 'hoverDissolve',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/controlnet/#pose-controlnet'
      },
      {
        name: 'depth_controlnet',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Create images with depth-aware generation.',
        thumbnailVariant: 'hoverDissolve',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/controlnet/#t2i-adapter-vs-controlnets'
      },
      {
        name: 'depth_t2i_adapter',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Quickly generate depth-aware images with a T2I adapter.',
        thumbnailVariant: 'hoverDissolve',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/controlnet/#t2i-adapter-vs-controlnets'
      },
      {
        name: 'mixing_controlnets',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Combine multiple ControlNet models together.',
        thumbnailVariant: 'hoverDissolve',
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
        name: 'hiresfix_latent_workflow',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Enhance image quality in latent space.',
        thumbnailVariant: 'zoomHover',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/2_pass_txt2img/'
      },
      {
        name: 'esrgan_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Use upscale models to enhance image quality.',
        thumbnailVariant: 'zoomHover',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/upscale_models/'
      },
      {
        name: 'hiresfix_esrgan_workflow',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Use upscale models during intermediate steps.',
        thumbnailVariant: 'zoomHover',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/2_pass_txt2img/#non-latent-upscaling'
      },
      {
        name: 'latent_upscale_different_prompt_model',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Upscale and change prompt across passes',
        thumbnailVariant: 'zoomHover',
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
        name: 'ltxv_text_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Generate videos from text descriptions.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/ltxv/#text-to-video'
      },
      {
        name: 'ltxv_image_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Convert still images into videos.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/ltxv/#image-to-video'
      },
      {
        name: 'mochi_text_to_video_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Create videos with Mochi model.',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/mochi/'
      },
      {
        name: 'hunyuan_video_text_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Generate videos using Hunyuan model.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/hunyuan_video/'
      },
      {
        name: 'image_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Transform images into animated videos.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/video/#image-to-video'
      },
      {
        name: 'txt_to_image_to_video',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description:
          'Generate images from text and then convert them into videos.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/video/#image-to-video'
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
        mediaSubtype: 'webp',
        description: 'Generate images with SD 3.5.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sd3/#sd35'
      },
      {
        name: 'sd3.5_large_canny_controlnet_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description:
          'Use edge detection to guide image generation with SD 3.5.',
        thumbnailVariant: 'hoverDissolve',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sd3/#sd35-controlnets'
      },
      {
        name: 'sd3.5_large_depth',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Create depth-aware images with SD 3.5.',
        thumbnailVariant: 'hoverDissolve',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sd3/#sd35-controlnets'
      },
      {
        name: 'sd3.5_large_blur',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description:
          'Generate images from blurred reference images with SD 3.5.',
        thumbnailVariant: 'hoverDissolve',
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
        mediaSubtype: 'webp',
        description: 'Create high-quality images with SDXL.',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/sdxl/'
      },
      {
        name: 'sdxl_refiner_prompt_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Enhance SDXL outputs with refiners.',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/sdxl/'
      },
      {
        name: 'sdxl_revision_text_prompts',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description:
          'Transfer concepts from reference images to guide image generation with SDXL.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sdxl/#revision'
      },
      {
        name: 'sdxl_revision_zero_positive',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description:
          'Add text prompts alongside reference images to guide image generation with SDXL.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/sdxl/#revision'
      },
      {
        name: 'sdxlturbo_example',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Generate images in a single step with SDXL Turbo.',
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
        mediaSubtype: 'webp',
        description: 'Control image composition with areas.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/area_composition/'
      },
      {
        name: 'area_composition_reversed',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Reverse area composition workflow.',
        tutorialUrl:
          'https://comfyanonymous.github.io/ComfyUI_examples/area_composition/'
      },
      {
        name: 'area_composition_square_area_for_subject',
        mediaType: 'image',
        mediaSubtype: 'webp',
        description: 'Create consistent subject placement.',
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
        description: 'Generate 3D views from single images.',
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
        mediaSubtype: 'mp3',
        description: 'Generate audio from text descriptions.',
        tutorialUrl: 'https://comfyanonymous.github.io/ComfyUI_examples/audio/'
      }
    ]
  }
]
