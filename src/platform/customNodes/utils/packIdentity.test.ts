import { describe, expect, it } from 'vitest'

import {
  findOwnedPackForModule,
  packKeyFromPythonModule,
  packKeyFromRevisionId
} from './packIdentity'

const ownedPacks = [
  {
    revisionId: 'comfyui-kjnodes-x3f20054',
    name: 'ComfyUI KJNodes',
    uploadedAt: ''
  },
  {
    revisionId: 'checkerboard.mask-xdeadbeef',
    name: 'Checkerboard Mask',
    uploadedAt: ''
  }
]

describe('packIdentity', () => {
  it('extracts the pack key from a registered pack module', () => {
    expect(
      packKeyFromPythonModule(
        'custom_nodes.pack_comfyui_kjnodes_x3f20054.nodes.image_nodes'
      )
    ).toBe('comfyui_kjnodes_x3f20054')
    expect(packKeyFromPythonModule('custom_nodes.pack_solo_x01234567')).toBe(
      'solo_x01234567'
    )
  })

  it('returns null for core, extras, and non-pack custom modules', () => {
    expect(packKeyFromPythonModule('nodes')).toBeNull()
    expect(packKeyFromPythonModule('comfy_extras.nodes_latent')).toBeNull()
    expect(packKeyFromPythonModule('custom_nodes.some_plain_module')).toBeNull()
    expect(packKeyFromPythonModule(undefined)).toBeNull()
  })

  it('normalizes revision ids to the module key form', () => {
    expect(packKeyFromRevisionId('comfyui-kjnodes-x3f20054')).toBe(
      'comfyui_kjnodes_x3f20054'
    )
    expect(packKeyFromRevisionId('checkerboard.mask-xdeadbeef')).toBe(
      'checkerboard_mask_xdeadbeef'
    )
  })

  it('finds the owned pack for a node definition module', () => {
    expect(
      findOwnedPackForModule(
        'custom_nodes.pack_checkerboard_mask_xdeadbeef.nodes.checkerboard',
        ownedPacks
      )?.name
    ).toBe('Checkerboard Mask')
    expect(
      findOwnedPackForModule(
        'custom_nodes.pack_registry_pack_x99999999.nodes.thing',
        ownedPacks
      )
    ).toBeNull()
    expect(findOwnedPackForModule('nodes', ownedPacks)).toBeNull()
  })
})
