# Attribution

The code in this directory is vendored from
[jtydhr88/ComfyUI-qwenmultiangle](https://github.com/jtydhr88/ComfyUI-qwenmultiangle)
(v0.7.0), used under the MIT license as declared in that project's
`pyproject.toml` and README (the upstream repository ships no standalone
LICENSE file).

MIT License — Copyright (c) jtydhr88

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Upstream credits (per the project README): amrrs/qwenmultiangle,
the multimodalart Hugging Face space, and fal.ai's
Qwen-Image-Edit-2511-Multiple-Angles-LoRA.

## Local modifications

- `import * as THREE` replaced with named `three` imports for tree-shaking
- ComfyUI runtime coupling removed (extension registration, LiteGraph widget
  binding, Python bridge, non-English i18n)
- `dispose()` hardened: event listeners aborted, `ResizeObserver`
  disconnected, scene geometries/materials/textures disposed, canvas removed
- `pause()`/`resume()` added so the render loop stops when the widget is
  offscreen or the tab is hidden
- replaced image-card textures are disposed instead of leaked
- added an optional `palette` (colours + grid/glow toggles) so the marketing
  hero can render the scene in a quieter white / grey / yellow theme; defaults
  reproduce the upstream ComfyUI look exactly
- the zoom handle drags relative to its grab point instead of mapping the
  absolute pointer height (which made the value jump on grab)
- invisible oversized hit-proxy spheres make the three handles easier to grab
  than upstream's exact-mesh raycast
