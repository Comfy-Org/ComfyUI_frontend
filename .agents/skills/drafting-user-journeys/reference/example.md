# Worked example: PR #21612 (Tidy up)

PR #21612 in Comfy-Org/ComfyUI_frontend replaced Arrange with **Tidy up** and a
gap slider with draggable gap handles. Its "User journeys" section is the model
for the format. Its steps follow [`user-journeys.md`](user-journeys.md).

## Coverage table (excerpt)

| Behavior                                                              | Journey                                         |
| --------------------------------------------------------------------- | ----------------------------------------------- |
| Shift+Right Arrow on a gap handle widens the gap one step             | Adjust a narrow gap and reconnect the nodes     |
| Escape during a handle drag restores the previous gap                 | Adjust a narrow gap and reconnect the nodes     |
| Slots beside a narrow gap handle still accept links (classic and Vue) | Adjust a narrow gap and reconnect the nodes     |
| Enclosed reroutes move with the layout; others stay                   | Tidy nodes with reroutes, then cancel and undo  |
| One Undo reverses a whole held-arrow edit                             | Cancel a gap preview and undo a held-arrow edit |

## Journey

```markdown
<details>
<summary>Adjust a narrow gap and reconnect the nodes</summary>

Starts from: the default workflow with **VAE Decode** and **Save Image** side by side and the link between them removed; selection toolbox on; classic and Vue nodes.

1. Select **VAE Decode** and **Save Image**, then click **Tidy up**.
2. Set the gap to zero with **Home** on the slider. Focus the gap handle and press **Shift+Right Arrow** to widen it.
3. Drag the handle, then press **Escape** before releasing. The gap returns to its previous width.
4. Widen the gap one more keyboard step and connect the output to the input. Both ports remain usable next to the handle.

</details>
```

Steps chain cancel, keyboard input, and a renderer-sensitive connection into
one session a user would perform. Expected results sit on the step where they
show.

## Playwright outline

Extends `browser_tests/tests/selectionToolbox.spec.ts`, which already opens
the selection toolbox.

```text
describe 'Connections beside gap handles'
  test.use initialSettings: Comfy.Canvas.SelectionToolbox true
  for renderer of classic, vue (vue adds @vue-nodes)
    test 'connects slots beside a narrow gap in <renderer>'
      loadWorkflow('default', overrides placing nodes 8 and 9 side by side and removing their link)
      assert input and output each have link count 0
      test.step 'Select VAE Decode and Save Image, then click Tidy up'
        nodeOps.selectNodes(['VAE Decode', 'Save Image']); click button 'Tidy up'
      test.step 'Set the gap to zero, then widen it with Shift+Right Arrow'
        press Home on slider 'Gap between nodes'
        press Shift+ArrowRight on spinbutton 'Gap between nodes'
        assert aria-valuenow is 10
      test.step 'Drag the handle and press Escape before releasing'
        comfyMouse drag the handle; press Escape; drop
        assert aria-valuenow is 10 again
      test.step 'Widen one more step and connect the output to the input'
        press Shift+ArrowRight
        assert aria-valuenow is 20
        connect output 0 to input 0 (vueNodes slot dots, or comfyMouse.dragAndDrop on canvas)
        assert input and output each have link count 1
```

Each expected result in the journey became one assertion on something the
user can see or reach: the handle's value and the link. The journey starts
with the ports unlinked, so the final link count fails when the connect
gesture does.
