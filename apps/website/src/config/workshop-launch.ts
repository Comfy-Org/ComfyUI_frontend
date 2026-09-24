/**
 * The launch catalogue as the Phase 2 spec sets it: five categories, six
 * workflows each, in the order a visitor is meant to meet them. It is a named
 * list rather than a measured filter, because what belongs here is an
 * editorial decision about the jobs we want to lead with.
 *
 * The outcome names are the spec's, not the registry's: a card says the job,
 * and the workflow it points at is an implementation detail of that job.
 */
interface LaunchWorkflow {
  /** The registry template this outcome is served by. */
  readonly template: string
  readonly outcome: string
  /**
   * Whether the spec says this one needs a server of its own rather than the
   * shared Cloud endpoint, whatever its nodes suggest.
   */
  readonly ownEndpoint?: true
}

export interface LaunchCategory {
  readonly key: string
  /** The one the category opens on. */
  readonly highlight: string
  readonly workflows: readonly LaunchWorkflow[]
}

export const LAUNCH_CATEGORIES: readonly LaunchCategory[] = [
  {
    key: 'videos',
    highlight: 'video_ltx2_3_i2v',
    workflows: [
      { template: 'video_ltx2_3_i2v', outcome: 'Turn an image into a video' },
      // Prototype outside the Phase 2 list: runs on its own deployment through
      // the page in components/hub/crossview/.
      {
        template: 'crossview_warp_h3',
        outcome: 'Re-shoot a video: aim your own camera',
        ownEndpoint: true
      },
      {
        template: 'video_minimax_h3_r2v',
        outcome: 'Create a video from references'
      },
      {
        template: 'video_ltx2_3_flf2v',
        outcome: 'Connect two images with motion'
      },
      {
        template: 'api_seedance2_5_video_editing',
        outcome: 'Change a video’s background'
      },
      {
        template:
          'template_ltx2_3_obscura_remova_lora_remove_object_from_video',
        outcome: 'Remove an object from a video',
        ownEndpoint: true
      },
      {
        template: 'template_ltx2_3_lora_video_outpainting',
        outcome: 'Expand a video’s frame'
      }
    ]
  },
  {
    key: 'characters',
    highlight: 'video_wan_animate2',
    workflows: [
      { template: 'video_wan_animate2', outcome: 'Copy movement from a video' },
      { template: 'video_ltx2_3_ia2v', outcome: 'Make your character talk' },
      {
        template: 'video_wan21_scail2_character_replacement',
        outcome: 'Replace a character in a video'
      },
      {
        template: 'templates-wan2_1_infinitetalk_music',
        outcome: 'Make your character sing'
      },
      {
        template: 'template_ltx2_3_ic_lora_ingredients',
        outcome: 'Animate a scene from a reference sheet'
      },
      {
        template: 'templates-character_sheet',
        outcome: 'Create a character turnaround'
      }
    ]
  },
  {
    key: 'product',
    highlight: 'image_qwen_image_edit_2511',
    workflows: [
      { template: 'image_qwen_image_edit_2511', outcome: 'Change a material' },
      {
        template: 'templates-qwen_multiangle.app',
        outcome: 'See your subject from a new angle'
      },
      { template: 'image_flux2_fp8', outcome: 'Create a product mockup' },
      {
        template: 'templates-fashion_shoot_vton',
        outcome: 'Try an outfit on a character'
      },
      {
        template: 'templates-product_scene_relight',
        outcome: 'Put your product in a new scene'
      },
      {
        template: 'templates-photo_to_product_vid',
        outcome: 'Turn a product photo into a video'
      }
    ]
  },
  {
    key: 'upscale',
    highlight: 'utility_seedvr2_image_upscale',
    workflows: [
      {
        template: 'utility_seedvr2_image_upscale',
        outcome: 'Upscale and restore detail'
      },
      {
        template: 'utility_seedvr2_3b_int8_upscale_video',
        outcome: 'Upscale a video'
      },
      {
        template: 'utility_nanobanana_pro_product_upscale',
        outcome: 'Sharpen a product photo'
      },
      {
        template: 'utility_topaz_illustration_upscale',
        outcome: 'Upscale an illustration'
      },
      {
        template: 'utility_hitpaw_general_image_enhance',
        outcome: 'Restore portrait detail'
      },
      {
        template: 'template_ltx2_3_lora_restore_archival_footage',
        outcome: 'Restore archival footage'
      }
    ]
  },
  {
    key: 'cleanup',
    highlight: 'flux_fill_inpaint_example',
    workflows: [
      {
        template: 'flux_fill_inpaint_example',
        outcome: 'Edit a selected region'
      },
      {
        template: 'flux_fill_outpaint_example',
        outcome: 'Extend an image’s borders'
      },
      {
        template: 'image_qwen_image_layered',
        outcome: 'Separate an image into editable layers'
      },
      {
        template: 'utility_birefnet_remove_background',
        outcome: 'Remove an image background'
      },
      {
        template: 'templates_rob_portrait_light_migration.app',
        outcome: 'Match lighting from a reference'
      },
      { template: 'api_bria_eraser', outcome: 'Remove an object' }
    ]
  }
]

const BY_TEMPLATE = new Map(
  LAUNCH_CATEGORIES.flatMap((category) =>
    category.workflows.map((workflow) => [workflow.template, workflow] as const)
  )
)

const CATEGORY_BY_TEMPLATE = new Map(
  LAUNCH_CATEGORIES.flatMap((category) =>
    category.workflows.map(
      (workflow) => [workflow.template, category.key] as const
    )
  )
)

export function launchesHere(templateName: string): boolean {
  return BY_TEMPLATE.has(templateName)
}

/** The name the spec gives the job, which is what a card says. */
export function launchOutcome(templateName: string): string | undefined {
  return BY_TEMPLATE.get(templateName)?.outcome
}

/** Whether the spec says this one is deployed rather than shared. */
export function needsOwnEndpoint(templateName: string): boolean {
  return BY_TEMPLATE.get(templateName)?.ownEndpoint === true
}

/** The shelf the spec files it under, which is how the workflows half is read. */
export function launchCategoryOf(templateName: string): string | undefined {
  return CATEGORY_BY_TEMPLATE.get(templateName)
}
