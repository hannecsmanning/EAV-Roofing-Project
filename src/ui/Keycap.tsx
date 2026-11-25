export function Keycap({ label, active = false }: { label: string; active?: boolean }) {
  return <span className={active ? 'keycap keycap--active' : 'keycap'}>{label}</span>
}
