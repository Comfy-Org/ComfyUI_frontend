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

WORKFLOW_JSON = json.dumps(WORKFLOW, separators=(',', ':'))
PROMPT_JSON = json.dumps(PROMPT, separators=(',', ':'))


def out(name: str) -> str:
    return os.path.join(FIXTURES_DIR, name)


def report(name: str):
    size = os.path.getsize(out(name))
    print(f'  {name} ({size} bytes)')


def make_1x1_image() -> Image.Image:
    return Image.new('RGB', (1, 1), (255, 0, 0))


def build_exif_bytes() -> bytes:
    """Build EXIF bytes matching the backend's tag assignments.

    Backend: 0x010F (Make) = "workflow:<json>", 0x0110 (Model) = "prompt:<json>"
    """
    img = make_1x1_image()
    exif = img.getexif()
    exif[0x010F] = f'workflow:{WORKFLOW_JSON}'
    exif[0x0110] = f'prompt:{PROMPT_JSON}'
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
):
    """Generate an audio fixture via PyAV container.metadata[], matching the backend."""
    path = out(name)
    container = av.open(path, mode='w', format=fmt, options=options or {})
    stream = container.add_stream(codec, rate=rate)
    stream.layout = 'mono'

    container.metadata['prompt'] = PROMPT_JSON
    container.metadata['workflow'] = WORKFLOW_JSON

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


if __name__ == '__main__':
    print('Generating fixtures...')
    generate_webp()
    generate_avif()
    generate_flac()
    generate_opus()
    generate_mp3()
    generate_mp4()
    generate_webm()
    print('Done.')
