# DESIGN.md — Escape From Tartarus

## Design Read
Reading this as: Interactive Tabletop Boardgame Arena & Playtest Studio for Escape From Tartarus players (Desktop & Mobile Landscape), in a **Tartarus Obsidian & Jade Editorial Tabletop** style, dial **ENERGY 2 / RHYTHM 2 / MOTION 2**.

## Visual Identity & Motif
- **Theme Justification (R-21):** Fixed dark underworld tabletop surface (`#081113`) matches the Tartarus boardgame theme and prevents glare around vibrant illustrated character cards and glowing shard markers.
- **Identity Motif:** Matte obsidian-slate surfaces framed by quiet 1px Tartarus Jade rules, paired with mythic serif display numerals (`Playfair Display`) and crisp tabular UI statistics.
- **One Focal Point Per Screen:**
  - Title Screen: The `Escape From Tartarus` serif display lockup and primary mode choice.
  - Play Arena: The live game board in the center, with the active turn Roll CTA in Tartarus Amber as the single primary action accent.
  - Compendium & Rules: Character/rule content over quiet obsidian surfaces without decorative card-glow clutter.

## Color System (R-01, R-25, R-29 — Verified with `contrast-check.py`)
3 Core Colors + 1 Deliberate Accent (plus functional game-state semantics):

| Role | Token | Hex | Verified Contrast (WCAG AA) |
| :--- | :--- | :--- | :--- |
| Core 1: Ground Canvas | `--bg-canvas` | `#081113` | Base ground |
| Core 1: HUD Surface | `--bg-surface` | `#0f1b1f` | Solid matte foreground |
| Core 1: Elevated Surface | `--bg-elevated` | `#16252b` | Hover / modal card surface |
| Core 2: Primary Jade Action | `--jade-primary` | `#1b5440` | `#ffffff` text = **8.79:1 PASS** |
| Core 2: Pale Jade Motif | `--mint-light` | `#9fd6be` | On `#0f1b1f` = **10.72:1 PASS** |
| Core 3: Primary Ink | `--text-main` | `#eef4f1` | On `#0f1b1f` = **15.75:1 PASS** |
| Core 3: Secondary Ink | `--text-muted` | `#a5bab2` | On `#0f1b1f` = **8.58:1 PASS** |
| Accent: Tartarus Amber | `--accent-gold` | `#e5a93c` | `#0b1214` ink = **9.07:1 PASS** |
| Functional Danger | `--accent-red` | `#be123c` | `#ffffff` text = **6.29:1 PASS** |
| Functional Info | `--accent-blue` | `#1d4ed8` | `#ffffff` text = **6.70:1 PASS** |
| Functional Shard Zone | `--accent-purple` | `#6d28d9` | `#ffffff` text = **7.10:1 PASS** |
| Non-Text Border | `--mint-border` | `#4d7c6d` | On `#0f1b1f` = **3.69:1 PASS** |

## Radius & Elevation Hierarchy (R-10, R-11, R-12, R-13)
- `--radius-xs: 4px` (currency chips, compact inline tags)
- `--radius-sm: 6px` (buttons, inputs, nav tabs, utility controls)
- `--radius-md: 10px` (HUD cards, player cards, panels, drawers)
- `--radius-lg: 14px` (modals, dramatic showcase stage)
- `999px` pill radius reserved strictly for Title Screen mode CTAs and Card Activation Player Pills.
- **Glassmorphism Dose Cap (R-10):** `backdrop-filter: blur()` restricted to 2 full-screen modal/cinematic scrims only (`.skill-dramatic-overlay` and `.modal-backdrop`). All HUD panels and drawers are crisp matte surfaces.
- **Glow Dose Cap (R-13):** Reserved strictly for gameplay focus accents (active turn Roll CTA and targetable/shard board tiles).
- **Motion (R-19, R-39):** Gameplay transitions and feedback only; decorative idle loops removed; full `prefers-reduced-motion: reduce` support.
