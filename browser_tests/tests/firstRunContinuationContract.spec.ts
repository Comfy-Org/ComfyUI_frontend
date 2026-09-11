import type { WorkflowTemplates } from '@/platform/workflow/templates/types/template'
import {
  acceptsTemplateImageInput,
  replaceTemplateImageInput
} from '@/platform/workflow/templates/utils/templateWorkflowTransforms'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { SUGGESTIONS } from '@/renderer/extensions/firstRunTour/nudge/firstRunSuggestions'
import { toNodeId } from '@/types/nodeId'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  FIRST_RUN_OUTPUT,
  FIRST_RUN_OUTPUT_WIDGET_VALUE
} from '@e2e/fixtures/data/firstRunTour'

test.describe(
  'Real first-run continuation contracts',
  { tag: ['@cloud', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        true
      )
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        false
      )
      await comfyPage.canvasOps.resetView()
    })

    test('Served continuation metadata, assets, node identity and widget serialization remain compatible', async ({
      comfyPage
    }) => {
      test.slow()
      const catalogResponse = await comfyPage.request.get(
        `${comfyPage.url}/templates/index.json`
      )
      expect(
        catalogResponse.ok(),
        'the served template catalog must exist'
      ).toBe(true)
      const catalog: WorkflowTemplates[] = await catalogResponse.json()
      expect(
        Array.isArray(catalog),
        'template index must contain modules'
      ).toBe(true)
      const coreTemplates = catalog
        .filter(({ moduleName }) => moduleName === 'default')
        .flatMap(({ templates }) => templates)
      expect(
        SUGGESTIONS.map(({ templateId }) => templateId).filter(
          (templateId) => !coreTemplates.some(({ name }) => name === templateId)
        ),
        'the backend template package must serve every enabled continuation'
      ).toEqual([])

      for (const { templateId } of SUGGESTIONS) {
        await test.step(templateId, async () => {
          const matches = coreTemplates.filter(
            ({ name }) => name === templateId
          )
          expect(
            matches,
            'each continuation must have one catalog entry'
          ).toHaveLength(1)
          const template = matches[0]
          expect(
            acceptsTemplateImageInput(template),
            `${templateId} must declare exactly one image input bound to a LoadImage node`
          ).toBe(true)
          const input = template.io!.inputs!.find(
            ({ mediaType }) => mediaType === 'image'
          )!
          const response = await comfyPage.request.get(
            `${comfyPage.url}/templates/${templateId}.json`
          )
          expect(response.ok(), `${templateId}.json must be served`).toBe(true)
          const workflow = await validateComfyWorkflow(await response.json())
          expect(
            workflow,
            `${templateId} must satisfy the workflow schema`
          ).not.toBeNull()
          if (!workflow)
            throw new Error(`${templateId} is not a valid workflow`)

          const transformed = replaceTemplateImageInput(
            workflow,
            template,
            FIRST_RUN_OUTPUT
          )
          expect(
            transformed.ok,
            transformed.ok ? templateId : `${templateId}: ${transformed.error}`
          ).toBe(true)
          if (!transformed.ok) throw new Error(transformed.error)

          expect(
            transformed.value.nodes.filter(
              ({ id }) => String(id) !== String(input.nodeId)
            ),
            'continuation binding must preserve every other node'
          ).toEqual(
            workflow.nodes.filter(
              ({ id }) => String(id) !== String(input.nodeId)
            )
          )

          const loaded = []
          for (const graph of [workflow, transformed.value]) {
            await comfyPage.workflow.loadGraphData(graph)
            loaded.push(
              await comfyPage.page.evaluate((nodeId) => {
                const node = window.app!.graph.getNodeById(nodeId)
                if (!node)
                  throw new Error(
                    `Declared input node ${nodeId} was not loaded`
                  )
                const imageWidget = node.widgets?.find(
                  ({ name }) => name === 'image'
                )
                if (!imageWidget)
                  throw new Error(`Node ${nodeId} has no named image widget`)
                const serializedWidgets = (node.widgets ?? []).filter(
                  ({ serialize }) => serialize !== false
                )
                return {
                  type: node.type,
                  image: imageWidget.value,
                  imageIndex: serializedWidgets.findIndex(
                    ({ name }) => name === 'image'
                  ),
                  otherWidgets: serializedWidgets
                    .filter(({ name }) => name !== 'image')
                    .map(({ name, value }) => ({ name, value })),
                  serialized: node.serialize()
                }
              }, toNodeId(input.nodeId!))
            )
          }

          const [original, continued] = loaded
          expect(continued.type).toBe('LoadImage')
          expect(
            continued.image,
            'the named image widget must receive the output path'
          ).toBe(FIRST_RUN_OUTPUT_WIDGET_VALUE)
          expect(
            continued.imageIndex,
            'the image widget must serialize'
          ).toBeGreaterThanOrEqual(0)
          expect(
            continued.serialized.widgets_values?.[continued.imageIndex]
          ).toBe(FIRST_RUN_OUTPUT_WIDGET_VALUE)
          expect(continued.serialized.widgets_values_named?.image).toBe(
            FIRST_RUN_OUTPUT_WIDGET_VALUE
          )
          const prompt = await comfyPage.workflow.getExportedWorkflow({
            api: true
          })
          expect(
            prompt[String(input.nodeId)]?.inputs.image,
            'the execution prompt must serialize the same image input'
          ).toBe(FIRST_RUN_OUTPUT_WIDGET_VALUE)
          expect(
            continued.otherWidgets,
            'binding must preserve other serialized widgets'
          ).toEqual(original.otherWidgets)

          await test.step('rebind a saved workflow with native named widget values', async () => {
            const savedWorkflow = await comfyPage.workflow.getExportedWorkflow()
            expect(
              savedWorkflow.nodes.find(
                ({ id }) => String(id) === String(input.nodeId)
              ),
              'the saved graph must exercise native named-widget precedence'
            ).toMatchObject({
              widgets_values_named: { image: FIRST_RUN_OUTPUT_WIDGET_VALUE }
            })
            const roundTrip = replaceTemplateImageInput(
              savedWorkflow,
              template,
              { ...FIRST_RUN_OUTPUT, filename: 'first-run-round-trip.webp' }
            )
            expect(
              roundTrip.ok,
              roundTrip.ok ? templateId : roundTrip.error
            ).toBe(true)
            if (!roundTrip.ok) throw new Error(roundTrip.error)

            await comfyPage.workflow.loadGraphData(roundTrip.value)
            const node = await comfyPage.nodeOps.getNodeRefById(input.nodeId!)
            const imageWidget = await node.getWidgetByName('image')
            await expect
              .poll(() => imageWidget.getValue())
              .toBe('first-run-round-trip.webp [output]')

            const roundTripPrompt =
              await comfyPage.workflow.getExportedWorkflow({
                api: true
              })
            expect(roundTripPrompt[String(input.nodeId)]?.inputs.image).toBe(
              'first-run-round-trip.webp [output]'
            )
          })

          if (templateId === SUGGESTIONS[0].templateId) {
            await test.step('normalize legacy named-object widgets for both restoration modes', async () => {
              const legacyWorkflow =
                await comfyPage.workflow.getExportedWorkflow()
              const legacyNode = legacyWorkflow.nodes.find(
                ({ id }) => String(id) === String(input.nodeId)
              )
              if (!legacyNode)
                throw new Error(
                  `Declared input node ${input.nodeId} was not saved`
                )
              const namedWidgets = continued.serialized.widgets_values_named
              expect(namedWidgets?.upload).toEqual(expect.any(String))
              legacyNode.widgets_values = { ...namedWidgets }
              delete legacyNode.widgets_values_named

              const normalized = replaceTemplateImageInput(
                legacyWorkflow,
                template,
                {
                  ...FIRST_RUN_OUTPUT,
                  filename: 'first-run-legacy-object.webp'
                }
              )
              expect(
                normalized.ok,
                normalized.ok ? templateId : normalized.error
              ).toBe(true)
              if (!normalized.ok) throw new Error(normalized.error)

              for (const restoreNamed of [false, true]) {
                await comfyPage.settings.setSetting(
                  'Comfy.Workflow.NamedValuesRestore',
                  restoreNamed
                )
                await comfyPage.workflow.loadGraphData(normalized.value)
                const node = await comfyPage.nodeOps.getNodeRefById(
                  input.nodeId!
                )
                const imageWidget = await node.getWidgetByName('image')
                await expect
                  .poll(() => imageWidget.getValue())
                  .toBe('first-run-legacy-object.webp [output]')
                const uploadWidget = await node.getWidgetByName('upload')
                expect(await uploadWidget.getValue()).toBe(namedWidgets?.upload)

                const legacyPrompt =
                  await comfyPage.workflow.getExportedWorkflow({ api: true })
                expect(legacyPrompt[String(input.nodeId)]?.inputs.image).toBe(
                  'first-run-legacy-object.webp [output]'
                )
              }
            })
          }
        })
      }
    })
  }
)
