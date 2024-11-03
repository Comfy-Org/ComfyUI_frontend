export enum BadgePosition {
  TopLeft = "top-left",
  TopRight = "top-right",
}

export interface LGraphBadgeOptions {
  text: string;
  fgColor?: string;
  bgColor?: string;
  fontSize?: number;
  padding?: number;
  height?: number;
  cornerRadius?: number;
}

export class LGraphBadge {
  text: string;
  fgColor: string;
  bgColor: string;
  fontSize: number;
  padding: number;
  height: number;
  cornerRadius: number;

  constructor({
    text,
    fgColor = "white",
    bgColor = "#0F1F0F",
    fontSize = 12,
    padding = 6,
    height = 20,
    cornerRadius = 5,
  }: LGraphBadgeOptions) {
    this.text = text;
    this.fgColor = fgColor;
    this.bgColor = bgColor;
    this.fontSize = fontSize;
    this.padding = padding;
    this.height = height;
    this.cornerRadius = cornerRadius;
  }

  get visible() {
    return this.text.length > 0;
  }

  getWidth(ctx: CanvasRenderingContext2D) {
    if (!this.visible) return 0;

    ctx.save();
    ctx.font = `${this.fontSize}px sans-serif`;
    const textWidth = ctx.measureText(this.text).width;
    ctx.restore();
    return textWidth + this.padding * 2;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
  ): void {
    if (!this.visible) return;

    ctx.save();
    ctx.font = `${this.fontSize}px sans-serif`;
    const badgeWidth = this.getWidth(ctx);
    const badgeX = 0;

    // Draw badge background
    ctx.fillStyle = this.bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x + badgeX, y, badgeWidth, this.height, this.cornerRadius);
    } else {
      // Fallback for browsers that don't support roundRect
      ctx.rect(x + badgeX, y, badgeWidth, this.height);
    }
    ctx.fill();

    // Draw badge text
    ctx.fillStyle = this.fgColor;
    ctx.fillText(
      this.text,
      x + badgeX + this.padding,
      y + this.height - this.padding
    );

    ctx.restore();
  }
}
