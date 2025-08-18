import { describe, expect, it } from 'vitest'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import {
  getOrderedInputNames,
  sortNodeInputsByOrder
} from '@/utils/nodeDefOrderingUtil'

describe('nodeDefOrderingUtil', () => {
  describe('sortNodeInputsByOrder', () => {
    it('should maintain order when no input_order is specified', () => {
      const nodeDef: ComfyNodeDef = {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'test',
        python_module: 'test',
        description: 'Test node',
        output_node: false,
        input: {
          required: {
            image: ['IMAGE', {}],
            seed: ['INT', { default: 0 }],
            steps: ['INT', { default: 20 }]
          }
        }
      }

      const result = sortNodeInputsByOrder(nodeDef)
      expect(result).toEqual(nodeDef)
    })

    it('should sort inputs according to input_order', () => {
      const nodeDef: ComfyNodeDef = {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'test',
        python_module: 'test',
        description: 'Test node',
        output_node: false,
        input: {
          required: {
            image: ['IMAGE', {}],
            seed: ['INT', { default: 0 }],
            steps: ['INT', { default: 20 }]
          }
        },
        input_order: {
          required: ['steps', 'seed', 'image']
        }
      }

      const result = sortNodeInputsByOrder(nodeDef)
      const orderedKeys = Object.keys(result.input!.required!)
      expect(orderedKeys).toEqual(['steps', 'seed', 'image'])
    })

    it('should handle missing inputs in input_order gracefully', () => {
      const nodeDef: ComfyNodeDef = {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'test',
        python_module: 'test',
        description: 'Test node',
        output_node: false,
        input: {
          required: {
            image: ['IMAGE', {}],
            seed: ['INT', { default: 0 }],
            steps: ['INT', { default: 20 }]
          }
        },
        input_order: {
          required: ['steps', 'nonexistent', 'seed']
        }
      }

      const result = sortNodeInputsByOrder(nodeDef)
      const orderedKeys = Object.keys(result.input!.required!)
      expect(orderedKeys).toEqual(['steps', 'seed', 'image'])
    })

    it('should handle inputs not in input_order', () => {
      const nodeDef: ComfyNodeDef = {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'test',
        python_module: 'test',
        description: 'Test node',
        output_node: false,
        input: {
          required: {
            image: ['IMAGE', {}],
            seed: ['INT', { default: 0 }],
            steps: ['INT', { default: 20 }],
            cfg: ['FLOAT', { default: 7.0 }]
          }
        },
        input_order: {
          required: ['steps', 'seed']
        }
      }

      const result = sortNodeInputsByOrder(nodeDef)
      const orderedKeys = Object.keys(result.input!.required!)
      expect(orderedKeys).toEqual(['steps', 'seed', 'image', 'cfg'])
    })

    it('should sort multiple categories', () => {
      const nodeDef: ComfyNodeDef = {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'test',
        python_module: 'test',
        description: 'Test node',
        output_node: false,
        input: {
          required: {
            image: ['IMAGE', {}],
            seed: ['INT', { default: 0 }]
          },
          optional: {
            mask: ['MASK', {}],
            strength: ['FLOAT', { default: 1.0 }]
          }
        },
        input_order: {
          required: ['seed', 'image'],
          optional: ['strength', 'mask']
        }
      }

      const result = sortNodeInputsByOrder(nodeDef)
      const requiredKeys = Object.keys(result.input!.required!)
      const optionalKeys = Object.keys(result.input!.optional!)
      expect(requiredKeys).toEqual(['seed', 'image'])
      expect(optionalKeys).toEqual(['strength', 'mask'])
    })
  })

  describe('getOrderedInputNames', () => {
    it('should return ordered names when input_order is specified', () => {
      const nodeDef: ComfyNodeDef = {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'test',
        python_module: 'test',
        description: 'Test node',
        output_node: false,
        input: {
          required: {
            image: ['IMAGE', {}],
            seed: ['INT', { default: 0 }],
            steps: ['INT', { default: 20 }]
          }
        },
        input_order: {
          required: ['steps', 'seed', 'image']
        }
      }

      const result = getOrderedInputNames(nodeDef, 'required')
      expect(result).toEqual(['steps', 'seed', 'image'])
    })

    it('should return Object.keys order when no input_order', () => {
      const nodeDef: ComfyNodeDef = {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'test',
        python_module: 'test',
        description: 'Test node',
        output_node: false,
        input: {
          required: {
            image: ['IMAGE', {}],
            seed: ['INT', { default: 0 }],
            steps: ['INT', { default: 20 }]
          }
        }
      }

      const result = getOrderedInputNames(nodeDef, 'required')
      expect(result).toEqual(['image', 'seed', 'steps'])
    })

    it('should return empty array when category has no inputs', () => {
      const nodeDef: ComfyNodeDef = {
        name: 'TestNode',
        display_name: 'Test Node',
        category: 'test',
        python_module: 'test',
        description: 'Test node',
        output_node: false,
        input: {
          required: {
            image: ['IMAGE', {}]
          }
        }
      }

      const result = getOrderedInputNames(nodeDef, 'optional')
      expect(result).toEqual([])
    })
  })
})
