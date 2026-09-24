import type { MotionEdge } from './workflowMotion'

// These curves also guide the agent cursor while each connection is drawn.
export const peanutWorkflowWires: MotionEdge[] = [
  {
    from: 'reference',
    to: 'variations',
    curves: [
      {
        from: { x: 239, y: 146 },
        control1: { x: 260, y: 146 },
        control2: { x: 270, y: 153 },
        to: { x: 292, y: 153 }
      }
    ]
  },
  {
    from: 'variations',
    to: 'preview1',
    curves: [
      {
        from: { x: 517, y: 157 },
        control1: { x: 540, y: 157 },
        control2: { x: 541, y: 57 },
        to: { x: 565, y: 57 }
      }
    ]
  },
  {
    from: 'variations',
    to: 'preview2',
    curves: [
      {
        from: { x: 517, y: 157 },
        control1: { x: 550, y: 157 },
        control2: { x: 540, y: 285 },
        to: { x: 565, y: 285 }
      }
    ]
  },
  {
    from: 'variations',
    to: 'preview3',
    curves: [
      {
        from: { x: 517, y: 157 },
        control1: { x: 540, y: 157 },
        control2: { x: 540, y: 245 },
        to: { x: 555, y: 245 }
      },
      {
        from: { x: 555, y: 245 },
        control1: { x: 610, y: 245 },
        control2: { x: 690, y: 245 },
        to: { x: 725, y: 245 }
      },
      {
        from: { x: 725, y: 245 },
        control1: { x: 735, y: 245 },
        control2: { x: 728, y: 178 },
        to: { x: 742.5, y: 178 }
      }
    ]
  },
  {
    from: 'preview1',
    to: 'generate',
    curves: [
      {
        from: { x: 705, y: 57 },
        control1: { x: 782, y: 57 },
        control2: { x: 845, y: 106 },
        to: { x: 932, y: 106 }
      }
    ]
  },
  {
    from: 'generate',
    to: 'final',
    curves: [
      {
        from: { x: 1216, y: 110 },
        control1: { x: 1232, y: 110 },
        control2: { x: 1248, y: 96 },
        to: { x: 1272, y: 96 }
      }
    ]
  }
]
