/**
 * A single piece of a prompt template: literal text or a reference to a
 * connected graph variable.
 */
export type PromptSegment =
  | { type: 'text'; value: string }
  | { type: 'var'; name: string }

/** An ordered list of segments forming an editable prompt. */
export type PromptTemplate = PromptSegment[]
