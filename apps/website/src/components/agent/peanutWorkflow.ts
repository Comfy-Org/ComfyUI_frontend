import { peanutWorkflowWires } from './peanutWorkflowWires'
import type { WorkflowGraphNode } from './workflowGraph'
import type { MotionWorkflow } from './workflowMotion'

// Keep the original Figma assets, with room for the two generation steps.
const nodes: WorkflowGraphNode[] = [
  {
    id: 'reference',
    label: 'Reference',
    kind: 'reference',
    x: 14,
    y: 133,
    width: 239,
    height: 260,
    image: 'peanut-reference.png',
    alt: 'Original peanut butter jar with a white lid',
    output: { x: 239, y: 146 },
    clickPoint: { x: 130, y: 146 }
  },
  {
    id: 'variations',
    label: 'Generate previews',
    kind: 'prompt',
    x: 278,
    y: 132,
    width: 250,
    height: 139,
    text: 'Generate 3 different shapes of peanut butter jar',
    typingDuration: 0.7,
    input: { x: 292, y: 153 },
    output: { x: 517, y: 157 },
    clickPoint: { x: 360, y: 153 }
  },
  {
    id: 'preview1',
    label: 'Preview 1',
    kind: 'preview',
    x: 556,
    y: 48,
    width: 160.523,
    height: 174,
    image: 'peanut-preview-1.png',
    alt: 'First variation: a clear jar with a wooden lid',
    input: { x: 565, y: 57 },
    output: { x: 705, y: 57 },
    clickPoint: { x: 579, y: 57 },
    selectionPoint: { x: 660, y: 155 }
  },
  {
    id: 'preview2',
    label: 'Preview 2',
    kind: 'preview',
    x: 556,
    y: 276,
    width: 160.523,
    height: 174,
    image: 'peanut-preview-2.png',
    alt: 'Second variation: a rounded bottle with a narrow neck',
    input: { x: 565, y: 285 },
    clickPoint: { x: 579, y: 285 }
  },
  {
    id: 'preview3',
    label: 'Preview 3',
    kind: 'preview',
    x: 733.5,
    y: 168,
    width: 160.523,
    height: 174,
    image: 'peanut-preview-3.png',
    alt: 'Third variation: a tapered jar with a wide base',
    input: { x: 742.5, y: 178 },
    clickPoint: { x: 756.5, y: 178 }
  },
  {
    id: 'generate',
    label: 'Generate',
    kind: 'prompt',
    x: 918,
    y: 85,
    width: 309,
    height: 139,
    text: 'Stage Preview 1 as a product ad. Silk backdrop, falling peanuts, spoon in the foreground.',
    typingDuration: 0.85,
    input: { x: 932, y: 106 },
    output: { x: 1216, y: 110 },
    clickPoint: { x: 1012, y: 106 }
  },
  {
    id: 'final',
    label: 'Final output',
    kind: 'result',
    x: 1257,
    y: 74,
    width: 284,
    height: 313,
    image: 'peanut-final.png',
    alt: 'Peanut butter product ad with a silk backdrop, falling peanuts, and a spoon in the foreground',
    input: { x: 1272, y: 96 },
    clickPoint: { x: 1338, y: 96 }
  }
]

export const peanutWorkflow = {
  id: 'peanut',
  nodes,
  edges: peanutWorkflowWires,
  steps: [
    {
      type: 'place',
      node: 'reference',
      actor: 'user',
      from: { x: 14, y: 35 },
      duration: 0.9
    },
    { type: 'pause', duration: 0.2 },
    { type: 'place', node: 'variations', actor: 'agent', duration: 0.5 },
    { type: 'connect', from: 'reference', to: 'variations' },
    { type: 'type', node: 'variations' },
    { type: 'show', nodes: ['preview1', 'preview2', 'preview3'] },
    { type: 'connect', from: 'variations', to: 'preview1' },
    { type: 'connect', from: 'variations', to: 'preview2' },
    { type: 'connect', from: 'variations', to: 'preview3' },
    {
      type: 'images',
      nodes: ['preview1', 'preview2', 'preview3'],
      delay: 0.45
    },
    { type: 'pause', duration: 0.5 },
    { type: 'select', node: 'preview1' },
    { type: 'place', node: 'generate', actor: 'agent', duration: 0.5 },
    { type: 'connect', from: 'preview1', to: 'generate' },
    { type: 'type', node: 'generate' },
    { type: 'place', node: 'final', actor: 'agent', duration: 0.5 },
    { type: 'connect', from: 'generate', to: 'final' },
    { type: 'images', nodes: ['final'], delay: 0.4 }
  ]
} satisfies MotionWorkflow
