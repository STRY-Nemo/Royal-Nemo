# STRY app art pack: prompts and drop-in slots

Every asset below has a fixed file name. Drop the PNG into `public/art/` (bear stages go in `public/bear/`, see `docs/BEAR_ART_PROMPT.md`), push, and the app shows it. Until a file exists the slot is simply empty, so you can add them one at a time.

## Shared style prompt (paste this first, then each asset prompt)

> Art direction for the STRY alliance app (Last Z: Survival Shooter alliance organizer). Mood: celestial night sky over a post-apocalyptic canyon; calm, premium, slightly heroic. Palette: deep navy background #07111f, card navy #101f33, celestial blue #168cff, cyan glow #6fd3ff, silver #c9d6ea, soft gold accent #ffd166, warm off-white #f4f7fc. Style: clean modern game-UI illustration, soft cel shading, subtle volumetric light, thin star particles, no photo realism, no text, no watermark, no logos other than a simple four-point star sigil. Compositions must keep the center-bottom area quiet so app text can sit over or under them.

## Banners (3:1, 1536×512, opaque, dark)

Used at the top of a screen as a wide strip with rounded corners.

| File | Prompt |
| --- | --- |
| `home-hero.png` | Wide panoramic banner: a canyon rim at night under a huge starry sky with a faint blue aurora, a small campfire glow in the distance, silhouette of a bear cub sitting on the ridge looking at the stars. Dark, atmospheric, lots of empty sky. |
| `canyon-banner.png` | Wide banner of the Canyon Clash arena: two cliff walls facing each other across a narrow canyon, a bridge of blue light between them, twenty tiny warrior silhouettes on each side, dust and star particles. Balanced left/right, no text. |
| `organize-banner.png` | Wide banner of a war room table seen from above at an angle: a glowing blue holographic map of the canyon, small silver markers and lines connecting roles, a few scattered star sigils. Dark navy, cool light. |
| `members-banner.png` | Wide banner of an alliance gathering: a long line of diverse warrior silhouettes standing shoulder to shoulder on a ridge at night, backlit by a rising blue moon, silver-edged, feeling of unity. |
| `login-hero.png` | Wide banner of a lone sentinel tower on a cliff at night with a single blue beacon light, stars, a shooting star streaking across. Serene, welcoming, dark. |

## Emblems and icons (square, transparent PNG)

| File | Size | Prompt |
| --- | --- | --- |
| `team-1-emblem.png` | 512×512 | Team emblem: a silver shield with a rising sun in celestial blue and the roman numeral I, thin gold trim, subtle star sigil, transparent background, flat clean game-badge style. |
| `team-2-emblem.png` | 512×512 | Team emblem: a silver shield with a crescent moon in cyan and the roman numeral II, thin gold trim, subtle star sigil, transparent background, matching the Team 1 badge exactly in shape and style. |
| `den-backdrop.png` | 1024×1024 | Cozy bear den interior at night: a rock cave mouth opening onto a starry sky, a pile of soft blue-grey blankets, a honey pot and a fish basket by the entrance, warm ember glow on the left, cool starlight on the right. Keep the center empty for the bear. |
| `empty-canyon.png` | 512×512 | Small friendly illustration: an empty canyon arena with a lone flag planted in the middle under a starry sky, transparent background. Used when no event exists. |
| `empty-members.png` | 512×512 | Small friendly illustration: a bear cub holding an empty clipboard, transparent background. |

## App icon and splash (replace the existing files, same names)

| File | Size | Prompt |
| --- | --- | --- |
| `public/brand/stry-logo.png` | 1024×1024 | App icon: a bold four-point celestial star in silver with a blue glow, set inside a rounded navy square with a faint canyon horizon at the bottom. No text. Must read clearly at 48 px. |
| `public/brand/icon-192.png` | 192×192 | The same icon rendered small. |

## Feeding items (optional, transparent 256×256, `public/art/food-*.png`)

`food-honey.png` (honey pot), `food-fish.png` (blue fish), `food-berries.png` (blueberry cluster), `food-meat.png` (cartoon drumstick), `food-carrot.png`: chunky, glossy game-item icons with a thin dark outline and a small highlight, same style as the bear, transparent background. The app currently uses emoji for these; if the files appear they can replace them in a later pass.

## Checks

- PNG only. Banners opaque and dark so white text stays readable; emblems, empty-state and food items transparent.
- Keep faces and key details away from the outer 10% of banners (rounded corners crop them).
- Generate the two team emblems in one session so they match.

## Full-screen background

- `app-background.jpg` — portrait 1080×1920 (or 9:16), JPEG, dark. Rendered behind every screen at 55% opacity with a soft fade toward the bottom; cards blur what is behind them. Keep the top third the most detailed (sky, moon, star) and the lower two-thirds dark and quiet so lists stay readable.

## Theme backgrounds (portrait JPG, `public/art/themes/<id>.jpg`)

The Theme button on Home (and Settings → Theme) lets each person pick a background and matching colours. The ten "STRY Mobile Wallpapers" are in place (941×1672, JPG ~300 KB each): `rose-nebula`, `jedi-sanctuary`, `sith-eclipse`, `leviathan-depths`, `solar-phoenix`, `frost-crown`, `neon-ronin`, `emerald-dream`, `astral-dunes`, `event-horizon`, plus the original `app-background.jpg` as Canyon Night.

To add another theme: save a portrait JPG (9:16 to 9:19.5, under ~450 KB) as `public/art/themes/<id>.jpg`, add a row to `THEMES` in `src/ui/theme.ts` (id, label, blurb, two swatch colours) and a `[data-theme='<id>']` block in `src/styles/tokens.css` with its colours (background, card, raised, border, primary, focus). Keep the top third of the image quieter, since headers sit there, and avoid pure white areas because cards are see-through.

## Sound effects (`public/sfx/`)

| File | Used by |
| --- | --- |
| `sfx/fart.mp3` | The bear's "toot" reaction (from Nemo's Flappy Adventure). Until the file exists a synthesized wet toot plays. Keep it under 100 KB, mono, about half a second. |

Settings → Motion has a "Bear sound effects" switch (per phone).
