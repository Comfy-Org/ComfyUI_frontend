export function clampRating(value: number, max: number): number {
  return Math.min(Math.max(0, Math.round(value)), max)
}

export function getDisplayRating(
  committed: number,
  hover: number | null
): number {
  return hover ?? committed
}

export function getRatingFromStarClick(
  committed: number,
  clicked: number
): number {
  return committed === clicked ? 0 : clicked
}

export function isStarFilled(
  starIndex: number,
  displayRating: number
): boolean {
  return starIndex <= displayRating
}

export function getRatingFromDigitKey(key: string, max: number): number | null {
  if (key === '0') return 0
  const digit = Number.parseInt(key, 10)
  if (Number.isNaN(digit) || digit < 1 || digit > max) return null
  return digit
}

export type StarRatingReveal = 'always' | 'host-hover'

type StarRatingRevealState = {
  visible: boolean
  opacityClass: string
  pointerEventsClass: string
  effectivelyReadonly: boolean
}

export function getStarRatingRevealState(input: {
  reveal: StarRatingReveal
  hostHovered: boolean
  selfHovered: boolean
  rating: number
  disabled: boolean
  explicitlyReadonly: boolean
}): StarRatingRevealState {
  const {
    reveal,
    hostHovered,
    selfHovered,
    rating,
    disabled,
    explicitlyReadonly
  } = input

  if (reveal === 'always') {
    return {
      visible: true,
      opacityClass: 'opacity-100',
      pointerEventsClass: 'pointer-events-auto',
      effectivelyReadonly: explicitlyReadonly
    }
  }

  const isRated = rating > 0
  const visible = isRated || hostHovered

  if (!visible) {
    return {
      visible: false,
      opacityClass: 'opacity-0',
      pointerEventsClass: 'pointer-events-none',
      effectivelyReadonly: true
    }
  }

  if (disabled) {
    return {
      visible: true,
      opacityClass: 'opacity-100',
      pointerEventsClass: 'pointer-events-none',
      effectivelyReadonly: true
    }
  }

  if (selfHovered && !explicitlyReadonly) {
    return {
      visible: true,
      opacityClass: 'opacity-100',
      pointerEventsClass: 'pointer-events-auto',
      effectivelyReadonly: false
    }
  }

  if (!isRated && hostHovered) {
    return {
      visible: true,
      opacityClass: 'opacity-60',
      pointerEventsClass: 'pointer-events-auto',
      effectivelyReadonly: true
    }
  }

  return {
    visible: true,
    opacityClass: 'opacity-100',
    pointerEventsClass: 'pointer-events-auto',
    effectivelyReadonly: true
  }
}

export function getDefaultRevealForPresentation(
  presentation: 'inline' | 'overlay'
): StarRatingReveal {
  return presentation === 'overlay' ? 'host-hover' : 'always'
}
