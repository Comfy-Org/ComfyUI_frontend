import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'ECS migration: undo/redo',
  { tag: ['@canvas', '@workflow'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.UseNewMenu': 'Top',
        'Comfy.Workflow.WorkflowTabsPosition': 'Topbar'
      }
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.canvasOps.resetView()
    })

    for (const vueNodesEnabled of [false, true]) {
      test(`moving a node can be undone and a second redo is a no-op (${vueNodesEnabled ? 'Vue' : 'LiteGraph'})`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.loadWorkflow('default')
        if (vueNodesEnabled) await comfyPage.vueNodes.waitForNodes()
        const node = await comfyPage.nodeOps.getNodeRefById('3')
        const initialPosition = await node.getBounding()

        await node.dragBy({ x: 120, y: 80 })
        await expect.poll(() => node.getBounding()).not.toEqual(initialPosition)
        const movedPosition = await node.getBounding()

        await comfyPage.keyboard.undo()
        await expect.poll(() => node.getBounding()).toEqual(initialPosition)

        await comfyPage.keyboard.redo()
        await expect.poll(() => node.getBounding()).toEqual(movedPosition)
        await comfyPage.keyboard.redo()
        await expect.poll(() => node.getBounding()).toEqual(movedPosition)
        await expect(comfyPage.toast.toastErrors).toHaveCount(0)
      })
    }

    test('moving a group by its title can be undone', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('selection/three-nodes-and-group')
      const initialPosition = await comfyPage.canvasOps.getGroupPosition('Pair')
      const containedNode = await comfyPage.nodeOps.getNodeRefById('2')
      const initialNodePosition = await containedNode.getBounding()
      await comfyPage.canvasOps.dragGroup({
        name: 'Pair',
        deltaX: 100,
        deltaY: 60
      })
      await expect
        .poll(() => comfyPage.canvasOps.getGroupPosition('Pair'))
        .not.toEqual(initialPosition)
      await expect
        .poll(() => containedNode.getBounding())
        .not.toEqual(initialNodePosition)

      await comfyPage.keyboard.undo()
      await expect
        .poll(() => comfyPage.canvasOps.getGroupPosition('Pair'))
        .toEqual(initialPosition)
      await expect
        .poll(() => containedNode.getBounding())
        .toEqual(initialNodePosition)
    })

    for (const vueNodesEnabled of [false, true]) {
      test(
        `changing a widget value can be undone and redone (${vueNodesEnabled ? 'Vue' : 'LiteGraph'})`,
        { tag: ['@widget'] },
        async ({ comfyPage }) => {
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            vueNodesEnabled
          )
          await comfyPage.workflow.loadWorkflow('default')
          if (vueNodesEnabled) await comfyPage.vueNodes.waitForNodes()
          const node = await comfyPage.nodeOps.getNodeRefById('3')
          const steps = await node.getWidget(2)
          const initialValue = await steps.getValue()

          if (vueNodesEnabled) {
            await comfyPage.vueNodes.editAndCommitNumber(
              'KSampler',
              'steps',
              '31'
            )
          } else {
            await steps.dragHorizontal(80)
          }
          await expect.poll(() => steps.getValue()).not.toBe(initialValue)
          const changedValue = await steps.getValue()

          await comfyPage.keyboard.undo()
          await expect.poll(() => steps.getValue()).toBe(initialValue)

          await comfyPage.keyboard.redo()
          await expect.poll(() => steps.getValue()).toBe(changedValue)
        }
      )
    }

    test(
      'three mixed Vue Nodes edits can be undone and redone in order',
      {
        tag: ['@vue-nodes', '@widget']
      },
      async ({ comfyPage, comfyMouse }) => {
        await comfyPage.workflow.loadWorkflow('default')
        await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
        const node = await comfyPage.nodeOps.getNodeRefById('3')
        const initialPosition = await node.getBounding()
        const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

        const movedPosition =
          await test.step('Move the KSampler node', async () => {
            await comfyMouse.dragElementBy(ksampler.title, { x: 100, y: 50 })
            await expect
              .poll(() => node.getBounding())
              .not.toEqual(initialPosition)
            await expect
              .poll(() => comfyPage.workflow.getUndoQueueSize())
              .toBe(1)
            return node.getBounding()
          })

        const stepsWidget = comfyPage.vueNodes.getWidgetByName(
          'KSampler',
          'steps'
        )
        const { input } = comfyPage.vueNodes.getInputNumberControls(stepsWidget)
        const initialSteps = await input.inputValue()

        await test.step('Change the KSampler steps value', async () => {
          await comfyPage.vueNodes.editAndCommitNumber(
            'KSampler',
            'steps',
            '31'
          )
          await expect
            .poll(async () => (await node.getWidget(2)).getValue())
            .toBe(31)
          await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(2)
        })

        const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()

        await test.step('Add a Note node', async () => {
          await comfyPage.searchBoxV2.addNode('Note')
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(initialNodeCount + 1)
          await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(3)
        })

        const expectState = async (
          position: typeof initialPosition,
          steps: string,
          nodeCount: number
        ) => {
          await expect.poll(() => node.getBounding()).toEqual(position)
          await expect(input).toHaveValue(steps)
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(nodeCount)
        }

        await test.step('Undo removes only the Note node', async () => {
          await comfyPage.keyboard.undo()
          await expectState(movedPosition, '31', initialNodeCount)
        })
        await test.step('Undo restores only the steps value', async () => {
          await comfyPage.keyboard.undo()
          await expectState(movedPosition, initialSteps, initialNodeCount)
        })
        await test.step('Undo restores only the node position', async () => {
          await comfyPage.keyboard.undo()
          await expectState(initialPosition, initialSteps, initialNodeCount)
        })

        await test.step('Redo reapplies only the node move', async () => {
          await comfyPage.keyboard.redo()
          await expectState(movedPosition, initialSteps, initialNodeCount)
        })
        await test.step('Redo reapplies only the steps value', async () => {
          await comfyPage.keyboard.redo()
          await expectState(movedPosition, '31', initialNodeCount)
        })
        await test.step('Redo restores only the Note node', async () => {
          await comfyPage.keyboard.redo()
          await expectState(movedPosition, '31', initialNodeCount + 1)
        })
      }
    )

    test.describe('compound graph history', () => {
      test.use({
        initialSettings: {
          'Comfy.UseNewMenu': 'Top',
          'Comfy.Workflow.WorkflowTabsPosition': 'Topbar',
          'Comfy.LinkRelease.Action': 'no action'
        }
      })

      test(
        'undoes and redoes the complete compound graph edit chain',
        { tag: ['@vue-nodes', '@widget'] },
        async ({ comfyPage }) => {
          test.slow()
          await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(0)
          await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
          await comfyPage.nextFrame()

          const getSnapshot = () =>
            comfyPage.page.evaluate(() => ({
              nodes: window
                .app!.graph.nodes.map((node) => ({
                  id: String(node.id),
                  type: node.type,
                  position: [...node.pos],
                  widgets: (node.widgets ?? []).map(({ name, value }) => ({
                    name,
                    value: value ?? null
                  }))
                }))
                .sort((left, right) => left.id.localeCompare(right.id)),
              links: [...window.app!.graph.links.values()]
                .map((link) => ({
                  originId: String(link.origin_id),
                  originSlot: link.origin_slot,
                  targetId: String(link.target_id),
                  targetSlot: link.target_slot
                }))
                .sort((left, right) =>
                  JSON.stringify(left).localeCompare(JSON.stringify(right))
                )
            }))
          const snapshots = [await getSnapshot()]
          const checkpoint = async () => {
            await expect
              .poll(() => comfyPage.workflow.getUndoQueueSize())
              .toBe(snapshots.length)
            let snapshot: Awaited<ReturnType<typeof getSnapshot>> | undefined
            await expect
              .poll(async () => {
                const current = await getSnapshot()
                const isStable =
                  snapshot !== undefined &&
                  JSON.stringify(current) === JSON.stringify(snapshot)
                snapshot = current
                return isStable
              })
              .toBe(true)
            if (snapshot === undefined)
              throw new Error('Snapshot was not captured')
            snapshots.push(snapshot)
          }

          await test.step('Create a checkpoint loader', async () => {
            await comfyPage.searchBoxV2.addNode('Load Checkpoint', {
              position: { x: 250, y: 250 }
            })
            await expect
              .poll(() => comfyPage.nodeOps.getGraphNodesCount())
              .toBe(1)
            await checkpoint()
          })

          const loader = await comfyPage.nodeOps.getNodeRefByType(
            'CheckpointLoaderSimple'
          )

          await test.step('Create a KSampler', async () => {
            await comfyPage.searchBoxV2.addNode('KSampler', {
              position: { x: 650, y: 250 }
            })
            await expect
              .poll(() => comfyPage.nodeOps.getGraphNodesCount())
              .toBe(2)
            await checkpoint()
          })

          const sampler = await comfyPage.nodeOps.getNodeRefByType('KSampler')

          const output = await loader.getOutput(0)
          const samplerInput = await sampler.getInput(0)

          await test.step('Connect the loader to the sampler', async () => {
            await loader.connectOutput(0, sampler, 0)
            await output.expectLinkCount(1)
            await samplerInput.expectLinkCount(1)
            await comfyPage.page.mouse.click(600, 650)
            await checkpoint()
          })

          await test.step('Move the checkpoint loader', async () => {
            await loader.dragBy({ x: 90, y: 60 })
            await checkpoint()
          })

          await test.step('Move the KSampler', async () => {
            await sampler.dragBy({ x: 70, y: 100 })
            await checkpoint()
          })

          await test.step('Change the KSampler steps value', async () => {
            await comfyPage.vueNodes.editAndCommitNumber(
              'KSampler',
              'steps',
              '31'
            )
            await expect
              .poll(async () =>
                (await sampler.getWidgetByName('steps')).getValue()
              )
              .toBe(31)
            await checkpoint()
          })

          await test.step('Change the KSampler CFG value', async () => {
            await comfyPage.vueNodes.editAndCommitNumber(
              'KSampler',
              'cfg',
              '9.5'
            )
            await expect
              .poll(async () =>
                (await sampler.getWidgetByName('cfg')).getValue()
              )
              .toBe(9.5)
            await checkpoint()
          })

          await test.step('Disconnect the loader from the sampler', async () => {
            await comfyPage.canvasOps.dragAndDrop(
              await samplerInput.getPosition(),
              { x: 900, y: 650 }
            )
            await samplerInput.expectLinkCount(0)
            await output.expectLinkCount(0)
            await comfyPage.page.mouse.click(600, 650)
            await checkpoint()
          })

          await test.step('Reconnect the loader to the sampler', async () => {
            await expect
              .poll(async () => {
                const [source, target] = await Promise.all([
                  output.getPosition(),
                  samplerInput.getPosition()
                ])
                return target.x - source.x
              })
              .toBeGreaterThan(100)
            await loader.connectOutput(0, sampler, 0)
            await output.expectLinkCount(1)
            await samplerInput.expectLinkCount(1)
            await comfyPage.page.mouse.click(600, 650)
            await checkpoint()
          })

          await test.step('Delete the KSampler', async () => {
            await sampler.delete()
            await expect
              .poll(() => comfyPage.nodeOps.getGraphNodesCount())
              .toBe(1)
            await output.expectLinkCount(0)
            await checkpoint()
          })

          await test.step('Undo the complete edit chain', async () => {
            for (let index = snapshots.length - 2; index >= 0; index--) {
              await comfyPage.keyboard.undo()
              await expect.poll(getSnapshot).toEqual(snapshots[index])
            }
          })

          await test.step('Redo the complete edit chain', async () => {
            for (let index = 1; index < snapshots.length; index++) {
              await comfyPage.keyboard.redo()
              await expect.poll(getSnapshot).toEqual(snapshots[index])
            }
          })

          await expect(comfyPage.toast.toastErrors).toHaveCount(0)
        }
      )
    })

    test('undo remains scoped to the edited workflow after switching tabs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.menu.topbar.saveWorkflow('Undo Tab A')
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
      const node = await comfyPage.nodeOps.getNodeRefById('3')
      const initialPosition = await node.getProperty<[number, number]>('pos')

      await test.step('Move a node in Tab A', async () => {
        await node.dragBy({ x: 100, y: 50 })
        await expect
          .poll(() => node.getProperty<[number, number]>('pos'))
          .not.toEqual(initialPosition)
        await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
      })

      const tabsBeforeNew = await comfyPage.menu.topbar.getTabNames()
      await test.step('Open a fresh Tab B', async () => {
        await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      })
      const tabsAfterNew = await comfyPage.menu.topbar.getTabNames()
      const newTabs = tabsAfterNew.filter(
        (name) => !tabsBeforeNew.includes(name)
      )
      expect(newTabs, 'New must create exactly one workflow tab').toHaveLength(
        1
      )
      if (newTabs.length !== 1) throw new Error('Expected one new workflow tab')
      const [tabBName] = newTabs
      const tabB = comfyPage.menu.topbar.getWorkflowTab(tabBName)
      await expect(tabB).toBeVisible()

      // Undo in the fresh tab must be a no-op: its queue is empty and it must
      // not reach back into Tab A's history.
      await test.step('Undo is isolated in the fresh tab', async () => {
        await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
        await comfyPage.keyboard.undo()
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      })

      await test.step('Undo the edit after returning to Tab A', async () => {
        await comfyPage.workflow.switchToTab('Undo Tab A')
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
        await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
        await expect
          .poll(() => node.getProperty<[number, number]>('pos'))
          .not.toEqual(initialPosition)
        await expect(async () => {
          await comfyPage.menu.topbar.triggerTopbarCommand(['Edit', 'Undo'])
        }).toPass({ timeout: 5000 })
        await expect
          .poll(() => node.getProperty<[number, number]>('pos'))
          .toEqual(initialPosition)
      })

      await test.step('Tab B remains empty after Tab A undo', async () => {
        await comfyPage.workflow.switchToTab(tabBName)
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      })
    })
  }
)
