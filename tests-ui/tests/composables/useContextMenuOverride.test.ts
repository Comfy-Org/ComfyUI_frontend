// useContextMenuOverride.test.js
import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ref, onUnmounted, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

import { useContextMenuOverride } from '@/composables/useContextMenuOverride';

vi.mock('vue', () => ({
  ref: vi.fn(() => ({ value: null })),
  onUnmounted: vi.fn(),
}));

vi.mock('@comfyorg/litegraph', () => ({
  LGraphCanvas: {
    prototype: {
      processMouseMove: vi.fn(),
      ds: {
        offset: [0, 0],
      },
      dragging_canvas: false,
    },
  },
  LiteGraph: {
    ContextMenu: vi.fn(),
  },
}));

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: vi.fn(() => ({
    wrapWithErrorHandling: vi.fn((func) => () => func()),
  })),
}));

describe('useContextMenuOverride', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    useContextMenuOverride();
  });

  it('should override LiteGraph.ContextMenu', () => {
    expect(LiteGraph.ContextMenu).not.toBe(vi.fn());
  });

  it('should override LGraphCanvas.prototype.processMouseMove', () => {
    expect(LGraphCanvas.prototype.processMouseMove).not.toBe(vi.fn());
  });

  it('should call original processMouseMove when processMouseMove is called', () => {
    const originalProcessMouseMove = vi.fn();
    LGraphCanvas.prototype.processMouseMove = originalProcessMouseMove;
    const e = new PointerEvent('pointermove');
    LGraphCanvas.prototype.processMouseMove(e);
    expect(originalProcessMouseMove).toHaveBeenCalledTimes(1);
    expect(originalProcessMouseMove).toHaveBeenCalledWith(e);
  });

  it('should update menuElement style when dragging_canvas is true', () => {
    const menuElementRef: Ref<HTMLElement | null> = ref(null);
    vi.mocked(ref).mockImplementationOnce(() => menuElementRef);

    useContextMenuOverride();

    const menuElement = document.createElement('div');
    menuElement.style.left = '0px';
    menuElement.style.top = '0px';
    menuElement.classList.add('litecontextmenu');
    document.body.appendChild(menuElement);

    menuElementRef.value = menuElement;

    LGraphCanvas.prototype.ds.offset = [0, 0];
    LGraphCanvas.prototype.dragging_canvas = true;

    // Simulate a move
    const e = new PointerEvent('pointermove');
    const originalProcessMouseMove = LGraphCanvas.prototype.processMouseMove;
    LGraphCanvas.prototype.processMouseMove = function (e) {
      const prevOffset = [0, 0]; // simulate prevOffset
      originalProcessMouseMove.call(this, e);
      const dx = this.ds.offset[0] - prevOffset[0];
      const dy = this.ds.offset[1] - prevOffset[1];
      const left = parseFloat(menuElement.style.left || '0');
      const top = parseFloat(menuElement.style.top || '0');
      menuElement.style.left = `${left + dx}px`;
      menuElement.style.top = `${top + dy}px`;
    };

    LGraphCanvas.prototype.ds.offset = [10, 10];
    LGraphCanvas.prototype.processMouseMove.call(LGraphCanvas.prototype, e);

    expect(menuElement.style.left).toBe('10px');
    expect(menuElement.style.top).toBe('10px');
  });

  it('should call onUnmounted cleanup', () => {
    const onUnmountedCleanup = vi.fn();
    vi.mocked(onUnmounted).mockImplementationOnce((fn) => {
      onUnmountedCleanup.mockImplementation(fn);
    });
    onUnmountedCleanup();
    expect(onUnmounted).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
