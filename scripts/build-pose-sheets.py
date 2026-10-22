#!/usr/bin/env python3
"""Build the kiri/tori pose sprite strips from the source art in art/src/.

    python3 scripts/build-pose-sheets.py        (npm run build:poses)

Dev-only (Pillow + numpy + scipy: `pip install -r scripts/requirements-art.txt`);
the outputs are committed, so neither the app nor `npm install` needs Python. Outputs:
  svg/<set>_noeye.png            idle art (blank eyes; the renderer adds pupils)
  svg/<set>_<state>.png          one horizontal strip of equal cells per state
  renderer/pose-manifest.js      window.POSE_MANIFEST: cell geometry, frame
                                 groups and the pupil positions per set

Every image of a set shares ONE coordinate system: the idle canvas. Standing
poses are scaled to the idle size and put feet-on-the-floor at the idle feet;
the drag ("move") poses hang from the idle head top and may run past the idle
canvas bottom (the renderer lets them overflow). The source sheets were drawn
at different scales, so each sheet is normalised by a body feature that keeps
its size across poses (kiri: the bow, tori: the red nose).
"""
import base64
import json
import os

try:
    import numpy as np
    from PIL import Image
    from scipy import ndimage
except ImportError as err:  # dev-only tool: say how to get its deps
    raise SystemExit(
        f"build-pose-sheets: missing Python package ({err.name}).\n"
        "Install the art-tool deps once:  python3 -m pip install -r scripts/requirements-art.txt")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "art", "src")
OUT_IMG = os.path.join(ROOT, "svg")
OUT_JS = os.path.join(ROOT, "renderer", "pose-manifest.js")

# Final pixels per source-sheet pixel. The 3x3 sheets are ~400px per cell;
# 1.5x keeps them sharp at retina pet sizes without blowing up file size.
SHEET_UPSCALE = 1.5
PAD = 6  # transparent margin around each cell
# Bump whenever the idle art changes shape: painted pixel overlays are stamped
# with the revision they were drawn on, and stale ones are not composited.
ART_REV = 2

# Which 3x3 cells (row, col) become which state. Groups inside "move":
#   hang = held still (slow dangle loop), side = dragged sideways (drawn moving
#   LEFT; the renderer mirrors it for rightward drags).
SETS = {
    "kiri": {
        "feature": "bow",
        "idle": "kiri_idle_noeye.png",
        "eyes": "kiri_idle_eyes.png",
        "sheets": {"hang": "kiri_hang_sheet.png", "work": "kiri_work_sheet.png"},
        # front-facing cells whose bow is fully visible → scale reference
        "ref": {"hang": [(0, 0), (0, 1), (0, 2)], "work": [(0, 0), (1, 1), (2, 1), (2, 2)]},
        "states": {
            "move": {"sheet": "hang", "groups": {
                "hang": [(0, 0), (0, 1), (0, 2)],
                "side": [(1, 0), (1, 1), (1, 2)]}},
            "working": {"sheet": "work", "cells": [(0, 0), (0, 1), (2, 0), (2, 2)]},
            "listening": {"sheet": "work", "cells": [(1, 1)]},
            "happy": {"sheet": "work", "cells": [(1, 2)]},
        },
    },
    "tori": {
        "feature": "nose",
        "idle": "tori_idle_noeye.png",
        "eyes": "tori_idle_eyes.png",
        "sheets": {"hang": "tori_hang_sheet.png", "work": "tori_work_sheet.png"},
        "ref": {"hang": [(0, 0), (1, 1), (2, 2)], "work": [(0, 0), (1, 1), (2, 0), (2, 2)]},
        "states": {
            "move": {"sheet": "hang", "groups": {
                "hang": [(1, 1), (0, 0)],
                "side": [(0, 1), (1, 2)]}},
            "working": {"sheet": "work", "cells": [(0, 0), (1, 1), (1, 2), (0, 2)]},
            "listening": {"sheet": "work", "cells": [(2, 0)]},
            "happy": {"sheet": "work", "cells": [(1, 0)]},
        },
    },
}


def load(name):
    return Image.open(os.path.join(SRC, name)).convert("RGBA")


def remove_white_bg(im):
    """The tori sheets come on a partly opaque white page (with a thin
    screenshot frame); harmless on already-transparent sheets. Key out light, unsaturated pixels connected to the border — the
    character's own whites (eyes, belly) sit inside its dark outline, so the
    flood never reaches them. Edge pixels get alpha from their darkness."""
    a = np.array(im).astype(np.int32)
    rgb = a[..., :3]
    light = ((rgb.min(-1) > 150) & ((rgb.max(-1) - rgb.min(-1)) < 70)) | (a[..., 3] < 24)
    lab, _ = ndimage.label(light)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    alpha = np.where(bg, 0, a[..., 3])
    edge = ndimage.binary_dilation(bg) & ~bg
    lum = rgb.mean(-1)
    soft = np.clip((235 - lum) / (235 - 120), 0, 1) * 255
    alpha = np.where(edge, np.minimum(alpha, soft), alpha)
    a[..., 3] = alpha
    return Image.fromarray(a.astype(np.uint8))


def cells_3x3(im):
    """Split a 3x3 sheet into its characters. Poses spill over the naive grid
    lines (tails, held tufts), so group connected blobs by centroid instead."""
    a = np.array(im)
    solid = a[..., 3] > 24
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=2))
    W, H = im.size
    groups = {}
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = (lab[sl] == i) & solid[sl]
        if m.sum() < 30:
            continue
        ys, xs = np.nonzero(m)
        r = min(2, int((ys.mean() + sl[0].start) * 3 // H))
        c = min(2, int((xs.mean() + sl[1].start) * 3 // W))
        groups.setdefault((r, c), []).append((sl, i))
    out = {}
    for key, parts in groups.items():
        canvas = np.zeros_like(a)
        for sl, i in parts:
            m = lab[sl] == i
            canvas[sl][m] = a[sl][m]
        img = Image.fromarray(canvas)
        out[key] = img.crop(img.getbbox())
    return out


def feature_area(im, kind):
    """Pixel area of the largest bow (blue) / nose (red) blob."""
    a = np.array(im).astype(np.int32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    if kind == "bow":
        m = (b > r + 40) & (b > g + 20) & (al > 200)
    else:
        m = (r > g + 90) & (r > b + 90) & (al > 200)
    lab, n = ndimage.label(m)
    if not n:
        return 0
    return float(np.max(ndimage.sum(m, lab, range(1, n + 1))))


def head_width(im, frac=0.42):
    """Width of the head, which is what the eye reads as "size": the 95th
    percentile row width in the top `frac` of the silhouette, after an opening
    that strips whiskers, tail tips and pencil lines (thin strokes)."""
    al = np.array(im)[..., 3] > 128
    ys = np.nonzero(al.any(1))[0]
    r = max(2, round((ys[-1] - ys[0]) * 0.014))
    op = ndimage.binary_opening(al, structure=np.ones((2 * r + 1, 2 * r + 1)))
    lab, n = ndimage.label(op)
    if not n:
        return 0.0
    big = lab == (np.argmax(ndimage.sum(op, lab, range(1, n + 1))) + 1)
    ys = np.nonzero(big.any(1))[0]
    top, bot = ys[0], ys[-1]
    return float(np.percentile(big[top:int(top + (bot - top) * frac)].sum(1), 95))


MASK_GRID = 4      # idle-canvas px per mask cell
MASK_DILATE = 2    # cells of slack around the silhouette (whiskers, AA edges)


def hit_mask(im):
    """Coarse occupancy mask of the drawn art for the pet window's click test:
    only clicks on (or right next to) the cat are taken, everything else passes
    through to the app underneath. Row-major bits, MSB first, base64."""
    al = np.array(im)[..., 3] > 40
    h, w = al.shape
    rows, cols = -(-h // MASK_GRID), -(-w // MASK_GRID)
    pad = np.zeros((rows * MASK_GRID, cols * MASK_GRID), bool)
    pad[:h, :w] = al
    cells = pad.reshape(rows, MASK_GRID, cols, MASK_GRID).any(axis=(1, 3))
    if MASK_DILATE:
        cells = ndimage.binary_dilation(cells, iterations=MASK_DILATE)
    bits = np.packbits(cells.astype(np.uint8).ravel())
    return {"g": MASK_GRID, "w": int(cols), "h": int(rows), "b": base64.b64encode(bits.tobytes()).decode("ascii")}


def row_centroid_x(im, from_bottom, frac=0.05):
    """x centroid of the opaque pixels in the top/bottom `frac` of the art —
    the feet (standing) or the grab point (hanging)."""
    al = np.array(im)[..., 3] > 128
    ys = np.nonzero(al.any(1))[0]
    h = max(2, int((ys[-1] - ys[0]) * frac))
    band = al[ys[-1] - h:ys[-1] + 1] if from_bottom else al[ys[0]:ys[0] + h]
    return float(np.nonzero(band)[1].mean())


def scaled(im, f):
    return im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)


def pupils(noeye, eyes, box, scale, size):
    """Pupil geometry, normalised to the final idle canvas. The eyed idle art
    minus the blank-eyed one gives each pupil's size and which eye it is in;
    the pupil REST position is the centre of that eye's white (the drawn art
    looks slightly cross-eyed, and a rest point off-centre lets one pupil leave
    the eye when it drifts). Travel = how far it can drift and stay inside."""
    a = np.array(eyes).astype(np.int32)
    b = np.array(noeye).astype(np.int32)
    white = (b[..., :3].min(-1) > 200) & (b[..., 3] > 200)
    dark_new = (a[..., :3].max(-1) < 90) & white
    lab, n = ndimage.label(dark_new)
    sizes = ndimage.sum(dark_new, lab, range(1, n + 1))
    blobs = sorted(np.argsort(sizes)[-2:] + 1, key=lambda i: ndimage.center_of_mass(dark_new, lab, i)[1])
    pr = (float(sizes.max()) / np.pi) ** 0.5

    def run(line, i):  # contiguous white extent around index i
        lo = hi = i
        while lo > 0 and line[lo - 1]:
            lo -= 1
        while hi < len(line) - 1 and line[hi + 1]:
            hi += 1
        return lo, hi

    W, H = size
    res, room = [], []
    for i in blobs:
        cy, cx = (int(round(v)) for v in ndimage.center_of_mass(dark_new, lab, i))
        x0, x1 = run(white[cy], cx)
        ex = (x0 + x1) / 2
        y0, y1 = run(white[:, int(ex)], cy)
        ey = (y0 + y1) / 2
        room.append(min(x1 - x0, y1 - y0) / 2 - pr)
        res.append({"x": round(((ex - box[0]) * scale + PAD) / W, 4),
                    "y": round(((ey - box[1]) * scale + PAD) / H, 4)})
    return {"l": res[0], "r": res[1],
            "pr": round(pr * 0.85 * scale / W, 4),
            "travel": round(max(0.0, min(room)) * 0.8 * scale / W, 4)}


def build_set(name, cfg):
    idle = load(cfg["idle"])
    idle_area = feature_area(idle, cfg["feature"])
    sheets = {}
    for key, fn in cfg["sheets"].items():
        sh = load(fn)
        sh = remove_white_bg(sh)
        cells = cells_3x3(sh)
        areas = sorted(feature_area(cells[k], cfg["feature"]) for k in cfg["ref"][key])
        # median of the front-facing frames' feature → idle-pixels per sheet-pixel
        ratio = (idle_area / areas[len(areas) // 2]) ** 0.5
        sheets[key] = (cells, ratio)

    # Final scale: sheet art at SHEET_UPSCALE; the idle is brought to the same
    # body size via the "work" sheet's ratio (standing poses must match idle).
    idle_scale = SHEET_UPSCALE / sheets["work"][1]
    box = idle.getbbox()
    idle_s = scaled(idle.crop(box), idle_scale)
    W, H = idle_s.width + 2 * PAD, idle_s.height + 2 * PAD
    feet_x = PAD + row_centroid_x(idle_s, True)
    head_x = PAD + row_centroid_x(idle_s, False, 0.12)

    canvas = Image.new("RGBA", (W, H))
    canvas.paste(idle_s, (PAD, PAD))
    canvas.save(os.path.join(OUT_IMG, f"{name}_noeye.png"), optimize=True)

    manifest = {"rev": ART_REV, "w": W, "h": H, "eyes": pupils(idle, load(cfg["eyes"]), box, idle_scale, (W, H)), "states": {},
                "mask": hit_mask(canvas)}

    # Every state is scaled so its head is as wide as the idle head (on screen).
    # The bow/nose ratio above is only a sheet-level first guess: the artist drew
    # those features at different proportions per sheet, so states came out up
    # to ~15% bigger or smaller than idle and visibly "jumped" on a state change.
    # Side views read narrower, so a state uses its front-facing frames only
    # (move: the "hang" group) and applies that scale to all its frames.
    idle_head = head_width(idle.crop(box)) * idle_scale
    for state, st in cfg["states"].items():
        cells, ratio = sheets[st["sheet"]]
        groups = st.get("groups") or {"all": st["cells"]}
        front = groups.get("hang", next(iter(groups.values())))
        heads = sorted(head_width(cells[k]) for k in front)
        f = idle_head / heads[len(heads) // 2]
        print(f"  {name}_{state}: head scale {f / (SHEET_UPSCALE * (ratio / sheets['work'][1])):.3f}x vs feature ratio")
        frames, group_idx = [], {}
        for gname, keys in groups.items():
            group_idx[gname] = list(range(len(frames), len(frames) + len(keys)))
            frames += [scaled(cells[k], f) for k in keys]
        hanging = state == "move"
        if hanging:
            # Hang from the idle head top, grab point centred on the head, so a
            # horizontal mirror (rightward drag) flips about the grab point.
            anchors = [row_centroid_x(fr, False) for fr in frames]
            half = max(max(a, fr.width - a) for a, fr in zip(anchors, frames))
            cw = int(np.ceil(2 * half)) + 2 * PAD
            ch = max(fr.height for fr in frames) + 2 * PAD
            ox, oy = head_x - cw / 2, 0.0
            places = [(round(cw / 2 - a), PAD) for a in anchors]
        else:
            # Standing: feet on the idle floor, feet centred on the idle feet.
            anchors = [row_centroid_x(fr, True) for fr in frames]
            left = max(a for a in anchors) + PAD
            right = max(fr.width - a for a, fr in zip(anchors, frames)) + PAD
            cw = int(np.ceil(left + right))
            ch = max(fr.height for fr in frames) + PAD
            ox, oy = feet_x - left, float(H - PAD - (ch - PAD))
            places = [(round(left - a), ch - PAD - fr.height) for a, fr in zip(anchors, frames)]
        strip = Image.new("RGBA", (cw * len(frames), ch))
        for i, (fr, (px, py)) in enumerate(zip(frames, places)):
            strip.alpha_composite(fr, (i * cw + px, py))
        strip.save(os.path.join(OUT_IMG, f"{name}_{state}.png"), optimize=True)
        entry = {"frames": len(frames), "cw": cw, "ch": ch, "ox": round(ox, 1), "oy": round(oy, 1),
                 "masks": [hit_mask(strip.crop((i * cw, 0, (i + 1) * cw, ch))) for i in range(len(frames))]}
        if "groups" in st:
            entry["groups"] = group_idx
        manifest["states"][state] = entry
        print(f"  {name}_{state}.png  {len(frames)} frames  cell {cw}x{ch}  at ({ox:.0f},{oy:.0f})")
    print(f"  {name}_noeye.png  {W}x{H}  (sheet ratios: " +
          ", ".join(f"{k} {v[1]:.2f}" for k, v in sheets.items()) + ")")
    return manifest


def main():
    out = {}
    for name, cfg in SETS.items():
        out[name] = build_set(name, cfg)
    with open(OUT_JS, "w") as fh:
        fh.write("// AUTO-GENERATED by scripts/build-pose-sheets.py — do not edit.\n")
        fh.write("// Per set: idle canvas w/h, pupil geometry (normalised to the idle canvas)\n")
        fh.write("// and per state the strip cell size + its offset in idle-canvas pixels.\n")
        fh.write("window.POSE_MANIFEST = " + json.dumps(out, indent=1) + ";\n")
    print("renderer/pose-manifest.js written")


if __name__ == "__main__":
    main()
