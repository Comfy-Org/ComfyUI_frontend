/**
 * Names written for the job the reader wants done: the Phase 2 workflow
 * discovery prototype (PR 17878) supplied the first of them, and the rest are
 * written here in the same voice — what you get, in the words you would use
 * asking for it.
 *
 * Every one of them is named after the job, never after the model that does
 * it: the reader arrives knowing what they want done, not which model does
 * it, and the card says the model on its own line. `Text to Image` was the
 * registry talking to itself.
 */
const curatedWorkflowTitles: Readonly<Record<string, string>> = {
  api_beeble_switchx_image_edit: 'Relight a photo',
  api_beeble_switchx_video_edit: 'Relight a video',
  api_bria_eraser: 'Remove an object',
  api_bytedance_seedream_5_0_layer_separation: 'Separate an image into layers',
  api_bytedance_seedream_5_0_lite_image_edit: 'Edit an image with a prompt',
  api_bytedance_seedream_5_0_lite_t2i: 'Create an image from a prompt',
  api_bytedance_seedream_5_0_pro_image_edit: 'Edit an image with a prompt',
  api_bytedance_seedream_5_0_pro_t2i: 'Create an image from a prompt',
  api_from_photo_2_miniature: 'Turn a photo into a 3D miniature',
  api_google_gemini_omni_flash_1_1_edit: 'Edit a video with a prompt',
  api_google_gemini_omni_flash_1_1_i2v: 'Turn an image into a video',
  api_google_gemini_omni_flash_1_1_r2v: 'Create a video from references',
  api_google_gemini_omni_flash_1_1_t2v: 'Create a video from a prompt',
  api_google_nano_banana2_image_edit: 'Edit an image with a prompt',
  api_google_nano_banana2_image_edit_continuation: 'Edit an image step by step',
  api_google_nano_banana2_text_to_image: 'Create an image from a prompt',
  api_happyhorse1_0_video_edit: 'Edit a video with a prompt',
  api_happyhorse1_1_r2v: 'Create a video from references',
  api_happyhorse1_1_t2v: 'Create a video from a prompt',
  api_nano_banana_2_lite_image_edit: 'Edit an image with a prompt',
  api_nano_banana_2_lite_t2i: 'Create an image from a prompt',
  api_nano_banana_pro: 'Blend several photos into one',
  api_seedance2_5_r2v: 'Create a video from references',
  api_wavespeed_flshvsr_video_upscale: 'Upscale a video',
  flux_fill_inpaint_example: 'Edit a selected region',
  flux_fill_outpaint_example: 'Extend an image’s borders',
  image_flux2_fp8: 'Create a product mockup',
  image_qwen_image_edit_2511: 'Change a material',
  image_qwen_image_layered: 'Separate an image into editable layers',
  'template-multistyle-magazine-cover-nanobananapro': 'Design a magazine cover',
  template_3x3_contact_sheet: 'Make a 3×3 contact sheet',
  template_character_portrait_relighting: 'Relight a character portrait',
  'template_contact_sheet-step_1.app': 'Build a contact sheet',
  template_eric_seedance_5_subject_and_outfit_combine:
    'Put an outfit on a character',
  template_eric_thumbnail_generator: 'Make a YouTube thumbnail',
  template_ltx2_3_ic_lora_ingredients: 'Animate a scene from a reference sheet',
  template_ltx2_3_lora_restore_archival_footage: 'Restore archival footage',
  template_product_placement: 'Place your product in a scene',
  'template_sferro21_product_ad.app': 'Make a cinematic product ad',
  'templates-assemble_dieline': 'Build packaging from a dieline',
  'templates-character_sheet': 'Create a character turnaround',
  'templates-color_illustration': 'Colour a line drawing',
  'templates-fashion_shoot_vton': 'Try an outfit on a character',
  'templates-photo_to_product_vid': 'Turn a product photo into a video',
  'templates-product_scene_relight': 'Put your product in a new scene',
  'templates-qwen_multiangle.app': 'See your subject from a new angle',
  'templates-subject_product_swap.app': 'Swap the product in someone’s hand',
  'templates-wan2_1_infinitetalk_music': 'Make your character sing',
  templates_doc_workbox_poster_recreator:
    'Redesign a poster with your character',
  'templates_rob_portrait_light_migration.app':
    'Match lighting from a reference',
  utility_birefnet_remove_background: 'Remove an image background',
  utility_hitpaw_general_image_enhance: 'Restore portrait detail',
  utility_nanobanana_pro_ai_image_fix: 'Fix a blurry AI image',
  utility_nanobanana_pro_illustration_upscale: 'Upscale an illustration',
  utility_nanobanana_pro_product_upscale: 'Sharpen a product photo',
  utility_seedvr2_3b_int8_upscale_video: 'Upscale a video',
  utility_seedvr2_image_upscale: 'Upscale and restore detail',
  utility_topaz_illustration_upscale: 'Upscale an illustration',
  video_ltx2_3_ia2v: 'Make your character talk',
  video_wan21_scail2_character_replacement: 'Replace a character in a video',
  video_wan_animate2: 'Copy movement from a video'
}

export const curatedWorkflowTitle = (name: string): string | undefined =>
  curatedWorkflowTitles[name]
