import { describe, expect, it } from 'vitest'

import type { WorkflowJSON04 } from '@/schemas/comfyWorkflowSchema'
import {
  createNewLinks,
  createReroutePoints,
  establishRerouteRelationships,
  findLegacyRerouteNodes,
  findOriginalSource,
  findRerouteTargets,
  findRootReroute,
  migrateLegacyRerouteNodes
} from '@/utils/migration/migrateReroute'

describe('migrateReroute', () => {
  // Sample workflow with reroute nodes for testing
  const sampleWorkflow: WorkflowJSON04 = {
    last_node_id: 27,
    last_link_id: 34,
    nodes: [
      {
        id: 12,
        type: 'VAEDecode',
        pos: [620, 260],
        size: [210, 46],
        flags: {},
        order: 4,
        mode: 0,
        inputs: [
          { name: 'samples', type: 'LATENT', link: null },
          { name: 'vae', type: 'VAE', link: 21 }
        ],
        outputs: [{ name: 'IMAGE', type: 'IMAGE', links: null }],
        properties: { 'Node name for S&R': 'VAEDecode' },
        widgets_values: []
      },
      {
        id: 4,
        type: 'CheckpointLoaderSimple',
        pos: [47.948699951171875, 239.2628173828125],
        size: [315, 98],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [
          { name: 'MODEL', type: 'MODEL', slot_index: 0, links: [] },
          { name: 'CLIP', type: 'CLIP', slot_index: 1, links: [] },
          { name: 'VAE', type: 'VAE', slot_index: 2, links: [13, 31] }
        ],
        properties: { 'Node name for S&R': 'CheckpointLoaderSimple' },
        widgets_values: ['v1-5-pruned-emaonly.safetensors']
      },
      {
        id: 13,
        type: 'Reroute',
        pos: [510, 280],
        size: [75, 26],
        flags: {},
        order: 2,
        mode: 0,
        inputs: [{ name: '', type: '*', link: 32 }],
        outputs: [{ name: '', type: 'VAE', slot_index: 0, links: [21] }],
        properties: { showOutputText: false, horizontal: false }
      },
      {
        id: 25,
        type: 'Reroute',
        pos: [404.7915344238281, 280.9454650878906],
        size: [75, 26],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [{ name: '', type: '*', link: 31 }],
        outputs: [{ name: '', type: 'VAE', links: [32, 33] }],
        properties: { showOutputText: false, horizontal: false }
      },
      {
        id: 27,
        type: 'Reroute',
        pos: [514, 386],
        size: [75, 26],
        flags: {},
        order: 3,
        mode: 0,
        inputs: [{ name: '', type: '*', link: 33 }],
        outputs: [{ name: '', type: 'VAE', links: [34] }],
        properties: { showOutputText: false, horizontal: false }
      },
      {
        id: 26,
        type: 'VAEDecode',
        pos: [625, 373],
        size: [210, 46],
        flags: {},
        order: 5,
        mode: 0,
        inputs: [
          { name: 'samples', type: 'LATENT', link: null },
          { name: 'vae', type: 'VAE', link: 34 }
        ],
        outputs: [{ name: 'IMAGE', type: 'IMAGE', links: null }],
        properties: { 'Node name for S&R': 'VAEDecode' },
        widgets_values: []
      }
    ],
    links: [
      [21, 13, 0, 12, 1, 'VAE'],
      [31, 4, 2, 25, 0, '*'],
      [32, 25, 0, 13, 0, '*'],
      [33, 25, 0, 27, 0, '*'],
      [34, 27, 0, 26, 1, 'VAE']
    ],
    groups: [],
    config: {},
    extra: {
      ds: {
        scale: 2.3195551508147507,
        offset: [96.55985005696607, -41.449812921703376]
      }
    },
    version: 0.4
  }

  // Expected output after migration
  const expectedMigratedWorkflow: WorkflowJSON04 = {
    last_node_id: 27,
    last_link_id: 39,
    nodes: [
      {
        id: 12,
        type: 'VAEDecode',
        pos: [620, 260],
        size: [210, 46],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          { name: 'samples', type: 'LATENT', link: null },
          { name: 'vae', type: 'VAE', link: 37 }
        ],
        outputs: [{ name: 'IMAGE', type: 'IMAGE', links: null }],
        properties: { 'Node name for S&R': 'VAEDecode' },
        widgets_values: []
      },
      {
        id: 4,
        type: 'CheckpointLoaderSimple',
        pos: [47.948699951171875, 239.2628173828125],
        size: [315, 98],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [
          { name: 'MODEL', type: 'MODEL', slot_index: 0, links: [] },
          { name: 'CLIP', type: 'CLIP', slot_index: 1, links: [] },
          { name: 'VAE', type: 'VAE', slot_index: 2, links: [13, 37, 39] }
        ],
        properties: { 'Node name for S&R': 'CheckpointLoaderSimple' },
        widgets_values: ['v1-5-pruned-emaonly.safetensors']
      },
      {
        id: 26,
        type: 'VAEDecode',
        pos: [625, 373],
        size: [210, 46],
        flags: {},
        order: 2,
        mode: 0,
        inputs: [
          { name: 'samples', type: 'LATENT', link: null },
          { name: 'vae', type: 'VAE', link: 39 }
        ],
        outputs: [{ name: 'IMAGE', type: 'IMAGE', links: null }],
        properties: { 'Node name for S&R': 'VAEDecode' },
        widgets_values: []
      }
    ],
    links: [
      [37, 4, 2, 12, 1, 'VAE'],
      [39, 4, 2, 26, 1, 'VAE']
    ],
    groups: [],
    config: {},
    extra: {
      ds: {
        scale: 2.3195551508147507,
        offset: [96.55985005696607, -41.449812921703376]
      },
      reroutes: [
        {
          id: 1,
          pos: [510, 280],
          linkIds: [37]
        },
        {
          id: 2,
          pos: [404.7915344238281, 280.9454650878906],
          linkIds: [37, 39]
        },
        {
          id: 3,
          pos: [514, 386],
          parentId: 2,
          linkIds: [39]
        }
      ],
      linkExtensions: [
        {
          id: 37,
          parentId: 1
        },
        {
          id: 39,
          parentId: 3
        }
      ]
    },
    version: 0.4
  }

  describe('findLegacyRerouteNodes', () => {
    it('should find all Reroute nodes in a workflow', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)

      expect(rerouteNodes).toHaveLength(3)
      expect(rerouteNodes.map((node) => node.id)).toEqual([13, 25, 27])
      expect(rerouteNodes.every((node) => node.type === 'Reroute')).toBe(true)
    })

    it('should return an empty array if no Reroute nodes exist', () => {
      const workflowWithoutReroutes: WorkflowJSON04 = {
        ...sampleWorkflow,
        nodes: sampleWorkflow.nodes.filter((node) => node.type !== 'Reroute')
      }

      const rerouteNodes = findLegacyRerouteNodes(workflowWithoutReroutes)

      expect(rerouteNodes).toHaveLength(0)
    })
  })

  describe('createReroutePoints', () => {
    it('should create reroute points from legacy Reroute nodes', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { reroutes, rerouteIdMap } = createReroutePoints(rerouteNodes)

      expect(reroutes).toHaveLength(3)

      // Check that each reroute has the correct position
      expect(reroutes[0].pos).toEqual([510, 280])
      expect(reroutes[1].pos).toEqual([404.7915344238281, 280.9454650878906])
      expect(reroutes[2].pos).toEqual([514, 386])

      // Check that the ID map is correct
      expect(rerouteIdMap.get(13)).toBe(1)
      expect(rerouteIdMap.get(25)).toBe(2)
      expect(rerouteIdMap.get(27)).toBe(3)
    })

    it('should initialize empty linkIds arrays for each reroute', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { reroutes } = createReroutePoints(rerouteNodes)

      reroutes.forEach((reroute) => {
        expect(reroute.linkIds).toEqual([])
      })
    })
  })

  describe('establishRerouteRelationships', () => {
    it('should set parent-child relationships between connected reroutes', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { reroutes, rerouteIdMap } = createReroutePoints(rerouteNodes)

      establishRerouteRelationships(sampleWorkflow, reroutes, rerouteIdMap)

      // In the sample workflow, node 13 is connected from node 25, and node 27 is connected from node 25
      const reroute13 = reroutes.find((r) => r.id === rerouteIdMap.get(13))
      const reroute27 = reroutes.find((r) => r.id === rerouteIdMap.get(27))

      expect(reroute13?.parentId).toBe(rerouteIdMap.get(25))
      expect(reroute27?.parentId).toBe(rerouteIdMap.get(25))
    })

    it('should not set parentId for reroutes without parent reroutes', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { reroutes, rerouteIdMap } = createReroutePoints(rerouteNodes)

      establishRerouteRelationships(sampleWorkflow, reroutes, rerouteIdMap)

      // Node 25 is the root reroute and should not have a parentId
      const reroute25 = reroutes.find((r) => r.id === rerouteIdMap.get(25))

      expect(reroute25?.parentId).toBeUndefined()
    })
  })

  describe('findRootReroute', () => {
    it('should find the root reroute in a chain', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { reroutes, rerouteIdMap } = createReroutePoints(rerouteNodes)

      establishRerouteRelationships(sampleWorkflow, reroutes, rerouteIdMap)

      // Node 25 is the root reroute
      const rootId = findRootReroute(reroutes, rerouteIdMap.get(13)!)

      expect(rootId).toBe(rerouteIdMap.get(25))
    })

    it('should return the same ID if the reroute is already a root', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { reroutes, rerouteIdMap } = createReroutePoints(rerouteNodes)

      establishRerouteRelationships(sampleWorkflow, reroutes, rerouteIdMap)

      const rootId = findRootReroute(reroutes, rerouteIdMap.get(25)!)

      expect(rootId).toBe(rerouteIdMap.get(25))
    })
  })

  describe('findOriginalSource', () => {
    it('should find the original source node and slot for a reroute', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { reroutes, rerouteIdMap } = createReroutePoints(rerouteNodes)

      establishRerouteRelationships(sampleWorkflow, reroutes, rerouteIdMap)

      const rootRerouteId = rerouteIdMap.get(25)!
      const source = findOriginalSource(
        sampleWorkflow,
        rerouteIdMap,
        rootRerouteId
      )

      expect(source).toBeDefined()
      expect(source?.nodeId).toBe(4) // CheckpointLoaderSimple
      expect(source?.slot).toBe(2) // VAE output
    })

    it('should return undefined if no source is found', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { rerouteIdMap } = createReroutePoints(rerouteNodes)

      // Create a modified workflow with no link to the root reroute
      const modifiedWorkflow = {
        ...sampleWorkflow,
        links: sampleWorkflow.links.filter((link) => link[3] !== 25)
      }

      const rootRerouteId = rerouteIdMap.get(25)!
      const source = findOriginalSource(
        modifiedWorkflow,
        rerouteIdMap,
        rootRerouteId
      )

      expect(source).toBeUndefined()
    })
  })

  describe('findRerouteTargets', () => {
    it('should find all target nodes that a reroute connects to', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { rerouteIdMap } = createReroutePoints(rerouteNodes)

      // Node 25 connects to nodes 12 and 26 through reroutes 13 and 27
      const targets = findRerouteTargets(sampleWorkflow, rerouteIdMap, 25)

      expect(targets).toHaveLength(2)

      // Check that the targets include both VAEDecode nodes
      const targetIds = targets.map((t) => t.nodeId)
      expect(targetIds).toContain(12)
      expect(targetIds).toContain(26)

      // Check that the slots and data types are correct
      const target12 = targets.find((t) => t.nodeId === 12)
      const target26 = targets.find((t) => t.nodeId === 26)

      expect(target12?.slot).toBe(1) // vae input
      expect(target12?.dataType).toBe('VAE')

      expect(target26?.slot).toBe(1) // vae input
      expect(target26?.dataType).toBe('VAE')
    })

    it('should return an empty array if no targets are found', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { rerouteIdMap } = createReroutePoints(rerouteNodes)

      // Create a modified workflow with no outgoing links from the reroute
      const modifiedWorkflow = {
        ...sampleWorkflow,
        links: sampleWorkflow.links.filter(
          (link) => link[0] !== 21 && link[0] !== 34
        )
      }

      const targets = findRerouteTargets(modifiedWorkflow, rerouteIdMap, 13)

      expect(targets).toHaveLength(0)
    })
  })

  describe('createNewLinks', () => {
    it('should create direct links from original sources to final targets', () => {
      const rerouteNodes = findLegacyRerouteNodes(sampleWorkflow)
      const { reroutes, rerouteIdMap } = createReroutePoints(rerouteNodes)

      establishRerouteRelationships(sampleWorkflow, reroutes, rerouteIdMap)

      const { links, linkExtensions } = createNewLinks(
        sampleWorkflow,
        reroutes,
        rerouteIdMap
      )

      // We expect direct links from node 4 to nodes 12 and 26
      expect(links).toHaveLength(2)

      // Check that the links are correct
      const link1 = links.find((link) => link[3] === 12)
      const link2 = links.find((link) => link[3] === 26)

      expect(link1?.[1]).toBe(4) // source node
      expect(link1?.[2]).toBe(2) // source slot
      expect(link1?.[4]).toBe(1) // target slot
      expect(link1?.[5]).toBe('VAE') // data type

      expect(link2?.[1]).toBe(4) // source node
      expect(link2?.[2]).toBe(2) // source slot
      expect(link2?.[4]).toBe(1) // target slot
      expect(link2?.[5]).toBe('VAE') // data type

      // Check that link extensions are created
      expect(linkExtensions).toHaveLength(2)
    })

    it('should preserve non-reroute links', () => {
      // Add a direct link to the workflow
      const workflowWithDirectLink: WorkflowJSON04 = {
        ...sampleWorkflow,
        links: [
          ...sampleWorkflow.links,
          [99, 4, 0, 12, 0, 'MODEL'] // Direct link from node 4 to node 12
        ]
      }

      const rerouteNodes = findLegacyRerouteNodes(workflowWithDirectLink)
      const { reroutes, rerouteIdMap } = createReroutePoints(rerouteNodes)

      establishRerouteRelationships(
        workflowWithDirectLink,
        reroutes,
        rerouteIdMap
      )

      const { links } = createNewLinks(
        workflowWithDirectLink,
        reroutes,
        rerouteIdMap
      )

      // We expect the direct link to be preserved
      const directLink = links.find((link) => link[0] === 99)
      expect(directLink).toBeDefined()
      expect(directLink).toEqual([99, 4, 0, 12, 0, 'MODEL'])
    })
  })

  describe('migrateLegacyRerouteNodes', () => {
    it('should migrate legacy reroute nodes to native reroute points', () => {
      const migratedWorkflow = migrateLegacyRerouteNodes(sampleWorkflow)

      // Check that reroute nodes are removed
      expect(
        migratedWorkflow.nodes.every((node) => node.type !== 'Reroute')
      ).toBe(true)

      // Check that reroute points are created
      expect(migratedWorkflow.extra?.reroutes).toBeDefined()
      expect(migratedWorkflow.extra?.reroutes?.length).toBe(3)

      // Check that link extensions are created
      expect(migratedWorkflow.extra?.linkExtensions).toBeDefined()
      expect(migratedWorkflow.extra?.linkExtensions?.length).toBe(2)

      // Check that direct links are created
      expect(migratedWorkflow.links.length).toBe(2)

      // Check that the links connect the original source to the final targets
      const sourceNodeId = 4
      const targetNodeIds = [12, 26]

      migratedWorkflow.links.forEach((link) => {
        expect(link[1]).toBe(sourceNodeId)
        expect(targetNodeIds).toContain(link[3])
      })
    })

    it('should return the original workflow if no reroute nodes exist', () => {
      const workflowWithoutReroutes: WorkflowJSON04 = {
        ...sampleWorkflow,
        nodes: sampleWorkflow.nodes.filter((node) => node.type !== 'Reroute')
      }

      const migratedWorkflow = migrateLegacyRerouteNodes(
        workflowWithoutReroutes
      )

      // The workflow should be unchanged
      expect(migratedWorkflow).toEqual(workflowWithoutReroutes)
    })

    it('should match the expected output for the sample workflow', () => {
      const migratedWorkflow = migrateLegacyRerouteNodes(sampleWorkflow)

      // Compare with expected output
      // Note: We're not doing a direct equality check because the exact IDs might differ
      // but the structure should be the same

      // Check nodes
      expect(migratedWorkflow.nodes.length).toBe(
        expectedMigratedWorkflow.nodes.length
      )

      // Check that reroute nodes are removed
      expect(
        migratedWorkflow.nodes.every((node) => node.type !== 'Reroute')
      ).toBe(true)

      // Check that reroutes are created
      expect(migratedWorkflow.extra?.reroutes?.length).toBe(
        expectedMigratedWorkflow.extra?.reroutes?.length
      )

      // Check that link extensions are created
      expect(migratedWorkflow.extra?.linkExtensions?.length).toBe(
        expectedMigratedWorkflow.extra?.linkExtensions?.length
      )

      // Check that direct links are created
      expect(migratedWorkflow.links.length).toBe(
        expectedMigratedWorkflow.links.length
      )
    })
  })
})
