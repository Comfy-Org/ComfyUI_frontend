# DEMO nodes

The devtools custom-node pack includes two small frontend-only nodes built only
with the published API. Together they form an executable example of definition
registration and prompt-time resolution.

| Node                 | Behavior                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| `DEMO Constant Text` | Stores a string in the workflow and supplies it as a literal at run time. |
| `DEMO Reroute`       | Forwards its input source and does not appear in the backend prompt.      |

Both nodes are ordinary workflow entities: they can be connected, duplicated,
saved, and restored. They use `execution: 'frontend'`, so the backend never
needs a Python class named `DEMO/ConstantText` or `DEMO/Reroute`.

## Install the demos

The definitions live in
[`tools/devtools/web/stableApiDemo.js`](../../tools/devtools/web/stableApiDemo.js).
Install the repository's devtools pack into a local ComfyUI checkout:

```sh
mkdir -p /path/to/ComfyUI/custom_nodes/ComfyUI_devtools
cp -r tools/devtools/* /path/to/ComfyUI/custom_nodes/ComfyUI_devtools/
```

Restart ComfyUI, then search the node library for `DEMO`. The demo module pins
itself to API major 2 with `comfy.forMajor(2)` and requires the capabilities it
uses before registering either type.

## Run the example

1. Add `DEMO Constant Text`, `DEMO Reroute`, and `Preview as Text`.
2. Connect constant `text` to reroute `in`.
3. Connect reroute `out` to preview `source`.
4. Change the constant's `value`, then run the workflow.

`Preview as Text` displays the value. The API prompt contains only the backend
preview node, with the resolved string as its `source` input. The two DEMO nodes
remain in the saved workflow but are intentionally absent from the prompt.

The checked-in workflow at
[`browser_tests/assets/nodeApi/stable-api-demo.json`](../../browser_tests/assets/nodeApi/stable-api-demo.json)
is the same graph used by the browser test.

For broader, installable examples of widgets, graph interaction, execution,
backend services, and settings, see the
[How-To node packs](../../examples/node-api/README.md).

## How the definitions work

`DEMO Constant Text` resolves its output to a literal:

```js
resolve: ({ self }) => ({
  text: { literal: String(self.widgetValue('value') ?? '') }
})
```

`DEMO Reroute` resolves its output to its input, or omits the output when it is
not connected:

```js
resolve: ({ self }) => {
  const input = self.input('in')
  return { out: input ? { forwardTo: input } : { omit: true } }
}
```

Resolvers are pure and synchronous. They describe what an output means; they
do not edit links, remove nodes, or mutate a prompt draft. See
[Execution and resolution](./execution.md) for the complete contract.
