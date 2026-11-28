import type { NodeReplacementResponse } from '@/platform/workflowErrors/nodeReplacement/types'

/**
 * Mock node replacement mappings for e2e tests.
 *
 * Maps fake "missing" node types (E2E_OldSampler, E2E_OldUpscaler) to real
 * core node types that are always available in the test server.
 */
export const mockNodeReplacements: NodeReplacementResponse = {
  E2E_OldSampler: [
    {
      new_node_id: 'KSampler',
      old_node_id: 'E2E_OldSampler',
      old_widget_ids: ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler'],
      input_mapping: [
        { new_id: 'model', old_id: 'model' },
        { new_id: 'positive', old_id: 'positive' },
        { new_id: 'negative', old_id: 'negative' },
        { new_id: 'latent_image', old_id: 'latent_image' },
        { new_id: 'seed', old_id: 'seed' },
        { new_id: 'steps', old_id: 'steps' },
        { new_id: 'cfg', old_id: 'cfg' },
        { new_id: 'sampler_name', old_id: 'sampler_name' },
        { new_id: 'scheduler', old_id: 'scheduler' }
      ],
      output_mapping: [{ new_idx: 0, old_idx: 0 }]
    }
  ],
  E2E_OldUpscaler: [
    {
      new_node_id: 'ImageScaleBy',
      old_node_id: 'E2E_OldUpscaler',
      old_widget_ids: ['upscale_method', 'scale_by'],
      input_mapping: [
        { new_id: 'image', old_id: 'image' },
        { new_id: 'upscale_method', old_id: 'upscale_method' },
        { new_id: 'scale_by', old_id: 'scale_by' }
      ],
      output_mapping: [{ new_idx: 0, old_idx: 0 }]
    }
  ]
}

/**
 * Mirrors ComfyUI's built-in replacements whose targets use Autogrow and
 * DynamicCombo inputs, or that omit `old_widget_ids`.
 */
export const mockDynamicInputReplacements: NodeReplacementResponse = {
  E2E_OldImageBatch: [
    {
      new_node_id: 'BatchImagesNode',
      old_node_id: 'E2E_OldImageBatch',
      old_widget_ids: null,
      input_mapping: [
        { new_id: 'images.image0', old_id: 'image1' },
        { new_id: 'images.image1', old_id: 'image2' }
      ],
      output_mapping: null
    }
  ],
  E2E_OldImageScaleBy: [
    {
      new_node_id: 'ResizeImageMaskNode',
      old_node_id: 'E2E_OldImageScaleBy',
      old_widget_ids: ['upscale_method', 'scale_by'],
      input_mapping: [
        { new_id: 'input', old_id: 'image' },
        { new_id: 'resize_type', set_value: 'scale by multiplier' },
        { new_id: 'resize_type.multiplier', old_id: 'scale_by' },
        { new_id: 'scale_method', old_id: 'upscale_method' }
      ],
      output_mapping: null
    }
  ],
  E2E_OldAdapterLoader: [
    {
      new_node_id: 'ControlNetLoader',
      old_node_id: 'E2E_OldAdapterLoader',
      old_widget_ids: null,
      input_mapping: [
        { new_id: 'control_net_name', old_id: 't2i_adapter_name' }
      ],
      output_mapping: null
    }
  ]
}

/** ComfyUI's replacement for ImageBatch, a node the test server ships as deprecated. */
export const mockDeprecatedNodeReplacements: NodeReplacementResponse = {
  ImageBatch: [
    {
      ...mockDynamicInputReplacements.E2E_OldImageBatch[0],
      old_node_id: 'ImageBatch'
    }
  ]
}

/** Subset containing only the E2E_OldSampler replacement. */
export const mockNodeReplacementsSingle: NodeReplacementResponse = {
  E2E_OldSampler: mockNodeReplacements.E2E_OldSampler
}
