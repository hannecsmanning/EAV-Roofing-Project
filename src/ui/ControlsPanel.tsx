import { Fragment } from 'react'
import { useSim, type Mode } from '../store'
import { Keycap } from './Keycap'
import { canSwitchFromRoof } from '../flows/outriggers'

// Key list comes from the Simulator plan in docs/CONTEXT.md and the Figma Controls panel.
type Row = { keys: string[]; label: string }

const modeKeys: Record<Mode, { title: string; rows: Row[] }> = {
  drive: {
    title: 'Drive mode keys',
    rows: [
      { keys: ['W', 'A', 'S', 'D'], label: 'Drive the truck' },
      { keys: ['Tab'], label: 'Next speed' },
      { keys: ['Q', 'E'], label: 'Turn left and right' },
      { keys: ['W'], label: 'Hold: joystick forward' },
      { keys: ['G'], label: 'Wire button' },
      { keys: ['O'], label: 'Outrigger switch' },
      { keys: ['9'], label: 'Ascend to ledge' },
      { keys: ['0'], label: 'Descend (retract machine)' },
      { keys: ['P'], label: 'Start button' },
      { keys: ['H'], label: 'Take off or put back tablet' },
    ],
  },
  operate: {
    title: 'Operate mode keys',
    rows: [
      { keys: ['W', 'A', 'S', 'D'], label: 'Move the cab' },
      { keys: ['↑', '↓'], label: 'Cab up and down' },
      { keys: ['W'], label: 'Hold: joystick forward' },
      { keys: ['B'], label: 'LMI button' },
      { keys: ['P'], label: 'Start button' },
      { keys: ['O'], label: 'Outrigger switch' },
      { keys: ['9'], label: 'Ascend to ledge' },
      { keys: ['0'], label: 'Descend (retract machine)' },
      { keys: ['H'], label: 'Take off or put back tablet' },
    ],
  },
  forks: {
    title: 'Forks keys',
    rows: [
      { keys: ['↑', '↓'], label: 'Forks up and down' },
      { keys: ['W'], label: 'Extend forks' },
      { keys: ['S'], label: 'Retract forks' },
      { keys: ['L'], label: 'Pick up or drop load' },
    ],
  },
  walking: {
    title: 'Walking keys',
    rows: [
      { keys: ['W', 'A', 'S', 'D'], label: 'Walk' },
      { keys: ['4'], label: 'Get in the machine' },
      { keys: ['Space'], label: 'Talk (roofer or foreman)' },
    ],
  },
}

// Looking around the 3D view (cameraView.ts). Works in every mode.
const viewKeys = [
  { key: 'Drag', label: 'Look around' },
  { key: 'Scroll', label: 'Zoom' },
  { key: 'C', label: 'Reset view' },
]

const modeList: { key: string; mode: Mode; label: string }[] = [
  { key: '1', mode: 'drive', label: 'Drive' },
  { key: '2', mode: 'operate', label: 'Operate' },
  { key: '3', mode: 'forks', label: 'Forks' },
  { key: '4', mode: 'walking', label: 'Get in or out' },
]

export function ControlsPanel() {
  const { mode, controlsOpen } = useSim()

  if (!controlsOpen) {
    return (
      <div className="controls controls--folded">
        <span className="controls__title">Controls</span>
        <Keycap label="K" />
        <span className="controls__hint">Show</span>
      </div>
    )
  }

  const current = modeKeys[mode]
  // On the roof with the dismounted tablet, the outrigger switch works too.
  const rows = canSwitchFromRoof(useSim.getState()) ? [...current.rows, { keys: ['O'], label: 'Outrigger switch' }] : current.rows
  return (
    <div className="controls">
      <div className="controls__header">
        <span className="controls__title">Controls</span>
        <Keycap label="K" />
        <span className="controls__hint">Hide</span>
      </div>
      <div className="controls__body">
        <div className="controls__col">
          <div className="controls__label">Mode</div>
          {modeList.map((m) => (
            <div className="controls__row" key={m.key}>
              <Keycap label={m.key} active={m.mode === mode} />
              <span>{m.label}</span>
            </div>
          ))}
          <div className="controls__label controls__label--gap">View</div>
          {viewKeys.map((v) => (
            <div className="controls__row" key={v.key}>
              <Keycap label={v.key} />
              <span>{v.label}</span>
            </div>
          ))}
        </div>
        <div className="controls__divider" />
        <div className="controls__col controls__col--grid">
          <div className="controls__label controls__span">{current.title}</div>
          {rows.map((r, i) => (
            <Fragment key={i}>
              <span className="controls__keys">
                {r.keys.map((k) => (
                  <Keycap key={k} label={k} />
                ))}
              </span>
              <span>{r.label}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
