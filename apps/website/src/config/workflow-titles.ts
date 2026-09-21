/**
 * Names written for the job the reader wants done, taken from the Phase 2
 * workflow discovery prototype (PR 17878) where a person chose each one. A
 * written name beats anything derived from a registry title, so the page
 * prefers these and falls back to the rule in lib/hub/workflow-detail.ts.
 */
export const curatedWorkflowTitles: Readonly<Record<string, string>> = {
  api_bria_eraser: 'Remove an object',
  flux_fill_inpaint_example: 'Edit a selected region',
  flux_fill_outpaint_example: 'Extend an image’s borders',
  image_flux2_fp8: 'Create a product mockup',
  image_qwen_image_edit_2511: 'Change a material',
  image_qwen_image_layered: 'Separate an image into editable layers',
  template_ltx2_3_ic_lora_ingredients: 'Animate a scene from a reference sheet',
  template_ltx2_3_lora_restore_archival_footage: 'Restore archival footage',
  'templates-character_sheet': 'Create a character turnaround',
  'templates-fashion_shoot_vton': 'Try an outfit on a character',
  'templates-photo_to_product_vid': 'Turn a product photo into a video',
  'templates-product_scene_relight': 'Put your product in a new scene',
  'templates-qwen_multiangle.app': 'See your subject from a new angle',
  'templates-wan2_1_infinitetalk_music': 'Make your character sing',
  'templates_rob_portrait_light_migration.app':
    'Match lighting from a reference',
  utility_birefnet_remove_background: 'Remove an image background',
  utility_hitpaw_general_image_enhance: 'Restore portrait detail',
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
