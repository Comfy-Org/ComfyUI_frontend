# How-To: widgets

This pack demonstrates the four widget ownership models:

- **Widget Events** uses ordinary declared widgets and additive `activate`
  listeners.
- **Canvas Meter** draws with host theme colors and handles pointer input in a
  renderer-neutral canvas widget.
- **Mounted Slider** mounts an accessible DOM range control and tears down all
  retained listeners.
- **Custom Rating Widget** uses `defs.defineWidgetType()` for a type declared by
  the Python node.
- **Prompt Serialization** expands ComfyUI text tokens only in the prompt; the
  saved workflow keeps the original template.
- **Text Interaction** observes a host-owned multiline editor and handles
  Ctrl/Cmd+Enter without reaching for its DOM element.

Connect an output to a compatible backend node to inspect the resolved value.
For Prompt Serialization, save the workflow before queueing and compare the
saved template with the backend input.
