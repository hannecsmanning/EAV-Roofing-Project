# Roofing Lift Simulator

A playable demo of the roofing lift HMI. Drive the truck in 3D, use every HMI feature, and run into every alert.

## Run it on your computer

1. Open Terminal in this folder.
2. Run `npm install` (first time only).
3. Run `npm run dev` and open the link it shows.

## Controls right now

- 1, 2, 3: Drive, Operate, Forks
- 4: get in or out
- W A S D: drive the truck (Drive mode)
- K: show or hide the Controls panel

## Where things live

- `CLAUDE.md`: instructions for Claude Code
- `docs/CONTEXT.md`: all the flows and logic
- `src/scene/`: the 3D world
- `src/hmi/`: the HMI tablet screens
- `src/ui/`: mode chip, Controls panel
- `src/tokens/`: colors and spacing from Figma
