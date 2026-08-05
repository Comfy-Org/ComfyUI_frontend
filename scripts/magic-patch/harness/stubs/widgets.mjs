/**
 * `scripts/widgets.js` — what the *unconverted* pack uses to create widgets.
 *
 * Backed by the same `addWidget` the real factories use, so the original run
 * produces a comparable node rather than a hollow one; a stub that created
 * nothing would make every conversion look like it dropped widgets.
 */
const make = (type) => (node, name, inputData) => {
  const options = inputData?.[1] ?? {}
  const resolved = type === 'string' && options.multiline ? 'textarea' : type
  const widget = node.addWidget(resolved, name, options.default ?? '', null, {
    ...options
  })
  // Packs reach for `inputEl` to fake read-only; give them something inert
  // rather than letting the assignment throw.
  widget.inputEl = { style: {}, readOnly: false, value: '' }
  return { widget }
}

export const ComfyWidgets = {
  INT: make('number'),
  FLOAT: make('number'),
  BOOLEAN: make('toggle'),
  STRING: make('string'),
  MARKDOWN: make('markdown'),
  COMBO: make('combo'),
  COLOR: make('color'),
  IMAGEUPLOAD: make('fileupload'),
  TEXTAREA: make('textarea')
}

export default { ComfyWidgets }
