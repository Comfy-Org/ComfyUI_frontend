export interface LGraphIconOptions {
  unicode: string
  fontFamily?: string
  color?: string
  bgColor?: string
  fontSize?: number
  circlePadding?: number
  xOffset?: number
  yOffset?: number
}

export class LGraphIcon {
  unicode: string
  fontFamily: string
  color: string
  bgColor?: string
  fontSize: number
  circlePadding: number
  xOffset: number
  yOffset: number

  constructor({
    unicode,
    fontFamily = 'PrimeIcons',
    color = '#e6c200',
    bgColor,
    fontSize = 16,
    circlePadding = 2,
    xOffset = 0,
    yOffset = 0
  }: LGraphIconOptions) {
    this.unicode = unicode
    this.fontFamily = fontFamily
    this.color = color
    this.bgColor = bgColor
    this.fontSize = fontSize
    this.circlePadding = circlePadding
    this.xOffset = xOffset
    this.yOffset = yOffset
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number) {
    x += this.xOffset
    y += this.yOffset

    const { font, textBaseline, textAlign, fillStyle } = ctx

    ctx.font = `${this.fontSize}px '${this.fontFamily}'`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    const iconRadius = this.fontSize / 2 + this.circlePadding
    // Draw icon background circle if bgColor is set
    if (this.bgColor) {
      ctx.beginPath()
      ctx.arc(x + iconRadius, y, iconRadius, 0, 2 * Math.PI)
      ctx.fillStyle = this.bgColor
      ctx.fill()
    }
    // Draw icon
    ctx.fillStyle = this.color
    ctx.fillText(this.unicode, x + iconRadius, y)

    ctx.font = font
    ctx.textBaseline = textBaseline
    ctx.textAlign = textAlign
    ctx.fillStyle = fillStyle
  }
}
