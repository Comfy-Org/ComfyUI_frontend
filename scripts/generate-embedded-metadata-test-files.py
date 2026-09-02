#!/usr/bin/env python3
"""
Generate test fixture files for metadata parser tests.

Each fixture embeds the same workflow and prompt JSON, matching the
format the ComfyUI backend uses to write metadata.

Prerequisites:
    source ~/ComfyUI/.venv/bin/activate
    python3 scripts/generate-embedded-metadata-test-files.py

Output: src/scripts/metadata/__fixtures__/
"""

import json
import os
import struct
import subprocess

import av
from PIL import Image
from PIL.PngImagePlugin import PngInfo

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES_DIR = os.path.join(REPO_ROOT, 'src', 'scripts', 'metadata', '__fixtures__')

WORKFLOW = {
    'nodes': [
        {
            'id': 1,
            'type': 'KSampler',
            'pos': [100, 100],
            'size': [200, 200],
        }
    ]
}
PROMPT = {'1': {'class_type': 'KSampler', 'inputs': {}}}

# API-format prompt with bare NaN/Infinity tokens (as Python's json.dumps emits
# by default). The NaN variant fixtures omit the workflow field so the loader
# must route through prompt-parsing, which trips JSON.parse on bare NaN.
PROMPT_NAN = {
    '1': {
        'class_type': 'KSampler',
        'inputs': {'cfg': float('nan'), 'denoise': float('inf')},
    }
}

WORKFLOW_JSON = json.dumps(WORKFLOW, separators=(',', ':'))
PROMPT_JSON = json.dumps(PROMPT, separators=(',', ':'))
PROMPT_NAN_JSON = json.dumps(PROMPT_NAN, separators=(',', ':'))


def out(name: str) -> str:
    return os.path.join(FIXTURES_DIR, name)


def report(name: str):
    size = os.path.getsize(out(name))
    print(f'  {name} ({size} bytes)')


def make_1x1_image() -> Image.Image:
    return Image.new('RGB', (1, 1), (255, 0, 0))


def build_exif_bytes(
    workflow_str: str | None = WORKFLOW_JSON,
    prompt_str: str | None = PROMPT_JSON,
) -> bytes:
    """Build EXIF bytes matching the backend's tag assignments.

    Backend: 0x010F (Make) = "workflow:<json>", 0x0110 (Model) = "prompt:<json>"
    Pass ``None`` to omit a tag.
    """
    img = make_1x1_image()
    exif = img.getexif()
    if workflow_str is not None:
        exif[0x010F] = f'workflow:{workflow_str}'
    if prompt_str is not None:
        exif[0x0110] = f'prompt:{prompt_str}'
    return exif.tobytes()


def inject_exif_prefix_in_webp(path: str):
    """Prepend Exif\\0\\0 to the EXIF chunk in a WEBP file.

    PIL always strips this prefix, so we re-inject it to test that code path.
    """
    data = bytearray(open(path, 'rb').read())
    off = 12
    while off < len(data):
        chunk_type = data[off:off + 4]
        chunk_len = struct.unpack_from('<I', data, off + 4)[0]
        if chunk_type == b'EXIF':
            prefix = b'Exif\x00\x00'
            data[off + 8:off + 8] = prefix
            struct.pack_into('<I', data, off + 4, chunk_len + len(prefix))
            riff_size = struct.unpack_from('<I', data, 4)[0]
            struct.pack_into('<I', data, 4, riff_size + len(prefix))
            break
        off += 8 + chunk_len + (chunk_len % 2)
    with open(path, 'wb') as f:
        f.write(data)


def generate_av_fixture(
    name: str,
    fmt: str,
    codec: str,
    rate: int = 44100,
    options: dict | None = None,
    *,
    prompt_json: str | None = PROMPT_JSON,
    workflow_json: str | None = WORKFLOW_JSON,
):
    """Generate an audio fixture via PyAV container.metadata[], matching the backend."""
    path = out(name)
    container = av.open(path, mode='w', format=fmt, options=options or {})
    stream = container.add_stream(codec, rate=rate)
    stream.layout = 'mono'

    if prompt_json is not None:
        container.metadata['prompt'] = prompt_json
    if workflow_json is not None:
        container.metadata['workflow'] = workflow_json

    sample_fmt = stream.codec_context.codec.audio_formats[0].name
    samples = stream.codec_context.frame_size or 1024
    frame = av.AudioFrame(format=sample_fmt, layout='mono', samples=samples)
    frame.rate = rate
    frame.pts = 0
    for packet in stream.encode(frame):
        container.mux(packet)
    for packet in stream.encode():
        container.mux(packet)
    container.close()
    report(name)


def generate_png():
    img = make_1x1_image()
    info = PngInfo()
    info.add_text('workflow', WORKFLOW_JSON)
    info.add_text('prompt', PROMPT_JSON)
    img.save(out('with_metadata.png'), 'PNG', pnginfo=info)
    report('with_metadata.png')


def generate_webp():
    img = make_1x1_image()
    exif = build_exif_bytes()

    img.save(out('with_metadata.webp'), 'WEBP', exif=exif)
    report('with_metadata.webp')

    img.save(out('with_metadata_exif_prefix.webp'), 'WEBP', exif=exif)
    inject_exif_prefix_in_webp(out('with_metadata_exif_prefix.webp'))
    report('with_metadata_exif_prefix.webp')


def generate_avif():
    img = make_1x1_image()
    exif = build_exif_bytes()
    img.save(out('with_metadata.avif'), 'AVIF', exif=exif)
    report('with_metadata.avif')


def generate_flac():
    generate_av_fixture('with_metadata.flac', 'flac', 'flac')


def generate_opus():
    generate_av_fixture('with_metadata.opus', 'opus', 'libopus', rate=48000)


def generate_mp3():
    generate_av_fixture('with_metadata.mp3', 'mp3', 'libmp3lame')


def generate_mp4():
    """Generate MP4 via ffmpeg CLI with QuickTime keys/ilst metadata."""
    path = out('with_metadata.mp4')
    subprocess.run([
        'ffmpeg', '-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
        '-t', '0.01', '-c:a', 'aac', '-b:a', '32k',
        '-movflags', 'use_metadata_tags',
        '-metadata', f'prompt={PROMPT_JSON}',
        '-metadata', f'workflow={WORKFLOW_JSON}',
        path,
    ], check=True)
    report('with_metadata.mp4')


def generate_webm():
    generate_av_fixture('with_metadata.webm', 'webm', 'libvorbis')


def generate_nan_variants():
    """Per-format fixtures carrying ONLY a NaN/Infinity-laden API prompt.

    These force the loader through the prompt-parsing path, where Python's
    bare NaN/Infinity tokens trip JSON.parse.
    """
    img = make_1x1_image()
    info = PngInfo()
    info.add_text('prompt', PROMPT_NAN_JSON)
    img.save(out('with_nan_metadata.png'), 'PNG', pnginfo=info)
    report('with_nan_metadata.png')

    exif_nan = build_exif_bytes(workflow_str=None, prompt_str=PROMPT_NAN_JSON)

    img = make_1x1_image()
    img.save(out('with_nan_metadata.webp'), 'WEBP', exif=exif_nan)
    report('with_nan_metadata.webp')

    img = make_1x1_image()
    img.save(out('with_nan_metadata.avif'), 'AVIF', exif=exif_nan)
    report('with_nan_metadata.avif')

    generate_av_fixture(
        'with_nan_metadata.flac', 'flac', 'flac',
        prompt_json=PROMPT_NAN_JSON, workflow_json=None,
    )
    generate_av_fixture(
        'with_nan_metadata.opus', 'opus', 'libopus', rate=48000,
        prompt_json=PROMPT_NAN_JSON, workflow_json=None,
    )
    generate_av_fixture(
        'with_nan_metadata.mp3', 'mp3', 'libmp3lame',
        prompt_json=PROMPT_NAN_JSON, workflow_json=None,
    )
    generate_av_fixture(
        'with_nan_metadata.webm', 'webm', 'libvorbis',
        prompt_json=PROMPT_NAN_JSON, workflow_json=None,
    )

    path = out('with_nan_metadata.mp4')
    subprocess.run([
        'ffmpeg', '-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
        '-t', '0.01', '-c:a', 'aac', '-b:a', '32k',
        '-movflags', 'use_metadata_tags',
        '-metadata', f'prompt={PROMPT_NAN_JSON}',
        path,
    ], check=True)
    report('with_nan_metadata.mp4')

    # Direct JSON file containing API-format prompt with bare NaN/Infinity.
    json_path = out('with_nan_metadata.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        f.write(PROMPT_NAN_JSON)
    report('with_nan_metadata.json')


if __name__ == '__main__':
    print('Generating fixtures...')
    generate_png()
    generate_webp()
    generate_avif()
    generate_flac()
    generate_opus()
    generate_mp3()
    generate_mp4()
    generate_webm()
    generate_nan_variants()
    print('Done.')
