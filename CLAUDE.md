# Roofing Lift Simulator

A playable web demo of Hanne's roofing lift HMI. You drive the truck in a 3D world, use every HMI feature, and run into every alert as it happens.

## Sources of truth

- **Logic and flows:** `docs/CONTEXT.md` (exported from the Claude doc "Roofing Project Context, Design, and Logic"). What happens, in what order, and why. If code and this file disagree, this file wins.
- **Looks:** Figma file `OL8qZdwHMkHxw9qE9Iv7OR` ("My Personal Roofing Proj"). Colors, spacing, components, toasts, map, screens.
  - Simulator Screen section: node `40000404:13511`
  - High Fidelity page holds every HMI flow. Ask Hanne for a section link instead of reading the whole page.
- Read Figma one section or frame at a time. The file is big.

## Stack

- Vite + React + TypeScript
- React Three Fiber + drei for the 3D world
- XState (or a simple reducer) for each HMI flow. One state machine per flow, named like the doc (LMI, Outriggers, Pick a spot, Wire acquiring, Material run, Ascend, Retract, Power).
- Zustand for shared simulator state (truck position, boom, load, tilt, mode)
- Design tokens pulled from Figma variables into `src/tokens/`. Never hard code a color or spacing value.
- Fonts: Be Vietnam Pro for words, Roboto Mono for numbers

## Simulator rules

- Desktop only. 1920 x 1080 layout. Keyboard and mouse.
- The 3D view fills the screen. The HMI is 2D, in a tablet frame on the right (768px wide at 1920). It shows when the operator is in the truck or holding the tablet. It closes when they walk without it.
- The HMI works with the mouse. Physical controls use keys (see the Simulator plan in `docs/CONTEXT.md`).
- Alerts fire from real distance and tilt in the 3D world, not scripted triggers. This covers the heat map, object detection, uneven ground, overweight load and LMI.
- Placeholder limits until the industrial designer confirms: 1,000 LB max load, 9° max tilt.
- Password is 1117. Tapping Unlock with no PIN also works.
- Start with simple shapes for the truck, house and obstacles. Real models (.glb) come later from the industrial designer.

## Syncing design changes

`docs/CONTEXT.md` ends with a "Changes for code" list. When Hanne says "sync":

1. Read the "Changes for code" list.
2. Open each linked Figma frame and the matching section of `docs/CONTEXT.md`.
3. Update the code.
4. Move each finished item to `docs/CHANGELOG.md` with the date.
5. Tell Hanne what changed in a few plain lines and how to check it.

## Working with Hanne

- She is a UX designer, not an engineer. Explain in plain language, short sentences, no jargon without a quick meaning.
- Build one small step at a time. After each step, tell her what to look at in the browser.
- Ask before big choices (new libraries, changing the folder layout, anything that changes a flow's logic).
- If a flow in the doc is unclear or marked "still open", ask instead of guessing.
- Keep the site private until Hanne confirms Crown is OK with it being public.

## Publishing

- Code lives on GitHub. Vercel publishes the site on every push to `main` and makes a preview link for other branches.
