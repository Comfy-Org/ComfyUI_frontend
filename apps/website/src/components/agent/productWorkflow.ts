import type { WorkflowGraph, WorkflowGraphNode } from './workflowGraph'

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
    x: 30,
    y: 155,
    width: 260,
    height: 180,
    image: 'conditioner/base-scene.webp',
    alt: 'Grayscale bottle scene with pillars and floating particle spheres',
    output: { x: 276, y: 182.27 },
    clickPoint: { x: 160.0, y: 245.0 }
  },
  {
    id: 'products',
    label: 'Product references',
    kind: 'products',
    x: 30,
    y: 365,
    width: 260,
    height: 150,
    images: [
      {
        src: 'conditioner/bottle-purple.webp',
        alt: 'Purple conditioner bottle'
      },
      { src: 'conditioner/bottle-gold.webp', alt: 'Gold conditioner bottle' },
      { src: 'conditioner/bottle-white.webp', alt: 'White conditioner bottle' }
    ],
    output: { x: 276, y: 385.2 },
    clickPoint: { x: 160.0, y: 440.0 }
  },
  {
    id: 'keygen',
    label: 'Generate images',
    kind: 'processor',
    x: 335,
    y: 285,
    width: 240,
    height: 150,
    text: 'Create 3 product scenes from the base composition and bottle references.',
    input: { x: 349, y: 305.2 },
    output: { x: 561, y: 305.2 },
    clickPoint: { x: 455.0, y: 360.0 }
  },
  {
    id: 'keyframe-white',
    label: 'White keyframe',
    kind: 'landscape',
    x: 625,
    y: 40,
    width: 260,
    height: 180,
    image: 'conditioner/keyframe-white.webp',
    alt: 'Generated product scene for the white conditioner bottle',
    input: { x: 651.26, y: 67.27 },
    output: { x: 871, y: 67.27 },
    clickPoint: { x: 755.0, y: 130.0 },
    selectionPoint: { x: 755.0, y: 130.0 }
  },
  {
    id: 'keyframe-gold',
    label: 'Gold keyframe',
    kind: 'landscape',
    x: 625,
    y: 250,
    width: 260,
    height: 180,
    image: 'conditioner/keyframe-gold.webp',
    alt: 'Generated product scene for the gold conditioner bottle',
    input: { x: 651.26, y: 277.27 },
    output: { x: 871, y: 277.27 },
    clickPoint: { x: 755.0, y: 340.0 },
    selectionPoint: { x: 755.0, y: 340.0 }
  },
  {
    id: 'keyframe-purple',
    label: 'Purple keyframe',
    kind: 'landscape',
    x: 625,
    y: 460,
    width: 260,
    height: 180,
    image: 'conditioner/keyframe-purple.webp',
    alt: 'Generated product scene for the purple conditioner bottle',
    input: { x: 651.26, y: 487.27 },
    output: { x: 871, y: 487.27 },
    clickPoint: { x: 755.0, y: 550.0 },
    selectionPoint: { x: 755.0, y: 550.0 }
  },
  {
    id: 'motionref',
    label: 'Motion reference',
    kind: 'landscape',
    x: 945,
    y: 145,
    width: 260,
    height: 180,
    video: 'conditioner/motion-reference.mp4',
    loopVideo: true,
    poster: 'conditioner/motion-reference-poster.webp',
    alt: 'Grayscale bottle animation used as the motion reference',
    output: { x: 1191, y: 172.27 },
    clickPoint: { x: 1075.0, y: 235.0 }
  },
  {
    id: 'videogen',
    label: 'Generate video',
    kind: 'processor',
    x: 1255,
    y: 355,
    width: 240,
    height: 150,
    text: 'Use the motion reference and keyframe to render a video ad.',
    input: { x: 1269, y: 375.2 },
    output: { x: 1481, y: 375.2 },
    clickPoint: { x: 1375.0, y: 430.0 }
  },
  {
    id: 'result-purple',
    label: 'Final output',
    kind: 'featured',
    x: 1545,
    y: 180,
    width: 450,
    height: 300,
    video: 'conditioner/result-purple.mp4',
    loopVideo: true,
    poster: 'conditioner/keyframe-purple.webp',
    alt: 'Final purple fig conditioner video ad',
    input: { x: 1571.26, y: 207.27 },
    clickPoint: { x: 1770.0, y: 330.0 }
  }
]

export const productWorkflow: WorkflowGraph = {
  id: 'conditioner',
  width: 2020,
  height: 680,
  holdDuration: 16,
  userRest: { x: 35, y: 85 },
  agentRest: { x: 1700, y: 545 },
  nodes,
  edges: [
    { from: 'base', to: 'keygen' },
    { from: 'products', to: 'keygen' },
    { from: 'keygen', to: 'keyframe-white' },
    { from: 'keygen', to: 'keyframe-gold' },
    { from: 'keygen', to: 'keyframe-purple' },
    { from: 'keyframe-purple', to: 'videogen' },
    { from: 'motionref', to: 'videogen' },
    { from: 'videogen', to: 'result-purple' }
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
    { type: 'select', node: 'keyframe-purple', returnToRest: false },
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
