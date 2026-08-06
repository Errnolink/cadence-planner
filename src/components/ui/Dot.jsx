export const Dot = ({ on }) => (
  <span
    className={`inline-block w-1.5 h-1.5 shrink-0 status-pulse ${on ? 'bg-green-500' : ''}`}
    style={{
      background: on ? 'var(--cad-success)' : 'var(--cad-text-lo)',
      boxShadow:  on ? '0 0 5px var(--cad-success)' : 'none',
    }}
  />
)
