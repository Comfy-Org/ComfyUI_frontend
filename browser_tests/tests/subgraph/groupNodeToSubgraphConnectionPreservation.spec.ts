import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * Regression: BUG-002 (fixed by #13809) — group -> subgraph conversion dropping
 * an external input connection and corrupting widget values.
 *
 * Group nodes are deprecated and are auto-converted to subgraphs on load. The
 * conversion previously keyed exposed inputs by (unreliable) slot id, which
 * dropped external input links and let widget values bleed / corrupt.
 *
 * Repro (synthetic; Denys's group2.json is a Slack attachment we don't have):
 * a group node wraps a KSampler whose `latent_image` input is exposed and fed
 * by an external EmptyLatentImage. The grouped KSampler carries distinctive
 * widget values. On load, after auto-conversion to a subgraph we assert:
 *   1. the external latent connection survived (EmptyLatentImage -> subgraph),
 *   2. the connection reaches the interior KSampler's latent_image input,
 *   3. the KSampler widget values are unchanged (no corruption / bleed).
 *
 * The e2e value-add over the unit tests (groupNode.test.ts >
 * "maps exposed inputs by name instead of definition index") is exercising the
 * real end-to-end load + auto-conversion + reconnect path.
 *
 * Fixture: browser_tests/assets/groupnodes/group_ksampler_external_latent.json
 * (schema-validated against workflowSchema; derived from the known-good
 * group_node_v1.3.3.json).
 */
test.describe(
  'Group node -> subgraph connection preservation',
  { tag: ['@subgraph', '@node'] },
  () => {
    const WORKFLOW = 'groupnodes/group_ksampler_external_latent'

    // Distinctive KSampler widget values baked into the fixture. Kept in sync
    // with the group's inner KSampler widgets_values.
    const EXPECTED_KSAMPLER_WIDGETS: Record<string, string | number> = {
      seed: 42424242,
      steps: 17,
      cfg: 6.5,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise: 0.87
    }

    interface ConversionState {
      subgraphCount: number
      groupNodeInstances: number
      hostLatentConnected: boolean
      hostLatentOriginType: string | null
      interiorHasKSampler: boolean
      interiorKSamplerLatentConnected: boolean
      ksamplerWidgets: Record<string, string | number | boolean | null>
    }

    async function readConversionState(comfyPage: {
      page: {
        evaluate: (fn: () => ConversionState) => Promise<ConversionState>
      }
    }): Promise<ConversionState> {
      return comfyPage.page.evaluate(() => {
        const rootGraph = window.app!.graph!
        const isSub = (n: unknown): boolean =>
          typeof (n as { isSubgraphNode?: () => boolean }).isSubgraphNode ===
            'function' &&
          !!(n as { isSubgraphNode: () => boolean }).isSubgraphNode()

        const subgraphNodes = rootGraph.nodes.filter(isSub)
        const groupNodeInstances = rootGraph.nodes.filter((n) =>
          String(n.type).startsWith('workflow>')
        ).length

        const host = subgraphNodes[0]
        const latentInput = host?.inputs?.find(
          (i) => i.name === 'latent_image' || i.type === 'LATENT'
        )
        const hostLatentConnected = latentInput?.link != null
        let hostLatentOriginType: string | null = null
        if (latentInput?.link != null) {
          const link = rootGraph.links[latentInput.link]
          const origin = link ? rootGraph.getNodeById(link.origin_id) : null
          hostLatentOriginType = origin ? String(origin.type) : null
        }

        // Walk into the subgraph and inspect the interior KSampler.
        const interiorNodes =
          (host as unknown as { subgraph?: { nodes: unknown[] } }).subgraph
            ?.nodes ?? []
        const ksampler = (interiorNodes as { type?: string }[]).find(
          (n) => n.type === 'KSampler'
        ) as
          | {
              inputs?: { name: string; link: number | null }[]
              widgets?: { name: string; value: unknown }[]
            }
          | undefined

        const ksamplerWidgets: Record<
          string,
          string | number | boolean | null
        > = {}
        for (const w of ksampler?.widgets ?? []) {
          const v = w.value
          if (
            typeof v === 'string' ||
            typeof v === 'number' ||
            typeof v === 'boolean' ||
            v === null
          ) {
            ksamplerWidgets[w.name] = v
          }
        }
        const ksLatent = ksampler?.inputs?.find(
          (i) => i.name === 'latent_image'
        )

        return {
          subgraphCount: subgraphNodes.length,
          groupNodeInstances,
          hostLatentConnected,
          hostLatentOriginType,
          interiorHasKSampler: !!ksampler,
          interiorKSamplerLatentConnected: ksLatent?.link != null,
          ksamplerWidgets
        }
      })
    }

    test('Auto-converted group preserves the external latent connection and widget values', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      // Group node auto-converted into exactly one subgraph, with no group
      // node instances left behind.
      await expect
        .poll(() => readConversionState(comfyPage).then((s) => s.subgraphCount))
        .toBe(1)

      const state = await readConversionState(comfyPage)

      expect(
        state.groupNodeInstances,
        'Group node should be fully migrated to a subgraph'
      ).toBe(0)

      const topo = await comfyPage.page.evaluate(() => {
        const rg = window.app!.graph!
        const dumpNode = (n: any) => ({
          id: n.id,
          type: n.type,
          isSub:
            typeof n.isSubgraphNode === 'function' ? n.isSubgraphNode() : false,
          inputs: (n.inputs ?? []).map((i: any) => ({
            name: i.name,
            type: i.type,
            link: i.link
          })),
          outputs: (n.outputs ?? []).map((o: any) => ({
            name: o.name,
            type: o.type,
            links: o.links
          }))
        })
        const root = rg.nodes.map(dumpNode)
        const links = Object.entries(rg.links).map(([id, l]: [string, any]) => ({
          id,
          origin_id: l?.origin_id,
          origin_slot: l?.origin_slot,
          target_id: l?.target_id,
          target_slot: l?.target_slot,
          type: l?.type
        }))
        const host = rg.nodes.find((n: any) =>
          typeof n.isSubgraphNode === 'function' ? n.isSubgraphNode() : false
        )
        const sg = (host as any)?.subgraph
        const interior = (sg?.nodes ?? []).map(dumpNode)
        const sgInputs = (sg?.inputs ?? []).map((i: any) => ({
          name: i.name,
          type: i.type
        }))
        return { root, links, interior, sgInputs }
      })

      // BUG-002 part 1: the external latent connection survived the conversion.
      expect(
        state.hostLatentConnected,
        'DIAG ' + JSON.stringify(topo)
      ).toBe(true)
      expect(state.hostLatentOriginType).toBe('EmptyLatentImage')

      // The connection reaches all the way to the interior KSampler.
      expect(state.interiorHasKSampler).toBe(true)
      expect(
        state.interiorKSamplerLatentConnected,
        'Interior KSampler latent_image is not connected to the subgraph input'
      ).toBe(true)

      // BUG-002 part 2: the KSampler widget values are intact (no corruption /
      // bleed from the slot-id keyed mapping).
      for (const [name, value] of Object.entries(EXPECTED_KSAMPLER_WIDGETS)) {
        expect(
          state.ksamplerWidgets[name],
          `KSampler widget "${name}" was corrupted during conversion`
        ).toBe(value)
      }
    })
  }
)
