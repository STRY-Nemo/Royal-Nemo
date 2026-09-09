# STRY Bear art prompt (15 evolution stages)

Paste this into ChatGPT (or any image model). Generate the stages one at a time, reusing the first image as the style reference so the character stays consistent. The delivered set (STRY_Bear_15_Stages_Transparent_1024.zip) is trimmed, resized to 512 px and converted to WebP as `public/bear/stage-NN.webp` plus 96 px `stage-NN-thumb.webp` thumbnails; the originals stay out of the repo to keep the site light. To replace a stage, run the same conversion (see git history for the script) or drop a 512 px transparent WebP with the same name.

## Master prompt (use once, then reference it for every stage)

> Design a single mascot character for a mobile game alliance app called STRY: a cute grizzly bear that evolves across 15 stages from a newborn cub into a fully armored, heroic "STRY Bear". Art style: clean, modern game-mascot illustration with soft cel shading, thick smooth outlines, big expressive eyes, warm brown fur (#a86a35 for cub stages, deepening to #5b3a1e by the final stages). Brand palette for gear: celestial blue #168cff, cyan highlights #6fd3ff, silver armor #c9d6ea, gold accents #ffd166, deep navy shadows #07111f. Pose: front-facing, centered, standing or sitting, full body visible, looking at the viewer, friendly and a little mischievous. Composition: square 1024×1024, character fills about 80% of the frame, **fully transparent background**, no ground shadow, no text, no border, no watermark. The same character must be recognisable in every stage; only size, build, expression and gear change.

## Stage prompts (one image each)

Use: "Same character and style as the STRY Bear reference. Stage N of 15: …"

1. **Newborn Cub** — tiny round cub sitting, oversized head, sleepy half-open eyes, tiny paws, no gear.
2. **Curious Cub** — eyes wide open, head tilted, one ear up, sniffing at a floating firefly.
3. **Playful Cub** — tumbling mid-roll, paws in the air, big grin, a tiny blue leaf stuck on its head.
4. **Young Bear** — standing on two legs for the first time, wobbly, arms out for balance, proud smile.
5. **Scrappy Bear** — slightly bigger, boxing stance, small scratch on one cheek, determined eyes.
6. **Forager** — holding a wooden basket of blueberries and honeycomb, leaves in fur, content look.
7. **Bruiser** — broader shoulders, first gear: a celestial-blue STRY scarf around the neck, confident.
8. **Guardian** — sitting upright at attention holding a simple wooden shield with a small star sigil.
9. **Warden** — leather straps across the chest, wrapped paws, a canyon-worn look, steady gaze.
10. **Sentinel** — first silver armor chest plate with a blue star emblem, standing tall.
11. **Ironhide** — plated flanks and shoulder guards, faint blue glow along the armor seams.
12. **Warbear** — large pauldrons, a single stripe of blue war-paint across the muzzle, roaring softly.
13. **Champion** — crested silver helmet with a celestial-blue plume, full chest plate, gauntlets.
14. **Alpha** — full plate armor with glowing gold star sigil on the chest, a blue cape, heroic stance.
15. **STRY Bear (legend)** — the final form: majestic armored grizzly, ornate silver-and-blue plate with gold trim, star sigil blazing, cape flowing, subtle cyan aura around the body, epic but still friendly.

## Checks before dropping the files in

- Every file is a PNG with a transparent background (no white or checkerboard baked in).
- Square, at least 512×512; 1024×1024 is ideal.
- The bear faces the viewer and is centered so the tap ring around it looks right.
- File names exactly `stage-01.png` to `stage-15.png`.
