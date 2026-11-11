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
  }
  /** The hidden hold-and-drag entry; `?pointAtItStroke=on` also turns it on. */
  strokeEntry: boolean
  /** Whether the pins of answered turns stay on the canvas, dimmed. */
  showEarlierPins: boolean
  /** What Clear removes: the comments not sent yet, or every turn as well. */
  clearRemoves: 'unsent' | 'everything'
  turnStrip: { visibleDots: number; barSize: number }
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
    thinkingTokens: 2000,
    replyTokens: 4096,
    silenceTimeoutMs: 60_000
  },
  strokeEntry: false,
  showEarlierPins: true,
  clearRemoves: 'unsent',
  turnStrip: { visibleDots: 8, barSize: 5 }
}
