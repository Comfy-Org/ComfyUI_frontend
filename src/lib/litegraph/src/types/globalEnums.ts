/** Node slot type - input or output */
export enum NodeSlotType {
  INPUT = 1,
  OUTPUT = 2
}

/** Shape that an object will render as - used by nodes and slots */
export enum RenderShape {
  BOX = 1,
  ROUND = 2,
  CIRCLE = 3,
  /** Two rounded corners: top left & bottom right */
  CARD = 4,
  ARROW = 5,
  GRID = 6,
  HOLLOW_CIRCLE = 7
}

/** Bit flags used to indicate what the pointer is currently hovering over. */
export enum CanvasItem {
  Nothing = 0,
  Node = 1,
  Group = 1 << 1,
  /** A reroute (not its path) */
  Reroute = 1 << 2,
  Link = 1 << 3,
  RerouteSlot = 1 << 5,
  SubgraphIoNode = 1 << 6,
  SubgraphIoSlot = 1 << 7
}

/** The direction that a link point will flow towards - e.g. horizontal outputs are right by default */
export enum LinkDirection {
  NONE = 0,
  UP = 1,
  DOWN = 2,
  LEFT = 3,
  RIGHT = 4,
  CENTER = 5
}

/** The path calculation that links follow */
export enum LinkRenderType {
  HIDDEN_LINK = -1,
  /** Juts out from the input & output a little @see LinkDirection, then a straight line between them */
  STRAIGHT_LINK = 0,
  /** 90° angles, clean and box-like */
  LINEAR_LINK = 1,
  /** Smooth curved links - default */
  SPLINE_LINK = 2
}

/** The marker in the middle of a link */
export enum LinkMarkerShape {
  None = 0,
  Circle = 1,
  Arrow = 2
}

export enum TitleMode {
  NORMAL_TITLE = 0,
  NO_TITLE = 1,
  TRANSPARENT_TITLE = 2,
  AUTOHIDE_TITLE = 3
}

export enum LGraphEventMode {
  ALWAYS = 0,
  ON_EVENT = 1,
  NEVER = 2,
  ON_TRIGGER = 3,
  BYPASS = 4
}

export enum EaseFunction {
  EASE_IN_OUT_QUAD = 'easeInOutQuad'
}

/** Bit flags used to indicate what the pointer is currently hovering over. */
export enum Alignment {
  None = 0,
  Top = 1,
  Bottom = 1 << 1,
  /** Vertical middle */
  Middle = 1 << 2,
  Left = 1 << 3,
  Right = 1 << 4,
  /** Horizontal centre */
  Centre = 1 << 5,
  TopLeft = Top | Left,
  /** Top side, horizontally centred */
  TopCentre = Top | Centre,
  TopRight = Top | Right,
  /** Left side, vertically centred */
  MidLeft = Left | Middle,
  MidCentre = Middle | Centre,
  /** Right side, vertically centred */
  MidRight = Right | Middle,
  BottomLeft = Bottom | Left,
  /** Bottom side, horizontally centred */
  BottomCentre = Bottom | Centre,
  BottomRight = Bottom | Right
}

export function hasFlag(flagSet: number, flag: number): boolean {
  return (flagSet & flag) === flag
}
