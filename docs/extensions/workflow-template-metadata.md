# Extension workflow template metadata

Custom node packs can add an optional `index.json` beside their workflow JSON files in an `example_workflows`, `examples`, `example`, `workflow`, or `workflows` directory. This filename is reserved for metadata and is not listed as a workflow. The object keys are workflow filenames without the `.json` suffix.

```json
{
  "local_image_workflow": {
    "title": "Local image workflow",
    "description": "Generate an image with locally loaded models.",
    "openSource": true,
    "models": ["Flux"],
    "tags": ["text-to-image"]
  },
  "hosted_video_workflow": {
    "title": "Hosted video workflow",
    "description": "Generate a clip with a hosted API model.",
    "openSource": false,
    "models": ["Example Video Model"],
    "tags": ["text-to-video"]
  }
}
```

All metadata fields are optional. `openSource: false` marks a template as using an external or remote API; `true` or an omitted value treats it as running on ComfyUI. `models` and `tags` populate the corresponding template filters. Packs without an index continue to use each workflow filename as its title and description. Invalid index data is ignored, so it does not prevent workflows from loading.
