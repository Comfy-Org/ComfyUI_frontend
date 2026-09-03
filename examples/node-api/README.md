# Published node API examples

These installable custom-node packs demonstrate one published frontend API
idea at a time. They import only `/comfy/api/v2.js`; none of their frontend
code imports ComfyUI source files, patches generated node classes, or reaches
through the legacy `app` global.

| Pack                       | Focus                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `how_to_frontend_nodes`    | frontend-only nodes, literals, reroutes, suppliers, dynamic slots |
| `how_to_widgets`           | widget events, canvas and DOM widgets, custom widget types        |
| `how_to_graph_interaction` | badges, menus, lifecycle, file drops, graph mutation              |
| `how_to_execution`         | queueing, results, mask editor, backend routes/events, storage    |

## Install

Copy each pack you want into the backend's `custom_nodes` directory:

```sh
cp -R examples/node-api/how_to_* /path/to/ComfyUI/custom_nodes/
```

Restart ComfyUI and search the node library for `API Examples`. Each pack has
its own README with a short exercise and the API features it demonstrates.

The repository's `pnpm container:start` command mounts all four packs for local
browser testing. `browser_tests/tests/nodeApi/howToExamples.spec.ts` exercises
registration, prompt resolution, widget events, backend calls/events, graph
batching, undo, and a real backend run.

The examples target API major 2 explicitly. They call `require()` for every
capability central to the example so an older frontend fails with an actionable
message instead of silently losing behavior.
