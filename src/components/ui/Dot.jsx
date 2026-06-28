export const Dot = ({ on, warn }) => (
  <span
    className={`inline-block w-1.5 h-1.5 shrink-0 status-pulse ${warn ? 'bg-red-500' : on ? 'bg-green-500' : ''}`}
    style={{
      background: warn ? 'var(--cad-danger)' : on ? 'var(--cad-success)' : 'var(--cad-text-lo)',
      boxShadow:  warn ? '0 0 5px var(--cad-danger)' : on ? '0 0 5px var(--cad-success)' : 'none',
    }}
  />
)
