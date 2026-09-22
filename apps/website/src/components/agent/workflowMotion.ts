export type Point = { x: number; y: number }
export type MotionNode = Point & {
  id: string
  width: number
  text?: string
  typingDuration?: number
  // All ports and cursor targets use absolute canvas coordinates.
  input?: Point
  output?: Point
  clickPoint?: Point
  selectionPoint?: Point
}
export type MotionCurve = {
  from: Point
  control1: Point
  control2: Point
  to: Point
}
export type MotionEdge = { from: string; to: string; curves?: MotionCurve[] }
export type MotionStep =
  | {
      type: 'place'
      node: string
      actor: 'user' | 'agent'
      from?: Point
      duration?: number
    }
  | { type: 'show'; nodes: string[] }
  | { type: 'connect'; from: string; to: string }
  | { type: 'connect-group'; from: string; to: string[] }
  | { type: 'type'; node: string }
  | { type: 'prompt'; node: string }
  | { type: 'images'; nodes: string[]; delay?: number }
  | { type: 'select'; node: string }
  | {
      type: 'focus'
      node: string
      offset: Point
      scale: number
      duration?: number
    }
  | { type: 'pause'; duration: number }
export type MotionWorkflow = {
  id: string
  nodes: MotionNode[]
  edges: MotionEdge[]
  steps: MotionStep[]
}
type MotionOptions = {
  width?: number
  holdDuration?: number
  connectionSpeed?: number
  agentRest?: Point
  userRest?: Point
}
type MotionEvent = MotionStep & {
  start: number
  end: number
  dropAt?: number
  drawStart?: number
  drawEnd?: number
  typingStart?: number
  typingEnd?: number
  promptAt?: number
  imagesAt?: number
  selectionAt?: number
}
type StepOf<T extends MotionStep['type']> = Extract<MotionStep, { type: T }>
type Frame = { time: number; value: string }
type NodeState = {
  node: MotionNode
  frames: Frame[]
  shownAt?: number
  imageAt?: number
  selectionAt?: number
  characterTimes?: number[]
  promptAt?: number
}
type CursorState = {
  point: Point
  rest: Point
  visible: boolean
  frames: Frame[]
}
const portY = 19.2
// Preserve the requested connection speed from the original animation.
const dragDuration = 1.35 / 1.3 / 1.15
const entranceDuration = 0.25
const hiddenNode = 'opacity:1;transform:translate(0,0) scale(0);'
const shownNode = 'opacity:1;transform:translate(0,0) scale(1);'

function edgeCurves(
  edge: MotionEdge,
  source: MotionNode,
  target: MotionNode
): MotionCurve[] {
  if (edge.curves?.length) return edge.curves
  const from = source.output ?? {
    x: source.x + source.width,
    y: source.y + portY
  }
  const to = target.input ?? { x: target.x, y: target.y + portY }
  const bend = Math.max(20, (to.x - from.x) * 0.5)
  return [
    {
      from,
      control1: { x: from.x + bend, y: from.y },
      control2: { x: to.x - bend, y: to.y },
      to
    }
  ]
}

function sampleCurves(curves: MotionCurve[]): Point[] {
  const samples: Point[] = []
  for (const [curveIndex, curve] of curves.entries()) {
    const { from, control1, control2, to } = curve
    if (
      curveIndex > 0 &&
      Math.hypot(
        from.x - curves[curveIndex - 1].to.x,
        from.y - curves[curveIndex - 1].to.y
      ) > 0.001
    ) {
      throw new Error('Workflow wire curves must form a continuous path')
    }
    for (let index = curveIndex === 0 ? 0 : 1; index <= 60; index++) {
      const t = index / 60
      const u = 1 - t
      samples.push({
        x:
          u ** 3 * from.x +
          3 * u ** 2 * t * control1.x +
          3 * u * t ** 2 * control2.x +
          t ** 3 * to.x,
        y:
          u ** 3 * from.y +
          3 * u ** 2 * t * control1.y +
          3 * u * t ** 2 * control2.y +
          t ** 3 * to.y
      })
    }
  }
  return samples
}

function placementDuration(step: StepOf<'place'>) {
  const duration = step.duration ?? (step.from ? 0.8 : 0.4)
  if (!Number.isFinite(duration) || duration < 0.1)
    throw new Error('Workflow placement needs at least 0.1 seconds')
  return duration
}

function focusDuration(step: StepOf<'focus'>) {
  const duration = step.duration ?? 0.8
  const finite = [duration, step.scale, step.offset.x, step.offset.y].every(
    Number.isFinite
  )
  if (!finite || duration < 0.1 || step.scale <= 0)
    throw new Error(
      'Workflow focus needs finite offsets, a positive scale, and at least 0.1 seconds'
    )
  return duration
}

export function createWorkflowMotion(
  workflows: MotionWorkflow[],
  {
    width = 1600,
    holdDuration = 4,
    connectionSpeed = 2,
    agentRest = { x: width - 120, y: 24 },
    userRest = { x: 24, y: 24 }
  }: MotionOptions = {}
) {
  if (
    !workflows.length ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(holdDuration) ||
    holdDuration < 0 ||
    !Number.isFinite(connectionSpeed) ||
    connectionSpeed <= 0
  ) {
    throw new Error(
      'Workflow motion needs scenes, a positive width/speed, and a nonnegative hold'
    )
  }
  const position = (point: Point) =>
    `left:${(point.x / width) * 100}cqw;top:${(point.y / width) * 100}cqw;`
  const cursorValue = (point: Point, visible = true, scale = 1) =>
    `opacity:${visible ? 1 : 0};transform:scale(${scale});${position(point)}`
  const plans = workflows.map((workflow) => {
    const nodes: NodeState[] = workflow.nodes.map((node) => ({
      node,
      frames: [{ time: 0, value: hiddenNode }]
    }))
    const getNode = (id: string) => {
      const state = nodes.find(({ node }) => node.id === id)
      if (!state) throw new Error(`Missing workflow node: ${id}`)
      return state
    }
    const requireShown = (id: string, time: number) => {
      const state = getNode(id)
      if (state.shownAt === undefined || state.shownAt > time)
        throw new Error(`Workflow node must appear before use: ${id}`)
      return state
    }
    const wires = workflow.edges.map((edge) => {
      const curves = edgeCurves(
        edge,
        getNode(edge.from).node,
        getNode(edge.to).node
      )
      const samples = sampleCurves(curves)
      const distances = [0]
      for (let index = 1; index < samples.length; index++)
        distances.push(
          distances[index - 1] +
            Math.hypot(
              samples[index].x - samples[index - 1].x,
              samples[index].y - samples[index - 1].y
            )
        )
      const length = distances[distances.length - 1]
      if (!Number.isFinite(length) || length <= 0)
        throw new Error('Workflow wires need finite, nonzero lengths')
      return {
        edge,
        samples,
        distances,
        length,
        drawStart: undefined as number | undefined,
        drawEnd: undefined as number | undefined,
        path: `M ${samples[0].x} ${samples[0].y} ${curves.map(({ control1, control2, to }) => `C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${to.x} ${to.y}`).join(' ')}`
      }
    })
    const makeCursor = (rest: Point): CursorState => ({
      point: rest,
      rest,
      visible: false,
      frames: [{ time: 0, value: cursorValue(rest, false) }]
    })
    const cursors = {
      user: makeCursor(userRest),
      agent: makeCursor(agentRest)
    }
    const moveCursor = (
      cursor: CursorState,
      point: Point,
      start: number,
      duration: number
    ) => {
      cursor.frames.push({
        time: start,
        value: cursorValue(cursor.point, cursor.visible)
      })
      if (!cursor.visible)
        cursor.frames.push({
          time: start + 0.04,
          value: cursorValue(cursor.point)
        })
      cursor.frames.push({ time: start + duration, value: cursorValue(point) })
      cursor.point = point
      cursor.visible = true
    }
    const click = (cursor: CursorState, time: number) => {
      cursor.frames.push(
        { time, value: cursorValue(cursor.point) },
        { time: time + 0.07, value: cursorValue(cursor.point, true, 0.82) },
        { time: time + 0.18, value: cursorValue(cursor.point) }
      )
    }
    const reveal = (state: NodeState, start: number) => {
      if (state.shownAt !== undefined)
        throw new Error(`Workflow node was already placed: ${state.node.id}`)
      state.frames.push(
        {
          time: start,
          value: `${hiddenNode}animation-timing-function:ease-out;`
        },
        { time: start + entranceDuration, value: shownNode }
      )
      state.shownAt = start + entranceDuration
      return state.shownAt
    }
    const timeline: MotionEvent[] = []
    let focusAt: number | undefined
    let focusFadeDuration = 0
    let time = 0.15
    function carryNode(
      state: NodeState,
      origin: Point,
      point: Point,
      cursor: CursorState,
      duration: number
    ) {
      const node = state.node
      state.frames[0].value = 'opacity:0;transform:translate(0,0) scale(.96);'
      const from = {
        x: origin.x + point.x - node.x,
        y: origin.y + point.y - node.y
      }
      const translate = `translate(${((origin.x - node.x) / width) * 100}cqw,${((origin.y - node.y) / width) * 100}cqw) scale(1)`
      state.frames.push(
        { time, value: `opacity:0;transform:${translate};` },
        { time: time + 0.06, value: `opacity:1;transform:${translate};` },
        { time: time + duration, value: shownNode }
      )
      cursor.frames.push(
        { time, value: cursorValue(from, false) },
        { time: time + 0.06, value: cursorValue(from) },
        { time: time + duration, value: cursorValue(point) }
      )
      cursor.point = point
      cursor.visible = true
      time += duration
      state.shownAt = time
      return state.shownAt
    }

    function placeNode(step: StepOf<'place'>, event: MotionEvent) {
      const state = getNode(step.node)
      const node = state.node
      if (state.shownAt !== undefined)
        throw new Error(`Workflow node was already placed: ${node.id}`)
      const cursor = cursors[step.actor]
      const point = node.clickPoint ?? { x: node.x + 24, y: node.y + portY }
      const duration = placementDuration(step)
      let shownAt: number
      if (step.from) {
        shownAt = carryNode(state, step.from, point, cursor, duration)
      } else {
        moveCursor(cursor, point, time, duration)
        time += duration
        shownAt = reveal(state, time + 0.1)
      }
      event.dropAt = shownAt
      click(cursor, time)
      time = Math.max(time + 0.2, shownAt)
      if (step.actor === 'user') {
        moveCursor(cursor, cursor.rest, time, 0.2)
        time += 0.2
      }
    }

    function connectNodes(
      step: StepOf<'connect' | 'connect-group'>,
      event: MotionEvent
    ) {
      requireShown(step.from, time)
      const targets = step.type === 'connect' ? [step.to] : step.to
      if (!targets.length || new Set(targets).size !== targets.length)
        throw new Error('Workflow connections need distinct targets')
      const connections = targets.map((target) => {
        requireShown(target, time)
        const wire = wires.find(
          ({ edge }) => edge.from === step.from && edge.to === target
        )
        if (!wire)
          throw new Error(`Missing workflow wire: ${step.from} to ${target}`)
        if (wire.drawStart !== undefined)
          throw new Error('Workflow wires can only be connected once')
        return wire
      })
      const wire = connections[0]
      const source = wire.samples[0]
      if (
        connections.some(
          (connection) =>
            connection.samples[0].x !== source.x ||
            connection.samples[0].y !== source.y
        )
      )
        throw new Error(
          'Grouped workflow connections need a shared source port'
        )
      const cursor = cursors.agent
      moveCursor(cursor, source, time, 0.65 / 1.15 / connectionSpeed)
      time += 0.65 / 1.15 / connectionSpeed
      const drawEnd = time + dragDuration / connectionSpeed
      for (const connection of connections) {
        connection.drawStart = time
        connection.drawEnd = drawEnd
      }
      if (step.type === 'connect') {
        wire.samples.forEach((point, index) =>
          cursor.frames.push({
            time:
              time +
              ((wire.distances[index] / wire.length) * dragDuration) /
                connectionSpeed,
            value: cursorValue(point)
          })
        )
        cursor.point = wire.samples[wire.samples.length - 1]
      } else {
        cursor.frames.push({ time: drawEnd, value: cursorValue(source) })
      }
      event.drawStart = time
      event.drawEnd = drawEnd
      time = drawEnd + 0.35 / 1.15 / connectionSpeed
    }

    function revealText(step: StepOf<'type' | 'prompt'>, event: MotionEvent) {
      const state = requireShown(step.node, time)
      const { node } = state
      if (!node.text || state.characterTimes || state.promptAt !== undefined)
        throw new Error(`Workflow typing needs untyped text: ${node.id}`)
      const duration = node.typingDuration ?? 0.85
      if (!Number.isFinite(duration) || duration <= 0)
        throw new Error('Workflow typing duration must be positive')
      const cursor = cursors.agent
      moveCursor(
        cursor,
        { x: node.x + node.width - 12, y: node.y + 12 },
        time,
        0.18
      )
      time += 0.24
      if (step.type === 'type') {
        event.typingStart = time
        const characters = Array.from(node.text)
        state.characterTimes = characters.map(
          (_, index) => time + ((index + 1) / characters.length) * duration
        )
        time += duration
        event.typingEnd = time
      } else {
        state.promptAt = time
        event.promptAt = time
        time += 0.25
      }
      cursor.frames.push({ time, value: cursorValue(cursor.point) })
      time += 0.1
    }

    function revealImages(step: StepOf<'images'>, event: MotionEvent) {
      const delay = step.delay ?? 0.25
      if (!Number.isFinite(delay) || delay < 0)
        throw new Error('Workflow image delay must be nonnegative')
      const states = step.nodes.map((id) => requireShown(id, time))
      for (const state of states) {
        if (
          wires.some(
            ({ edge, drawEnd }) =>
              edge.to === state.node.id &&
              (drawEnd === undefined || drawEnd > time)
          )
        )
          throw new Error(
            `Workflow images must follow their connections: ${state.node.id}`
          )
        state.imageAt = time + delay
      }
      event.imagesAt = time + delay
      if (cursors.agent.visible)
        moveCursor(cursors.agent, cursors.agent.rest, time, 0.3)
      time += Math.max(delay + 0.2, 0.3)
    }

    function selectNode(step: StepOf<'select'>, event: MotionEvent) {
      const state = requireShown(step.node, time)
      if (state.imageAt === undefined || state.imageAt + 0.2 > time)
        throw new Error('Workflow selection needs a completed preview image')
      const node = state.node
      const point = node.selectionPoint ?? {
        x: node.x + node.width * 0.5,
        y: node.y + node.width * 0.5
      }
      moveCursor(cursors.user, point, time, 0.45)
      time += 0.45
      click(cursors.user, time)
      state.selectionAt = time + 0.07
      event.selectionAt = state.selectionAt
      time += 0.2
      moveCursor(cursors.user, cursors.user.rest, time, 0.25)
      time += 0.25
    }

    function focusNode(step: StepOf<'focus'>) {
      const state = requireShown(step.node, time)
      if (state.imageAt === undefined || state.imageAt + 0.2 > time)
        throw new Error('Workflow focus needs a completed image reveal')
      const duration = focusDuration(step)
      focusAt = time
      focusFadeDuration = Math.min(0.15, duration)
      state.frames = state.frames.map((frame) => ({
        ...frame,
        value: `${frame.value}z-index:0;`
      }))
      state.frames.push(
        { time: time - 0.001, value: `${shownNode}z-index:0;` },
        {
          time,
          value: `${shownNode}z-index:3;animation-timing-function:ease-in-out;`
        },
        {
          time: time + duration,
          value: `opacity:1;transform:translate(${(step.offset.x / width) * 100}cqw,${(step.offset.y / width) * 100}cqw) scale(${step.scale});z-index:3;`
        }
      )
      for (const other of nodes) {
        if (other === state || other.shownAt === undefined) continue
        other.frames.push(
          { time, value: shownNode },
          {
            time: time + focusFadeDuration,
            value: 'opacity:0.25;transform:translate(0,0) scale(1);'
          }
        )
      }
      for (const cursor of Object.values(cursors)) {
        cursor.frames.push(
          { time, value: cursorValue(cursor.point, cursor.visible) },
          {
            time: time + focusFadeDuration,
            value: cursorValue(cursor.point, false)
          }
        )
        cursor.visible = false
      }
      time += duration
    }

    function applyBuildStep(
      step: StepOf<'connect' | 'connect-group' | 'type' | 'prompt' | 'images'>,
      event: MotionEvent
    ) {
      if (step.type === 'connect' || step.type === 'connect-group') {
        connectNodes(step, event)
      } else if (step.type === 'type' || step.type === 'prompt') {
        revealText(step, event)
      } else {
        revealImages(step, event)
      }
    }

    function applyStep(step: MotionStep, event: MotionEvent) {
      switch (step.type) {
        case 'pause':
          if (!Number.isFinite(step.duration) || step.duration < 0)
            throw new Error('Workflow pauses must be nonnegative')
          time += step.duration
          break
        case 'place':
          placeNode(step, event)
          break
        case 'show':
          step.nodes.forEach((id) => reveal(getNode(id), time))
          time += entranceDuration + 0.03
          break
        case 'select':
          selectNode(step, event)
          break
        case 'focus':
          focusNode(step)
          break
        default:
          applyBuildStep(step, event)
      }
    }

    for (const step of workflow.steps) {
      if (focusAt !== undefined)
        throw new Error('Workflow focus must be the final step')
      const start = time
      const event: MotionEvent = { ...step, start, end: start }
      applyStep(step, event)
      event.end = time
      timeline.push(event)
    }
    const end = time + holdDuration
    return {
      workflow,
      nodes,
      wires,
      cursors,
      timeline,
      focusAt,
      focusFadeDuration,
      end,
      slot: end + 0.25
    }
  })
  const duration = plans.reduce((sum, plan) => sum + plan.slot, 0)
  const keyframes = (name: string, frames: Frame[]) => {
    const ordered = [
      ...new Map(frames.map((frame) => [frame.time, frame])).values()
    ].sort((a, b) => a.time - b.time)
    if (
      ordered.some(
        (frame) =>
          !Number.isFinite(frame.time) ||
          frame.time < 0 ||
          frame.time > duration ||
          /NaN|Infinity/.test(frame.value)
      )
    )
      throw new Error('Workflow keyframes must be finite and inside the loop')
    return `@keyframes ${name}{${ordered.map(({ time, value }) => `${((time / duration) * 100).toFixed(6)}%{${value}}`).join('')}}`
  }
  let offset = 0
  const scenes = plans.map((plan) => {
    const start = offset
    offset += plan.slot
    const end = start + plan.end
    const rules: string[] = []
    const closeFrames = (frames: Frame[], hidden: string) => [
      { time: 0, value: hidden },
      ...frames.map((frame) => ({ ...frame, time: frame.time + start })),
      { time: end, value: frames[frames.length - 1].value },
      { time: end + 0.15, value: hidden },
      { time: duration, value: hidden }
    ]
    const opacityFrames = (at: number, fade: number) =>
      closeFrames(
        [
          { time: 0, value: 'opacity:0;' },
          { time: at, value: 'opacity:0;' },
          { time: at + fade, value: 'opacity:1;' }
        ],
        'opacity:0;'
      )
    function addOpacityAnimation(
      name: string,
      at: number | undefined,
      fade: number
    ) {
      if (at === undefined) return undefined
      rules.push(keyframes(name, opacityFrames(at, fade)))
      return name
    }

    const nodes = plan.nodes.map((state) => {
      const name = `wf-${plan.workflow.id}-${state.node.id}`
      const frames = closeFrames(state.frames, state.frames[0].value)
      const focus = plan.timeline.find((event) => event.type === 'focus')
      const nodeFrames =
        focus?.node === state.node.id
          ? [
              ...frames.slice(0, -2),
              {
                time: end + 0.15,
                value: state.frames[state.frames.length - 1].value.replace(
                  'opacity:1;',
                  'opacity:0;'
                )
              },
              {
                time: end + 0.16,
                value: state.frames[0].value.replace('opacity:1;', 'opacity:0;')
              },
              frames[frames.length - 1]
            ]
          : frames
      rules.push(keyframes(name, nodeFrames))
      const characters = state.characterTimes?.map((time, index) => {
        const name = `wf-${plan.workflow.id}-${state.node.id}-char-${index}`
        rules.push(
          keyframes(
            name,
            closeFrames(
              [
                { time: 0, value: 'opacity:0;' },
                { time, value: 'opacity:1;' }
              ],
              'opacity:0;'
            )
          )
        )
        return { name }
      })
      const imageName = addOpacityAnimation(`${name}-image`, state.imageAt, 0.2)
      const selectionName = addOpacityAnimation(
        `${name}-selection`,
        state.selectionAt,
        0.05
      )
      const promptName = addOpacityAnimation(
        `${name}-prompt`,
        state.promptAt,
        0.01
      )
      const mediaTime = state.imageAt ?? state.shownAt
      const mediaAt = mediaTime === undefined ? undefined : mediaTime + start
      return { name, characters, imageName, selectionName, mediaAt, promptName }
    })
    const wires = plan.wires.map((wire) => {
      const name = `wf-${plan.workflow.id}-${wire.edge.from}-${wire.edge.to}`
      const hidden = 'stroke-dashoffset:1;opacity:0;'
      const frames: Frame[] = [{ time: 0, value: hidden }]
      if (wire.drawStart !== undefined && wire.drawEnd !== undefined)
        frames.push(
          { time: wire.drawStart - 0.005, value: hidden },
          { time: wire.drawStart, value: 'stroke-dashoffset:1;opacity:1;' },
          { time: wire.drawEnd, value: 'stroke-dashoffset:0;opacity:1;' }
        )
      if (plan.focusAt !== undefined && wire.drawEnd !== undefined)
        frames.push(
          { time: plan.focusAt, value: 'stroke-dashoffset:0;opacity:1;' },
          {
            time: plan.focusAt + plan.focusFadeDuration,
            value: 'stroke-dashoffset:0;opacity:0;'
          }
        )
      rules.push(
        keyframes(name, closeFrames(frames, 'stroke-dashoffset:0;opacity:0;'))
      )
      return { name, path: wire.path }
    })
    const addCursor = (actor: 'user' | 'agent') => {
      const cursor = plan.cursors[actor]
      const name = `wf-${actor}-${plan.workflow.id}`
      rules.push(
        keyframes(
          name,
          closeFrames(cursor.frames, cursorValue(cursor.point, false))
        )
      )
      return { name }
    }
    const userCursor = addCursor('user')
    const agentCursor = addCursor('agent')
    rules.push(
      keyframes(`wf-scene-${plan.workflow.id}`, [
        { time: 0, value: 'opacity:0;visibility:hidden;' },
        { time: start, value: 'opacity:1;visibility:visible;' },
        {
          time: start + plan.slot - 0.01,
          value: 'opacity:1;visibility:visible;'
        },
        { time: start + plan.slot, value: 'opacity:0;visibility:hidden;' },
        { time: duration, value: 'opacity:0;visibility:hidden;' }
      ])
    )
    return {
      nodes,
      wires,
      userCursor,
      agentCursor,
      start,
      timeline: plan.timeline,
      css: rules.join('\n')
    }
  })
  return { scenes, duration, css: scenes.map((scene) => scene.css).join('\n') }
}
