export interface PointConfig {
  /** Which agent answers: the real model through the local proxy, or the script. */
  agent: 'model' | 'scripted'
  /** The scripted agent only. */
  scripted: {
    replyDelayMs: number
    /** Lands the first answer on the wrong node, to see how that reads. */
    wrongTarget: boolean
  }
  /** The real model only. */
  model: {
    /**
     * Ask for the model's thinking and show it while waiting. With it on, the
     * reply format is given in the instructions; with it off, the provider
     * enforces the format and the thinking is not returned.
     */
    showThinking: boolean
    /**
     * How hard the model thinks when thinking is on. Claude Sonnet 5.5 decides
     * for itself whether to think: in the smoke calls it showed thinking at
     * 'max' (about 14 s) and none at 'high' (about 5 s).
     */
    thinkingEffort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
    /** Room for thinking, added to the reply's token limit. */
    thinkingTokens: number
    /** The most tokens for the reply itself. */
    replyTokens: number
    /** Give up when nothing has arrived for this long. */
    silenceTimeoutMs: number
    /**
     * Tell the model to decide once and keep its thinking short. The effort
     * above is sent unchanged. Measured on 2026-11-12 on three requests,
     * three runs each: complete answers took 10 to 46 s with it on and
     * 12 to 187 s before it existed.
     */
    briefThinking: boolean
  }
  /** The hidden hold-and-drag entry; `?pointAtItStroke=on` also turns it on. */
  strokeEntry: boolean
  /** Whether the pins of answered turns stay on the canvas, dimmed. */
  showEarlierPins: boolean
  /** What Clear removes: the comments not sent yet, or every turn as well. */
  clearRemoves: 'unsent' | 'everything'
  /**
   * Whether the box with the full thinking opens when a request is sent.
   * Off: only the latest thought shows, as plain text, and Ask opens the box.
   */
  thinkingDockOpensOnSend: boolean
  turnStrip: { visibleDots: number; barSize: number }
  /**
   * The fennec companion: she waits at the bottom left, says the thinking in
   * a speech bubble, goes to what an answer points at, and goes home when it
   * is done. Off restores the layout without her.
   */
  companion: boolean
  /**
   * Whether the Ask strip, the Ask button with its caret, stays at the bottom
   * centre while the companion is on. Off: she is the Ask button (and the
   * slot above the strip still shows what it has to say). The strip is always
   * there when the companion is off.
   */
  askStrip: boolean
  /**
   * Temporary. While the companion is on, the canvas does not draw its own
   * info lines (the fps and the rest) at the bottom left, where she stands.
   * The app's Canvas Info setting is not changed.
   */
  hideCanvasInfo: boolean
  /**
   * While the companion is on, whether she reacts when the pointer comes onto
   * her at the dock: a short, random expression and a small movement. Off:
   * she only lifts a little.
   */
  hoverReactions: boolean
  /**
   * While the companion is on, whether resting the pointer on her for a
   * moment opens her card (a peek that closes again when the pointer is gone
   * and is kept by a click), instead of her native tooltip. Off: the tooltip,
   * and the card opens on a click or the keyboard only.
   */
  hoverMenu: boolean
}

/**
 * What the demo controls used to set. Read once when the layer starts;
 * change a value here and reload the page.
 */
export const pointConfig: PointConfig = {
  agent: 'model',
  scripted: { replyDelayMs: 2000, wrongTarget: false },
  model: {
    showThinking: true,
    thinkingEffort: 'max',
    thinkingTokens: 64_000,
    replyTokens: 64_000,
    silenceTimeoutMs: 60_000,
    briefThinking: true
  },
  strokeEntry: false,
  showEarlierPins: true,
  clearRemoves: 'unsent',
  thinkingDockOpensOnSend: false,
  turnStrip: { visibleDots: 8, barSize: 5 },
  companion: true,
  askStrip: false,
  hideCanvasInfo: true,
  hoverReactions: true,
  hoverMenu: true
}
