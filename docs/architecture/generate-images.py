"""
Generate pixel art room images for the Architecture Adventure game.
Uses Z-Image Turbo pipeline via local ComfyUI server (no LoRA).

Usage: python docs/architecture/generate-images.py
"""

import json
import os
import time
import urllib.request

COMFY_URL = "http://localhost:8188"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_FILE = os.path.join(SCRIPT_DIR, "adventure-image-prompts.json")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "images")
BASE_SEED = 2024
WIDTH = 1152
HEIGHT = 640


def build_workflow(prompt_text, seed, prefix):
    return {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "ZIT\\z_image_turbo_bf16.safetensors",
                "weight_dtype": "default",
            },
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen_3_4b.safetensors",
                "type": "lumina2",
                "device": "default",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "ae.safetensors"},
        },
        "4": {
            "class_type": "ModelSamplingAuraFlow",
            "inputs": {"shift": 3, "model": ["1", 0]},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt_text, "clip": ["2", 0]},
        },
        "7": {
            "class_type": "ConditioningZeroOut",
            "inputs": {"conditioning": ["6", 0]},
        },
        "8": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": WIDTH, "height": HEIGHT, "batch_size": 1},
        },
        "9": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "control_after_generate": "fixed",
                "steps": 8,
                "cfg": 1,
                "sampler_name": "res_multistep",
                "scheduler": "simple",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["8", 0],
            },
        },
        "10": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["9", 0], "vae": ["3", 0]},
        },
        "11": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": prefix, "images": ["10", 0]},
        },
    }


def submit_prompt(workflow):
    payload = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFY_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"HTTP {e.code}: {body}")


def poll_history(prompt_id, timeout=120):
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = urllib.request.urlopen(f"{COMFY_URL}/history/{prompt_id}")
            data = json.loads(resp.read())
            if prompt_id in data:
                return data[prompt_id]
        except Exception:
            pass
        time.sleep(2)
    return None


def download_image(filename, subfolder, dest_path):
    url = f"{COMFY_URL}/view?filename={urllib.request.quote(filename)}&subfolder={urllib.request.quote(subfolder)}&type=output"
    urllib.request.urlretrieve(url, dest_path)


def main():
    with open(PROMPTS_FILE) as f:
        data = json.load(f)

    rooms = data["rooms"]
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Submit all jobs
    jobs = []
    for i, (room_id, room) in enumerate(rooms.items()):
        prefix = f"adventure/{room_id}"
        wf = build_workflow(room["prompt"], BASE_SEED + i, prefix)
        result = submit_prompt(wf)
        prompt_id = result["prompt_id"]
        jobs.append((room_id, prompt_id, prefix))
        print(f"  Submitted: {room_id} -> {prompt_id}")

    print(f"\n{len(jobs)} jobs queued. Polling for completion...\n")

    # Poll for completion
    completed = set()
    while len(completed) < len(jobs):
        for room_id, prompt_id, prefix in jobs:
            if prompt_id in completed:
                continue
            history = poll_history(prompt_id, timeout=5)
            if history:
                completed.add(prompt_id)
                # Find output filename
                outputs = history.get("outputs", {})
                for node_id, node_out in outputs.items():
                    images = node_out.get("images", [])
                    for img in images:
                        src_filename = img["filename"]
                        subfolder = img.get("subfolder", "")
                        dest = os.path.join(OUTPUT_DIR, f"{room_id}.png")
                        download_image(src_filename, subfolder, dest)
                        print(f"  [{len(completed)}/{len(jobs)}] {room_id}.png downloaded")
        if len(completed) < len(jobs):
            time.sleep(2)

    print(f"\nDone! {len(completed)} images saved to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
