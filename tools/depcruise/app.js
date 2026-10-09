;(() => {
  const { timeline, graph } = window.GORDIAN
  const steps = timeline.steps
  const prs = timeline.openPrs?.prs ?? []
  const states = [...steps, ...(timeline.openPrs?.states ?? [])]
  const prOfState = new Map(prs.map((pr) => [pr.state, pr]))
  const knots = timeline.knots
  const LAST = steps.length - 1
  const NOT_IN_KNOT = -1
  const NO_SUCH_FILE = -2
  const REPO_URL = `https://github.com/${timeline.repo}`

  const $ = (id) => document.getElementById(id)
  const el = (tag, cls, text) => {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (text != null) e.textContent = text
    return e
  }
  const link = (text, href) => {
    const a = el('a', null, text)
    a.href = href
    return a
  }
  const svg = (tag, attrs) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
    return e
  }
  const fmt = (n) => n.toLocaleString('en-US')
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n))
  const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  const roleOf = (value) =>
    value === NO_SUCH_FILE
      ? null
      : value === NOT_IN_KNOT
        ? 'freed'
        : knots[value].role
  const ROLE_TOKEN = {
    main: '--k-main',
    second: '--k-second',
    other: '--k-other',
    freed: '--freed'
  }
  const second = knots.find((k) => k.role === 'second')
  const ROLE_NAME = {
    main: 'Main knot',
    second: second ? `${second.label} knot` : 'Second knot',
    other: 'Other knot split off the main one',
    freed: 'Not in a cycle'
  }

  // Per-state lookups, expanded from the run-length data.
  const nodeState = states.map(() => new Int16Array(graph.nodes.length))
  graph.nodes.forEach((node, n) => {
    node.states.forEach(([from, value], i) => {
      const until = node.states[i + 1]?.[0] ?? states.length
      for (let s = from; s < until; s++) nodeState[s][n] = value
    })
  })
  const edgesAt = states.map(() => [])
  graph.edges.forEach(([, , ranges], e) => {
    for (const [from, to] of ranges)
      for (let s = from; s <= to; s++) edgesAt[s].push(e)
  })
  const edgeActive = states.map((_, s) => new Set(edgesAt[s]))
  const degreeAt = edgesAt.map((list) => {
    const degree = new Uint16Array(graph.nodes.length)
    for (const e of list) {
      degree[graph.edges[e][0]]++
      degree[graph.edges[e][1]]++
    }
    return degree
  })
  const knotName = (id) =>
    knots[id].role === 'main' ? 'main knot' : knots[id].label
  const knotSizeAt = (s, id) => states[s].knots.find((k) => k.id === id)?.size
  const hasChange = (s) => {
    const d = states[s].delta
    return d.freed.length + d.entangled.length + d.splits.length > 0
  }

  let current = 0
  let shownFrom = 0
  let tween = 1
  let tweenStart = 0
  let playing = false
  let playTimer = 0
  let hover = -1

  // Legends
  for (const role of ['main', 'second', 'other', 'freed']) {
    if (role === 'second' && !second) continue
    const item = el('span')
    item.append(el('i', `sw ${role}`), ROLE_NAME[role])
    $('mapLegend').append(item)
  }
  $('mapLegend').append(
    el('span', null, 'Dot size: connections inside its knot')
  )
  const SERIES = [
    ['total', 'Modules in any knot', (s) => steps[s].stats.modulesInKnots],
    ['main', 'Main knot', (s) => steps[s].stats.mainKnot || undefined]
  ]
  if (second)
    SERIES.push([
      'second',
      ROLE_NAME.second,
      (s) => steps[s].stats.secondKnot || undefined
    ])
  for (const [cls, label] of SERIES) {
    const item = el('span')
    item.append(el('i', `sw line ${cls}`), label)
    $('chartLegend').append(item)
  }
  $('chartLegend').append(el('span', null, 'Bold ticks are FE-3037 commits'))

  // Timeline chart
  const chart = $('chart')
  const M = { top: 14, right: 54, bottom: 26, left: 44 }
  const yMax =
    Math.ceil(Math.max(...steps.map((s) => s.stats.modulesInKnots)) / 200) * 200
  let chartW = 0
  let chartH = 0
  const xOf = (s) => M.left + (s / LAST) * (chartW - M.left - M.right)
  const yOf = (v) => M.top + (1 - v / yMax) * (chartH - M.top - M.bottom)
  const stepAtX = (clientX) => {
    const rect = chart.getBoundingClientRect()
    const frac =
      (clientX - rect.left - M.left) / (rect.width - M.left - M.right)
    return Math.max(0, Math.min(LAST, Math.round(frac * LAST)))
  }

  function drawChart() {
    chartW = chart.clientWidth
    chartH = chart.clientHeight
    chart.setAttribute('viewBox', `0 0 ${chartW} ${chartH}`)
    chart.replaceChildren()
    for (let v = 0; v <= yMax; v += 200) {
      chart.append(
        svg('line', {
          class: 'grid',
          x1: M.left,
          x2: chartW - M.right,
          y1: yOf(v),
          y2: yOf(v)
        })
      )
      const label = svg('text', { x: M.left - 8, y: yOf(v) + 4 })
      label.setAttribute('text-anchor', 'end')
      label.textContent = fmt(v)
      chart.append(label)
    }
    const base = chartH - M.bottom
    steps.forEach((step, s) => {
      chart.append(
        svg('line', {
          class: step.fe3037 ? 'tick fe' : 'tick',
          x1: xOf(s),
          x2: xOf(s),
          y1: base + 3,
          y2: base + (step.fe3037 ? 11 : 7)
        })
      )
    })
    for (const [cls, , value] of SERIES) {
      let d = ''
      let lastValue
      let lastStep = 0
      steps.forEach((_, s) => {
        const v = value(s)
        if (v === undefined) return
        d += d === '' ? `M${xOf(s)},${yOf(v)}` : `H${xOf(s)}V${yOf(v)}`
        lastValue = v
        lastStep = s
      })
      if (lastStep < LAST) continue
      chart.append(svg('path', { class: `series ${cls}`, d }))
      const end = svg('text', {
        class: 'end',
        x: chartW - M.right + 8,
        y: yOf(lastValue) + 4
      })
      end.textContent = fmt(lastValue)
      chart.append(end)
    }
    chart.append(svg('g', { id: 'cursor' }))
    drawCursor()
  }

  function drawCursor() {
    const g = chart.querySelector('#cursor')
    if (!g) return
    g.replaceChildren()
    if (current > LAST) return
    g.append(
      svg('line', {
        class: 'cursor',
        x1: xOf(current),
        x2: xOf(current),
        y1: M.top,
        y2: chartH - M.bottom + 12
      })
    )
    for (const [cls, , value] of SERIES) {
      const v = value(current)
      if (v === undefined) continue
      g.append(
        svg('circle', {
          class: `dot ${cls}`,
          cx: xOf(current),
          cy: yOf(v),
          r: 4.5
        })
      )
    }
  }

  let dragging = false
  chart.addEventListener('pointerdown', (ev) => {
    dragging = true
    chart.setPointerCapture(ev.pointerId)
    stop()
    go(stepAtX(ev.clientX))
  })
  chart.addEventListener('pointermove', (ev) => {
    const s = stepAtX(ev.clientX)
    if (dragging) go(s)
    const step = steps[s]
    showTip(
      ev,
      `${step.short} ${step.subject}`,
      `${fmt(step.stats.modulesInKnots)} modules in knots, largest ${fmt(step.stats.largestKnot)}`
    )
  })
  chart.addEventListener('pointerup', () => (dragging = false))
  chart.addEventListener('pointerleave', hideTip)

  // Module map
  const canvas = $('map')
  const PAD = 16
  let mapW = 0
  let mapH = 0
  const px = (n) => PAD + posX[n] * (mapW - 2 * PAD)
  const py = (n) => PAD + posY[n] * (mapH - 2 * PAD)

  // Motion: a knot contracts around its centroid as it shrinks, and modules
  // outside a knot spring out to a ring at the rim.
  const N = graph.nodes.length
  const hash = (n) => {
    const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453
    return v - Math.floor(v)
  }
  const stiffness = Float32Array.from(
    graph.nodes,
    (_, n) => 0.03 + 0.05 * hash(n)
  )
  const DAMPING = 0.8
  const FRAME_MS = 1000 / 60
  const MIN_KNOT_SCALE = 0.18
  const MAX_DOT_SCALE = 4
  const targetCache = new Map()
  function targetsAt(s) {
    if (targetCache.has(s)) return targetCache.get(s)
    const values = nodeState[s]
    const sums = new Map()
    graph.nodes.forEach((node, n) => {
      if (values[n] < 0) return
      const sum = sums.get(values[n]) ?? [0, 0, 0]
      sum[0] += node.x
      sum[1] += node.y
      sum[2]++
      sums.set(values[n], sum)
    })
    const scale = new Map(
      [...sums.keys()].map((id) => [
        id,
        Math.max(
          MIN_KNOT_SCALE,
          Math.sqrt((knotSizeAt(s, id) ?? 0) / knots[id].peak)
        )
      ])
    )
    const tx = new Float32Array(N)
    const ty = new Float32Array(N)
    graph.nodes.forEach((node, n) => {
      const id = values[n]
      if (id >= 0) {
        const [sx, sy, count] = sums.get(id)
        const cx = sx / count
        const cy = sy / count
        tx[n] = cx + (node.x - cx) * scale.get(id)
        ty[n] = cy + (node.y - cy) * scale.get(id)
        return
      }
      const angle = Math.atan2(node.y - 0.5, node.x - 0.5)
      const radius = 0.42 + 0.075 * hash(n + 1)
      tx[n] = 0.5 + Math.cos(angle) * radius
      ty[n] = 0.5 + Math.sin(angle) * radius
    })
    const targets = { x: tx, y: ty }
    targetCache.set(s, targets)
    return targets
  }
  const posX = new Float32Array(N)
  const posY = new Float32Array(N)
  const velX = new Float32Array(N)
  const velY = new Float32Array(N)
  function snapTo(s, only = () => true) {
    const { x, y } = targetsAt(s)
    for (let n = 0; n < N; n++) {
      if (!only(n)) continue
      posX[n] = x[n]
      posY[n] = y[n]
      velX[n] = velY[n] = 0
    }
  }
  function stepPhysics() {
    const { x, y } = targetsAt(current)
    let moving = false
    for (let n = 0; n < N; n++) {
      velX[n] = (velX[n] + (x[n] - posX[n]) * stiffness[n]) * DAMPING
      velY[n] = (velY[n] + (y[n] - posY[n]) * stiffness[n]) * DAMPING
      posX[n] += velX[n]
      posY[n] += velY[n]
      if (
        Math.abs(velX[n]) + Math.abs(velY[n]) > 2e-5 ||
        Math.abs(x[n] - posX[n]) + Math.abs(y[n] - posY[n]) > 2e-4
      )
        moving = true
    }
    if (!moving) snapTo(current)
    return moving
  }

  function drawMap() {
    const css = getComputedStyle(document.documentElement)
    const color = Object.fromEntries(
      Object.entries(ROLE_TOKEN).map(([role, token]) => [
        role,
        css.getPropertyValue(token).trim()
      ])
    )
    const ink = css.getPropertyValue('--ink').trim()
    const dpr = window.devicePixelRatio || 1
    mapW = canvas.clientWidth
    mapH = Math.round(mapW * graph.aspect)
    canvas.style.height = `${mapH}px`
    canvas.width = mapW * dpr
    canvas.height = mapH * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, mapW, mapH)

    const from = nodeState[shownFrom]
    const to = nodeState[current]
    const t = tween

    const strokeEdges = (list, values, alpha, skip) => {
      if (alpha <= 0) return
      const byRole = {}
      for (const e of list) {
        if (skip?.has(e)) continue
        const role = roleOf(values[graph.edges[e][0]])
        if (role && role !== 'freed') (byRole[role] ??= []).push(e)
      }
      ctx.lineWidth = 0.6
      ctx.globalAlpha = alpha
      for (const [role, es] of Object.entries(byRole)) {
        ctx.strokeStyle = color[role]
        ctx.beginPath()
        for (const e of es) {
          const [a, b] = graph.edges[e]
          ctx.moveTo(px(a), py(a))
          ctx.lineTo(px(b), py(b))
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    const EDGE_ALPHA = 0.16
    strokeEdges(edgesAt[current], to, EDGE_ALPHA)
    if (t < 1)
      strokeEdges(
        edgesAt[shownFrom],
        from,
        EDGE_ALPHA * (1 - t),
        edgeActive[current]
      )

    const r = Math.max(1.7, Math.min(3, mapW / 260))
    const degreeFrom = degreeAt[shownFrom]
    const degreeTo = degreeAt[current]
    const radius = (degree) =>
      degree === 0
        ? r * 0.75
        : r * Math.min(MAX_DOT_SCALE, 0.6 + 0.25 * Math.sqrt(degree))
    const radiusNow = (n) =>
      radius(degreeFrom[n]) + (radius(degreeTo[n]) - radius(degreeFrom[n])) * t
    const dot = (n, role, alpha, size) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = color[role]
      ctx.beginPath()
      ctx.arc(px(n), py(n), size, 0, 7)
      ctx.fill()
    }
    const knotted = []
    for (let n = 0; n < N; n++) {
      const role = roleOf(to[n])
      if (role === 'freed') dot(n, role, 1, radiusNow(n))
      else if (role) knotted.push(n)
    }
    knotted.sort((a, b) => degreeTo[b] - degreeTo[a])
    for (const n of knotted) dot(n, roleOf(to[n]), 1, radiusNow(n))
    if (t < 1) {
      for (let n = 0; n < N; n++) {
        const was = roleOf(from[n])
        if (was && was !== roleOf(to[n]))
          dot(n, was, 1 - t, radius(degreeFrom[n]))
      }
    }
    ctx.globalAlpha = 1

    const before = nodeState[states[current].parent ?? current]
    ctx.strokeStyle = ink
    ctx.lineWidth = 0.75
    ctx.globalAlpha = 0.4
    for (let n = 0; n < N; n++) {
      if (roleOf(before[n]) === roleOf(to[n]) || !roleOf(to[n])) continue
      ctx.beginPath()
      ctx.arc(px(n), py(n), radiusNow(n) + 1.5 + (1 - t) * 7, 0, 7)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    if (hover >= 0 && roleOf(to[hover])) {
      ctx.strokeStyle = ink
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(px(hover), py(hover), radiusNow(hover) + 3, 0, 7)
      ctx.stroke()
    }
  }

  let frame = 0
  let lastFrame = 0
  let lag = 0
  function animate(now) {
    tween = Math.min(1, (now - tweenStart) / 450)
    lag = Math.min(lag + now - lastFrame, 4 * FRAME_MS)
    lastFrame = now
    let moving = true
    for (; lag >= FRAME_MS; lag -= FRAME_MS) moving = stepPhysics()
    drawMap()
    if (tween >= 1) shownFrom = current
    frame = tween < 1 || moving ? requestAnimationFrame(animate) : 0
  }
  function startAnimation() {
    if (frame) return
    lastFrame = performance.now()
    lag = 0
    frame = requestAnimationFrame(animate)
  }

  canvas.addEventListener('pointermove', (ev) => {
    const rect = canvas.getBoundingClientRect()
    const mx = ev.clientX - rect.left
    const my = ev.clientY - rect.top
    const values = nodeState[current]
    let best = -1
    let bestDist = 144
    for (let n = 0; n < N; n++) {
      if (!roleOf(values[n])) continue
      const d = (px(n) - mx) ** 2 + (py(n) - my) ** 2
      if (d < bestDist) {
        bestDist = d
        best = n
      }
    }
    if (best !== hover) {
      hover = best
      if (!frame) drawMap()
    }
    if (best < 0) return hideTip()
    const value = values[best]
    const where =
      value === NOT_IN_KNOT
        ? 'Not in a cycle here'
        : `In ${knotName(value)} (${fmt(knotSizeAt(current, value))} modules), ${plural(degreeAt[current][best], 'cyclic connection', 'cyclic connections')}`
    const freedAt = graph.nodes[best].states.find(
      ([s, v]) => s > 0 && s <= LAST && v === NOT_IN_KNOT
    )
    const by = freedAt && steps[freedAt[0]]
    const when = by
      ? `. Freed on main by ${by.short}${by.pr ? ` (#${by.pr})` : ''}`
      : ''
    showTip(ev, graph.nodes[best].path, where + when)
  })
  canvas.addEventListener('pointerleave', () => {
    hover = -1
    hideTip()
    if (!frame) drawMap()
  })

  // Tooltip
  const tip = $('tip')
  function showTip(ev, title, detail) {
    tip.replaceChildren(el('b', null, title), el('span', null, detail))
    tip.hidden = false
    const left = Math.min(
      ev.clientX + 14,
      window.innerWidth - tip.offsetWidth - 8
    )
    tip.style.left = `${Math.max(8, left)}px`
    tip.style.top = `${ev.clientY + 16}px`
  }
  function hideTip() {
    tip.hidden = true
  }

  // Detail column
  const prStatus = (pr) =>
    pr.mergeable === 'CONFLICTING'
      ? 'Conflicts'
      : pr.isDraft
        ? 'Draft'
        : pr.reviewDecision === 'CHANGES_REQUESTED'
          ? 'Changes requested'
          : pr.reviewDecision === 'APPROVED'
            ? 'Approved'
            : 'In review'

  function fillList(box, summary, list, paths, label) {
    box.hidden = paths.length === 0
    summary.textContent = label
    list.replaceChildren(...paths.map((p) => el('li', null, p)))
  }

  function drawDetail() {
    const state = states[current]
    const pr = prOfState.get(current)
    const reference = pr ? states[pr.baseState] : steps[0]
    const referenceLabel = pr ? 'vs its base on main' : 'since baseline'

    const where = $('where')
    if (pr) {
      where.replaceChildren(
        el('span', null, `Open pull request by ${pr.author}`),
        el('span', 'badge', prStatus(pr)),
        el(
          'span',
          'badge quiet',
          pr.behindMain
            ? `Base is ${fmt(pr.behindMain)} commits behind main`
            : 'On current main'
        )
      )
    } else {
      where.replaceChildren(
        el('span', null, `Commit ${current} of ${LAST}`),
        el('span', null, state.date.slice(0, 10)),
        current === 0
          ? el('span', 'badge quiet', 'Baseline')
          : el(
              'span',
              state.fe3037 ? 'badge' : 'badge quiet',
              state.fe3037 ? 'FE-3037' : 'Other work'
            )
      )
    }
    $('subject').textContent = state.subject

    const links = $('links')
    links.replaceChildren(link(state.short, `${REPO_URL}/commit/${state.sha}`))
    if (state.pr)
      links.append(link(`#${state.pr}`, `${REPO_URL}/pull/${state.pr}`))

    const rows = [
      ['Modules in knots', 'modulesInKnots'],
      ['Largest knot', 'largestKnot'],
      ['Imports inside knots', 'importsInKnots'],
      ['no-circular warnings', 'noCircularWarnings']
    ]
    $('stats').replaceChildren(
      ...rows.map(([label, key]) => {
        const row = el('div')
        const dd = el('dd', null, fmt(state.stats[key]))
        if (state !== reference)
          dd.append(
            el(
              'span',
              'chg',
              `${signed(state.stats[key] - reference.stats[key])} ${referenceLabel}`
            )
          )
        row.append(el('dt', null, label), dd)
        return row
      })
    )

    const { freed, entangled, splits } = state.delta
    $('deltaTitle').textContent = !pr
      ? 'This commit'
      : !pr.containsParentHead
        ? `Whole branch against its fork point; needs a rebase onto #${pr.parentPr}`
        : pr.parentPr
          ? `This pull request, on top of #${pr.parentPr}`
          : 'This pull request'
    $('deltaSummary').textContent =
      current === 0
        ? 'Baseline: the parent of the first FE-3037 commit.'
        : !hasChange(current)
          ? 'No change to import cycles.'
          : [
              freed.length &&
                `${plural(freed.length, 'module', 'modules')} freed`,
              entangled.length &&
                `${plural(entangled.length, 'module', 'modules')} pulled into a cycle`
            ]
              .filter(Boolean)
              .join(', ') || 'Knots split without freeing modules.'
    $('splits').replaceChildren(
      ...splits.map(({ from, into }) =>
        el(
          'li',
          null,
          `${knotName(from)} split: ${into
            .map((id) => `${knots[id].label} (${fmt(knotSizeAt(current, id))})`)
            .join(', ')} broke away.`
        )
      )
    )
    fillList(
      $('freedBox'),
      $('freedSummary'),
      $('freedList'),
      freed,
      `Freed (${fmt(freed.length)})`
    )
    fillList(
      $('entangledBox'),
      $('entangledSummary'),
      $('entangledList'),
      entangled,
      `Pulled into a cycle (${fmt(entangled.length)})`
    )

    $('knotsTitle').textContent = pr
      ? 'Knots with this pull request'
      : 'Knots at this commit'
    $('knotList').replaceChildren(
      ...state.knots.map(({ id, size }) => {
        const li = el('li')
        const role = knots[id].fromMain ? knots[id].role : 'freed'
        li.append(
          el('i', `sw ${role}`),
          el('span', 'name', knotName(id)),
          el('span', 'size', fmt(size))
        )
        if (!knots[id].fromMain)
          li.title = 'Separate from the main knot; not drawn on the map'
        return li
      })
    )

    $('first').disabled = $('prev').disabled = current === 0
    $('next').disabled = $('last').disabled = current === LAST
    $('scrub').value = String(Math.min(current, LAST))
    for (const row of document.querySelectorAll('.prrow'))
      row.classList.toggle('selected', Number(row.dataset.state) === current)
  }

  // Side panel tabs
  const TABS = {
    details: ['tabDetails', 'panelDetails'],
    prs: ['tabPrs', 'open-prs']
  }
  let activeTab = 'details'
  function selectTab(name) {
    activeTab = name
    for (const [key, [tabId, panelId]] of Object.entries(TABS)) {
      $(tabId).setAttribute('aria-selected', String(key === name))
      $(panelId).hidden = key !== name
    }
  }
  function syncHash() {
    const pr = prOfState.get(current)
    const hash = pr
      ? `pr-${pr.number}`
      : activeTab === 'prs'
        ? 'open-prs'
        : String(current)
    history.replaceState(null, '', `#${hash}`)
  }
  for (const name of Object.keys(TABS)) {
    $(TABS[name][0]).addEventListener('click', () => {
      selectTab(name)
      syncHash()
    })
  }

  // Open pull requests
  function drawPrs() {
    if (prs.length === 0) return
    $('tabPrs').hidden = false
    $('tabPrs').textContent = `Open pull requests (${prs.length})`
    const head = steps[LAST]
    const fresh = prs.filter((pr) => pr.behindMain === 0)
    const best = fresh.reduce(
      (a, b) =>
        !a ||
        states[b.state].stats.modulesInKnots <
          states[a.state].stats.modulesInKnots
          ? b
          : a,
      null
    )
    const stale = prs.length - fresh.length
    const sentences = []
    if (best) {
      const s = states[best.state].stats
      sentences.push(
        `Landing the stack through #${best.number} would take modules in knots from ${fmt(head.stats.modulesInKnots)} to ${fmt(s.modulesInKnots)} and the main knot from ${fmt(head.stats.mainKnot)} to ${fmt(s.mainKnot)}.`
      )
    }
    if (stale)
      sentences.push(
        `${plural(stale, 'pull request forks', 'pull requests fork')} from an older main (greyed), so ${stale === 1 ? 'its' : 'their'} totals are not comparable with today's.`
      )
    $('prSummary').textContent = sentences.join(' ')

    const children = (parent) =>
      prs
        .filter((pr) => pr.parentPr === parent)
        .sort((a, b) => a.number - b.number)
    const ordered = []
    const visit = (pr) => {
      ordered.push(pr)
      children(pr.number).forEach(visit)
    }
    children(null).forEach(visit)

    const widest = Math.max(
      head.stats.modulesInKnots,
      ...prs.map((pr) => states[pr.state].stats.modulesInKnots)
    )
    const bar = (state) => {
      const wrap = el('div', 'bar')
      wrap.style.width = `${(state.stats.modulesInKnots / widest) * 100}%`
      const { modulesInKnots, mainKnot, secondKnot } = state.stats
      const parts = [
        ['main', mainKnot],
        ['second', secondKnot],
        ['other', modulesInKnots - mainKnot - secondKnot]
      ]
      for (const [role, n] of parts) {
        if (!n) continue
        const seg = el('i', role)
        seg.style.flex = `${n} 0 0`
        wrap.append(seg)
      }
      return wrap
    }
    const row = (stateIndex, title, meta, cls) => {
      const button = el('button', `prrow${cls ? ` ${cls}` : ''}`)
      button.type = 'button'
      button.dataset.state = String(stateIndex)
      button.append(title, el('span', 'm', meta), bar(states[stateIndex]))
      button.addEventListener('click', () => {
        stop()
        go(stateIndex)
      })
      return button
    }
    const totals = (state) =>
      `${fmt(state.stats.modulesInKnots)} in knots · main knot ${fmt(state.stats.mainKnot)}`

    const mainTitle = el('span', 't')
    mainTitle.append(el('b', null, 'main'), ` today (${head.short})`)
    const list = $('prList')
    list.replaceChildren(row(LAST, mainTitle, totals(head)))
    for (const pr of ordered) {
      const state = states[pr.state]
      const title = el('span', 't')
      title.style.paddingLeft = `${pr.depth * 12}px`
      title.append(
        pr.depth ? '└ ' : '',
        el('b', null, `#${pr.number}`),
        ` ${pr.title.replace(/^refactor: /, '')}`
      )
      const net = state.delta.freed.length - state.delta.entangled.length
      const effect = !pr.containsParentHead
        ? 'needs rebase'
        : net === 0
          ? 'no change'
          : `frees ${fmt(net)}`
      const base = pr.behindMain ? ` · ${fmt(pr.behindMain)} behind main` : ''
      list.append(
        row(
          pr.state,
          title,
          `${prStatus(pr)} · ${effect} · ${totals(state)}${base}`,
          pr.behindMain ? 'stale' : ''
        )
      )
    }
    list.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return
      const rows = [...list.querySelectorAll('.prrow')]
      const at = rows.indexOf(document.activeElement)
      const target = at + (ev.key === 'ArrowDown' ? 1 : -1)
      if (target < 0 || target >= rows.length) return
      const next = rows[target]
      ev.preventDefault()
      next.focus()
      next.click()
    })
  }

  // Navigation
  function go(target) {
    const s = Math.max(0, Math.min(states.length - 1, target))
    if (s === current) return
    if (tween >= 1) shownFrom = current
    const previous = nodeState[current]
    current = s
    snapTo(current, (n) => previous[n] === NO_SUCH_FILE)
    drawDetail()
    drawCursor()
    syncHash()
    if (reducedMotion) {
      tween = 1
      shownFrom = current
      snapTo(current)
      drawMap()
      return
    }
    tween = 0
    tweenStart = performance.now()
    startAnimation()
  }
  const stops = () =>
    $('feOnly').checked
      ? steps.filter((s) => s.index === 0 || s.fe3037).map((s) => s.index)
      : steps.map((s) => s.index)
  const nextStop = () => stops().find((s) => s > current) ?? LAST
  const prevStop = () => stops().findLast((s) => s < current) ?? 0

  function tick() {
    if (current >= LAST) return stop()
    go(nextStop())
    const speed = Number($('speed').value)
    playTimer = setTimeout(tick, (hasChange(current) ? 1400 : 220) * speed)
  }
  function play() {
    if (current >= LAST) go(0)
    playing = true
    $('play').textContent = 'Pause'
    playTimer = setTimeout(tick, 400)
  }
  function stop() {
    playing = false
    clearTimeout(playTimer)
    $('play').textContent = 'Play'
  }

  $('play').addEventListener('click', () => (playing ? stop() : play()))
  $('first').addEventListener('click', () => (stop(), go(0)))
  $('last').addEventListener('click', () => (stop(), go(LAST)))
  $('prev').addEventListener('click', () => (stop(), go(prevStop())))
  $('next').addEventListener('click', () => (stop(), go(nextStop())))
  $('scrub').max = String(LAST)
  $('scrub').addEventListener('input', (ev) => {
    stop()
    go(Number(ev.target.value))
  })
  document.addEventListener('keydown', (ev) => {
    if (ev.target.closest('select, input[type="checkbox"], summary, a, .prrow'))
      return
    const actions = {
      ArrowRight: () => (stop(), go(nextStop())),
      ArrowLeft: () => (stop(), go(prevStop())),
      Home: () => (stop(), go(0)),
      End: () => (stop(), go(LAST)),
      ' ': () => (playing ? stop() : play())
    }
    const action = actions[ev.key]
    if (!action) return
    ev.preventDefault()
    action()
  })

  const redraw = () => {
    drawChart()
    drawMap()
  }
  new ResizeObserver(redraw).observe(canvas)
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawMap)

  function applyHash() {
    const hash = location.hash.slice(1)
    const hashPr = prs.find((pr) => `pr-${pr.number}` === hash)
    const hashStep = Number(hash)
    if (hashPr || hash === 'open-prs') selectTab('prs')
    if (hashPr) return hashPr.state
    if (hash === 'open-prs') return LAST
    return Number.isInteger(hashStep) && hashStep > 0 && hashStep <= LAST
      ? hashStep
      : 0
  }
  addEventListener('hashchange', () => {
    stop()
    go(applyHash())
    drawDetail()
  })

  drawPrs()
  current = shownFrom = applyHash()
  snapTo(current)
  drawDetail()
  redraw()
})()
