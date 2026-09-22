import type { WorkflowGraph, WorkflowGraphNode } from './workflowGraph'
import type { MotionEdge, Point } from './workflowMotion'

export const productWorkflowSize = { width: 1739, height: 599 }
export const productWorkflowHoldDuration = 60
export const productWorkflowUserRest = { x: 92, y: 41 }
export const productWorkflowAgentRest = { x: 1548, y: 512 }

const variants = [
  { id: 'white', label: 'White', y: 48.56 },
  { id: 'gold', label: 'Gold', y: 225.03 },
  { id: 'purple', label: 'Purple', y: 405 }
]

const nodes: WorkflowGraphNode[] = [
  {
    id: 'base',
    label: 'Base scene',
    kind: 'landscape',
    x: 24,
    y: 146.1,
    width: 240,
    height: 168.69,
    image: 'conditioner/base-scene.webp',
    alt: 'Grayscale bottle scene with pillars and floating particle spheres',
    output: { x: 264, y: 230.45 },
    clickPoint: { x: 144, y: 230.45 }
  },
  {
    id: 'products',
    label: 'Product references',
    kind: 'products',
    x: 24,
    y: 350,
    width: 240,
    height: 110,
    images: [
      {
        src: 'conditioner/bottle-purple.webp',
        alt: 'Purple conditioner bottle'
      },
      { src: 'conditioner/bottle-gold.webp', alt: 'Gold conditioner bottle' },
      { src: 'conditioner/bottle-white.webp', alt: 'White conditioner bottle' }
    ],
    output: { x: 264, y: 405 },
    clickPoint: { x: 144, y: 405 }
  },
  {
    id: 'keygen',
    label: 'Generate keyframes',
    kind: 'processor',
    x: 309,
    y: 197,
    width: 183,
    height: 126,
    text: 'Create three product scenes from the base composition and bottle references.',
    input: { x: 309, y: 260 },
    output: { x: 492, y: 260 },
    clickPoint: { x: 400.5, y: 260 }
  },
  ...variants.map<WorkflowGraphNode>((variant) => ({
    id: `keyframe-${variant.id}`,
    label: `${variant.label} keyframe`,
    kind: 'landscape',
    x: 546,
    y: variant.y,
    width: 204,
    height: 148.44,
    image: `conditioner/keyframe-${variant.id}.webp`,
    alt: `Generated product scene for the ${variant.id} conditioner bottle`,
    input: { x: 546, y: variant.y + 16 },
    output: { x: 750, y: variant.y + 16 },
    clickPoint: { x: 648, y: variant.y + 16 },
    selectionPoint: { x: 648, y: variant.y + 74.22 }
  })),
  {
    id: 'motionref',
    label: 'Motion reference',
    kind: 'landscape',
    x: 776,
    y: 162.59,
    width: 219,
    height: 156.88,
    video: 'conditioner/motion-reference.mp4',
    loopVideo: true,
    poster: 'conditioner/motion-reference-poster.webp',
    alt: 'Grayscale bottle animation used as the motion reference',
    output: { x: 995, y: 241.03 },
    clickPoint: { x: 885.5, y: 241.03 }
  },
  {
    id: 'videogen',
    label: 'Generate video',
    kind: 'processor',
    x: 1044,
    y: 245.03,
    width: 192,
    height: 130,
    text: 'Use the reference video to create a stylish video ad.',
    input: { x: 1044, y: 310.03 },
    output: { x: 1236, y: 310.03 },
    clickPoint: { x: 1140, y: 310.03 }
  },
  {
    id: 'result-purple',
    label: 'Final output',
    kind: 'featured',
    x: 1267,
    y: 146.59,
    width: 448,
    height: 285.69,
    video: 'conditioner/result-purple.mp4',
    loopVideo: true,
    poster: 'conditioner/keyframe-purple.webp',
    alt: 'Final purple fig conditioner video ad',
    input: { x: 1267, y: 289.44 },
    clickPoint: { x: 1491, y: 289.44 }
  }
]

function connection(
  from: string,
  to: string,
  bend: number | { control1: Point; control2: Point },
  input?: Point
): MotionEdge {
  const source = nodes.find((node) => node.id === from)?.output
  const target = input ?? nodes.find((node) => node.id === to)?.input
  if (!source || !target)
    throw new Error(`Missing workflow port: ${from} → ${to}`)
  return {
    from,
    to,
    curves: [
      {
        from: source,
        ...(typeof bend === 'number'
          ? {
              control1: { x: bend, y: source.y },
              control2: { x: bend, y: target.y }
            }
          : bend),
        to: target
      }
    ]
  }
}

export const productWorkflow: WorkflowGraph = {
  id: 'conditioner',
  nodes,
  edges: [
    connection('base', 'keygen', 286.5),
    connection('products', 'keygen', 286.5),
    ...variants.map((variant) =>
      connection('keygen', `keyframe-${variant.id}`, 519)
    ),
    connection('keyframe-purple', 'videogen', {
      control1: { x: 888, y: 391 },
      control2: { x: 936, y: 378.03 }
    }),
    connection('motionref', 'videogen', {
      control1: { x: 1015, y: 288.03 },
      control2: { x: 1029, y: 277.03 }
    }),
    connection('videogen', 'result-purple', 1251.5)
  ],
  steps: [
    {
      type: 'place',
      node: 'base',
      actor: 'user',
      duration: 0.4
    },
    {
      type: 'place',
      node: 'products',
      actor: 'user',
      duration: 0.4
    },
    { type: 'pause', duration: 0.2 },
    { type: 'place', node: 'keygen', actor: 'agent', duration: 0.4 },
    { type: 'connect', from: 'base', to: 'keygen' },
    { type: 'connect', from: 'products', to: 'keygen' },
    {
      type: 'show',
      nodes: variants.map((variant) => `keyframe-${variant.id}`)
    },
    {
      type: 'connect-group',
      from: 'keygen',
      to: variants.map((variant) => `keyframe-${variant.id}`)
    },
    {
      type: 'images',
      nodes: variants.map((variant) => `keyframe-${variant.id}`),
      delay: 0.45
    },
    { type: 'pause', duration: 0.5 },
    { type: 'select', node: 'keyframe-purple' },
    {
      type: 'place',
      node: 'motionref',
      actor: 'user',
      duration: 0.4
    },
    { type: 'place', node: 'videogen', actor: 'agent', duration: 0.4 },
    { type: 'connect', from: 'keyframe-purple', to: 'videogen' },
    { type: 'connect', from: 'motionref', to: 'videogen' },
    { type: 'show', nodes: ['result-purple'] },
    { type: 'connect', from: 'videogen', to: 'result-purple' },
    { type: 'images', nodes: ['result-purple'], delay: 0.45 }
  ]
}
