import type { WorkflowGraph, WorkflowGraphNode } from './workflowGraph'
import type { MotionEdge, Point } from './workflowMotion'

export const productWorkflowSize = { width: 1739, height: 599 }
export const productWorkflowHoldDuration = 10
export const productWorkflowUserRest = { x: 24, y: 67 }
export const productWorkflowAgentRest = { x: 1638, y: 521 }

const variants = [
  { id: 'white', label: 'White' },
  { id: 'gold', label: 'Gold' },
  { id: 'purple', label: 'Purple' }
]

const nodes: WorkflowGraphNode[] = [
  {
    id: 'base',
    label: 'Base scene',
    kind: 'landscape',
    x: 6,
    y: 144.1,
    width: 200,
    height: 146.19,
    image: 'conditioner/base-scene.webp',
    alt: 'Grayscale bottle scene with pillars and floating particle spheres',
    output: { x: 205.17, y: 163.45 },
    clickPoint: { x: 106, y: 217.2 }
  },
  {
    id: 'products',
    label: 'Product references',
    kind: 'products',
    x: 2,
    y: 315,
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
    output: { x: 241, y: 334 },
    clickPoint: { x: 122, y: 370 }
  },
  {
    id: 'keygen',
    label: 'Generate images',
    kind: 'processor',
    x: 284,
    y: 236,
    width: 174,
    height: 126,
    text: 'Create 3 product scenes from the base composition and bottle references.',
    input: { x: 283.05, y: 259 },
    output: { x: 459.91, y: 258 },
    clickPoint: { x: 371, y: 299 }
  },
  {
    id: 'keyframe-white',
    label: 'White keyframe',
    kind: 'landscape',
    x: 512,
    y: 75.56,
    width: 204,
    height: 148.44,
    image: 'conditioner/keyframe-white.webp',
    alt: 'Generated product scene for the white conditioner bottle',
    input: { x: 512, y: 91.56 },
    output: { x: 716, y: 91.56 },
    clickPoint: { x: 614, y: 91.56 },
    selectionPoint: { x: 614, y: 149.78 }
  },
  {
    id: 'keyframe-gold',
    label: 'Gold keyframe',
    kind: 'landscape',
    x: 510,
    y: 245.03,
    width: 204,
    height: 148.44,
    image: 'conditioner/keyframe-gold.webp',
    alt: 'Generated product scene for the gold conditioner bottle',
    input: { x: 510, y: 261.03 },
    output: { x: 714, y: 261.03 },
    clickPoint: { x: 612, y: 261.03 },
    selectionPoint: { x: 612, y: 319.25 }
  },
  {
    id: 'keyframe-purple',
    label: 'Purple keyframe',
    kind: 'landscape',
    x: 512,
    y: 416,
    width: 204,
    height: 148.44,
    image: 'conditioner/keyframe-purple.webp',
    alt: 'Generated product scene for the purple conditioner bottle',
    input: { x: 512, y: 432 },
    output: { x: 716, y: 432 },
    clickPoint: { x: 614, y: 432 },
    selectionPoint: { x: 614, y: 490.22 }
  },
  {
    id: 'motionref',
    label: 'Motion reference',
    kind: 'landscape',
    x: 749,
    y: 170.59,
    width: 199,
    height: 145.63,
    video: 'conditioner/motion-reference.mp4',
    loopVideo: true,
    poster: 'conditioner/motion-reference-poster.webp',
    alt: 'Grayscale bottle animation used as the motion reference',
    output: { x: 948, y: 195.03 },
    clickPoint: { x: 848.5, y: 243.41 }
  },
  {
    id: 'videogen',
    label: 'Generate video',
    kind: 'processor',
    x: 998,
    y: 319.03,
    width: 152,
    height: 119,
    text: 'Use the motion reference and keyframe to render a video ad.',
    input: { x: 1000.38, y: 340.03 },
    output: { x: 1151.58, y: 340.03 },
    clickPoint: { x: 1074, y: 378.53 }
  },
  {
    id: 'result-purple',
    label: 'Final output',
    kind: 'featured',
    x: 1198,
    y: 148.59,
    width: 540,
    height: 337.44,
    video: 'conditioner/result-purple.mp4',
    loopVideo: true,
    poster: 'conditioner/keyframe-purple.webp',
    alt: 'Final purple fig conditioner video ad',
    input: { x: 1206.1, y: 176.22 },
    clickPoint: { x: 1468, y: 317.32 }
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
    connection('base', 'keygen', 263.5),
    connection('products', 'keygen', 275.5),
    connection('keygen', 'keyframe-white', 500),
    connection('keygen', 'keyframe-gold', 519),
    connection('keygen', 'keyframe-purple', 497),
    connection('keyframe-purple', 'videogen', {
      control1: { x: 872.19, y: 432 },
      control2: { x: 868.19, y: 340.03 }
    }),
    connection('motionref', 'videogen', {
      control1: { x: 986, y: 214.03 },
      control2: { x: 964.38, y: 330.03 }
    }),
    connection('videogen', 'result-purple', 1174.5)
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
