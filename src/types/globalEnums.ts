/** Node slot type - input or output */
export enum NodeSlotType {
    INPUT = 1,
    OUTPUT = 2,
}

/** Shape that an object will render as - used by nodes and slots */
export enum RenderShape {
    BOX = 1,
    ROUND = 2,
    CIRCLE = 3,
    CARD = 4,
    ARROW = 5,
    /** intended for slot arrays */
    GRID = 6,
    HollowCircle = 7,
}

/** The direction that a link point will flow towards - e.g. horizontal outputs are right by default */
export enum LinkDirection {
    NONE = 0,
    UP = 1,
    DOWN = 2,
    LEFT = 3,
    RIGHT = 4,
    CENTER = 5,
}

/** The path calculation that links follow */
export enum LinkRenderType {
    /** Juts out from the input & output a little @see LinkDirection, then a straight line between them */
    STRAIGHT_LINK = 0,
    /** 90° angles, clean and box-like */
    LINEAR_LINK = 1,
    /** Smooth curved links - default */
    SPLINE_LINK = 2,
}

export enum TitleMode {
    NORMAL_TITLE = 0,
    NO_TITLE = 1,
    TRANSPARENT_TITLE = 2,
    AUTOHIDE_TITLE = 3,
}

export enum LGraphEventMode {
    ALWAYS = 0,
    ON_EVENT = 1,
    NEVER = 2,
    ON_TRIGGER = 3,
    BYPASS = 4,
}
