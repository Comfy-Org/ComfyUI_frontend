import type { DirectionPart } from './catalog'

export type LineRole =
  | 'frame'
  | 'body'
  | 'top'
  | 'dark'
  | 'accent'
  | 'glow'
  | 'neon'
  | 'ring'
  | 'stroke'
  | 'line'
  | 'groove'
  | 'glint'
  | 'dashed'
  | 'vivid'
  | 'stripes'
  | 'leak'

type LineShape =
  | { readonly kind: 'path'; readonly d: string; readonly role: LineRole }
  | {
      readonly kind: 'label'
      readonly x: number
      readonly y: number
      readonly size: number
      readonly text: string
    }

export type DirectionIcon = readonly LineShape[]

const path = (d: string, role: LineRole): LineShape => ({
  kind: 'path',
  d,
  role
})

const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  role: LineRole
): LineShape =>
  path(
    `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`,
    role
  )

const circle = (cx: number, cy: number, r: number, role: LineRole) =>
  ellipse(cx, cy, r, r, role)

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  role: LineRole,
  r = 0
): LineShape {
  if (r === 0) return path(`M${x} ${y}h${w}v${h}h${-w}Z`, role)
  return path(
    `M${x + r} ${y}h${w - r * 2}a${r} ${r} 0 0 1 ${r} ${r}v${h - r * 2}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - r * 2)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - r * 2)}a${r} ${r} 0 0 1 ${r} ${-r}Z`,
    role
  )
}

const label = (x: number, y: number, text: string, size = 6): LineShape => ({
  kind: 'label',
  x,
  y,
  size,
  text
})

const FRAME = rect(4, 8, 32, 24, 'frame', 3)

function figure(
  cx: number,
  headY: number,
  headR: number,
  shoulder: number,
  bottom: number,
  role: LineRole = 'body'
): LineShape[] {
  const neck = headY + headR * 1.6
  const drop = headY + headR * 2.2
  return [
    circle(cx, headY, headR, role),
    path(
      `M${cx - shoulder} ${bottom}C${cx - shoulder} ${drop} ${cx - shoulder * 0.5} ${neck} ${cx} ${neck}C${cx + shoulder * 0.5} ${neck} ${cx + shoulder} ${drop} ${cx + shoulder} ${bottom}Z`,
      role
    )
  ]
}

function canister(band: LineRole, split = false): LineShape[] {
  return [
    rect(12, 13, 16, 19, 'body', 2),
    ellipse(20, 13, 8, 2.4, 'top'),
    rect(17, 8, 6, 5, 'body', 1),
    ellipse(20, 8, 3, 1, 'top'),
    ...(split
      ? [rect(12, 18, 8, 9, band), rect(20, 18, 8, 9, 'top')]
      : [rect(12, 18, 16, 9, band)])
  ]
}

const AUTO: DirectionIcon = [circle(20, 20, 9, 'dashed')]

const ICONS: Readonly<
  Partial<
    Record<DirectionPart, Readonly<Partial<Record<string, DirectionIcon>>>>
  >
> = {
  shot: {
    xwide: [
      FRAME,
      rect(4.5, 24, 31, 7.5, 'dark'),
      path('M4.5 24H35.5', 'line'),
      circle(26, 20.6, 1, 'body'),
      rect(25.3, 21.5, 1.4, 2.7, 'body', 0.5)
    ],
    wide: [
      FRAME,
      path('M4.5 26H35.5', 'line'),
      ...figure(20, 14.5, 2.2, 3.2, 27)
    ],
    medium: [FRAME, ...figure(20, 16, 3.8, 9, 31.5)],
    close: [FRAME, ...figure(20, 18, 6.5, 14, 31.5)],
    xclose: [
      FRAME,
      path('M8 20Q20 10 32 20Q20 30 8 20Z', 'body'),
      circle(20, 20, 5, 'accent'),
      circle(20, 20, 2, 'dark'),
      circle(18.3, 18.4, 0.9, 'glint')
    ],
    ots: [
      FRAME,
      ...figure(26, 16.5, 3.4, 7, 31.5),
      path(
        'M4.5 31.5C4.5 22 8 16.5 13.5 16.5C18 16.5 19.5 22 17.5 31.5Z',
        'dark'
      )
    ],
    low: [
      path('M7 35L16 11M33 35L24 11', 'line'),
      path('M13.5 35L26.5 35L22.6 16L17.4 16Z', 'body'),
      circle(20, 12.5, 3, 'body')
    ]
  },
  light: {
    golden: [
      circle(20, 26, 12, 'glow'),
      path('M11 26A9 9 0 0 1 29 26Z', 'accent'),
      path('M5 26H35', 'line'),
      path('M20 12v3M10.5 16l2 2M29.5 16l-2 2', 'stroke')
    ],
    overcast: [
      path(
        'M15 22H27A4 4 0 0 0 27 14A5.5 5.5 0 0 0 17 12.5A4.5 4.5 0 0 0 15 22Z',
        'dark'
      ),
      path('M10 29H28A5 5 0 0 0 28 19A7 7 0 0 0 15 17A6 6 0 0 0 10 29Z', 'body')
    ],
    blue: [
      circle(20, 20, 14, 'glow'),
      path('M23 9A10 10 0 1 0 31 25A8 8 0 1 1 23 9Z', 'body'),
      circle(11, 12, 0.8, 'glint'),
      circle(30, 11, 0.6, 'glint'),
      circle(9, 26, 0.6, 'glint')
    ],
    night: [
      path('M14.5 15L9 34H31L25.5 15Z', 'glow'),
      rect(19, 15, 2, 20, 'body', 1),
      path('M13 15H27L24.5 9.5H15.5Z', 'body'),
      circle(20, 16, 2, 'accent')
    ],
    neon: [
      rect(8, 11, 24, 18, 'neon', 5),
      path('M13 23L18 16L22 21L27 15', 'neon')
    ],
    lowkey: [
      circle(20, 20, 11, 'dark'),
      path('M20 9A11 11 0 0 0 20 31Z', 'body'),
      circle(16, 18, 1.2, 'dark')
    ],
    silhouette: [
      circle(20, 18, 12, 'accent'),
      ...figure(20, 17, 3.4, 8, 34, 'dark')
    ]
  },
  film: {
    clean: [
      rect(9, 9, 22, 22, 'body', 4),
      rect(13.5, 13.5, 13, 13, 'accent', 2),
      path('M9 14h-3M9 20h-3M9 26h-3M31 14h3M31 20h3M31 26h3', 'line')
    ],
    t500: [...canister('accent'), label(20, 25, 'T')],
    d250: [...canister('accent'), label(20, 25, 'D')],
    bw400: [...canister('dark', true), label(20, 25, 'BW', 5)],
    slide: [rect(8, 8, 24, 24, 'body', 3), rect(13, 13, 14, 14, 'vivid', 1)],
    expired: [...canister('accent'), path('M9 30L31 10', 'leak')],
    bleach: canister('stripes')
  },
  look: {
    neonoir: [
      path('M6 27H34', 'neon'),
      ellipse(20, 25, 13, 3, 'dark'),
      path('M12 25C12 16 14 12 20 12C26 12 28 16 28 25Z', 'dark'),
      rect(12.3, 20, 15.4, 2.5, 'accent')
    ],
    western: [
      circle(26, 14, 6, 'accent'),
      path('M17 34V14a3 3 0 0 1 6 0V34Z', 'body'),
      path(
        'M17 24h-3a2 2 0 0 1-2-2v-5a1.5 1.5 0 0 1 3 0v4h2M23 21h2v-3a1.5 1.5 0 0 1 3 0v4a2 2 0 0 1-2 2h-3',
        'body'
      ),
      path('M6 34H34', 'line')
    ],
    scifi: [
      circle(20, 20, 9, 'body'),
      path('M6 23C8 28 32 20 34 16C32 13 8 19 6 23Z', 'ring')
    ],
    drama: [
      rect(11, 9, 18, 4, 'body', 1),
      rect(14, 13, 12, 17, 'body'),
      path('M17 14v15M20 14v15M23 14v15', 'groove'),
      rect(10, 30, 20, 4, 'body', 1)
    ],
    thriller: [
      rect(11, 6, 18, 28, 'body', 4),
      circle(20, 17, 3.6, 'dark'),
      path('M18 19L16.6 27H23.4L22 19Z', 'dark')
    ],
    doc: [
      rect(9, 15, 16, 10, 'body', 5),
      ellipse(28, 20, 6, 7, 'dark'),
      path('M9 20H4', 'line'),
      circle(13, 12, 2, 'accent')
    ],
    road: [
      path('M5 22H35', 'line'),
      path('M16 22L24 22L33 36H7Z', 'dark'),
      path('M20 24v2M20 29v3M20 34v1.5', 'stroke'),
      circle(29, 16, 3, 'accent')
    ]
  }
}

/** A line drawing of a shot, light, film or look option, if it has one. */
export function directionIcon(
  part: DirectionPart,
  option: string
): DirectionIcon | undefined {
  const drawings = ICONS[part]
  if (!drawings) return undefined
  return option === 'auto' ? AUTO : drawings[option]
}
