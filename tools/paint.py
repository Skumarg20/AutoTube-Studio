"""Paint original scene backgrounds on the CPU (Intel OpenVINO + Latent Consistency Model, the FastSD CPU approach).

    python tools/paint.py jobs.json
jobs.json: [{"prompt": "...", "out": "C:/.../bg_ab12.jpg", "w": 576, "h": 1024}, ...]
Model: OpenVINO/LCM_Dreamshaper_v7-int8-ov (Dreamshaper v7 under CreativeML OpenRAIL-M; LCM distilled, 4 steps).
Every image is painted only once: an existing "out" file is skipped. Prints one JSON line at the end.
"""
import json, os, sys, time

STYLE = ("1980s hand-painted cel anime background art, gouache painting, rich saturated colours, soft film grain, "
         "cinematic lighting, detailed, eye-level wide shot with open flat floor in the lower third, empty scene, "
         "no people, no characters, no text, no letters, no logos")


def main():
    jobs = [j for j in json.load(open(sys.argv[1], encoding="utf-8")) if not os.path.exists(j["out"])]
    if not jobs:
        print(json.dumps({"ok": True, "painted": 0})); return
    import transformers
    try:   # renamed in newer transformers; the model's config still uses the old name
        transformers.CLIPFeatureExtractor = transformers.CLIPImageProcessor
    except Exception:
        pass
    from optimum.intel import OVLatentConsistencyModelPipeline
    t0 = time.time()
    pipe = OVLatentConsistencyModelPipeline.from_pretrained(os.environ.get("HS_PAINT_MODEL", "OpenVINO/LCM_Dreamshaper_v7-int8-ov"), ov_config={"CACHE_DIR": ""}, compile=False, feature_extractor=None, safety_checker=None)
    # the OpenVINO export's UNet config lost time_cond_proj_dim (256 for LCM Dreamshaper v7); newer diffusers needs it
    cfg = pipe.unet.config
    if getattr(cfg, "time_cond_proj_dim", None) is None:
        try: cfg.time_cond_proj_dim = 256
        except Exception: cfg["time_cond_proj_dim"] = 256
    shapes = {}
    for k, j in enumerate(jobs):
        w, h = int(j.get("w", 576)) // 64 * 64, int(j.get("h", 1024)) // 64 * 64
        if shapes.get("cur") != (w, h):
            pipe.reshape(batch_size=1, height=h, width=w, num_images_per_prompt=1); pipe.compile(); shapes["cur"] = (w, h)
        t1 = time.time()
        img = pipe(prompt=f"{j['prompt']}, {STYLE}", width=w, height=h, num_inference_steps=4, guidance_scale=8.0).images[0]
        os.makedirs(os.path.dirname(j["out"]), exist_ok=True)
        img.convert("RGB").save(j["out"], quality=92)
        print(f"painted {k + 1}/{len(jobs)} in {time.time() - t1:.1f}s: {j['prompt'][:60]}", file=sys.stderr, flush=True)
    print(json.dumps({"ok": True, "painted": len(jobs), "seconds": round(time.time() - t0, 1)}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:400]})); sys.exit(1)
