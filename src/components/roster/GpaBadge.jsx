export function GpaBadge({ label, hex, value, gradedCount, totalCount }) {
  const gpaFloat = value !== null && value !== undefined ? parseFloat(value) : null

  const colorStyle = gpaFloat === null
    ? 'var(--cad-text-lo)'
    : gpaFloat >= 8 ? 'var(--cad-success)'
    : gpaFloat >= 6 ? 'var(--cad-accent)'
    : 'var(--cad-danger)'

  const glowClass = gpaFloat === null ? ''
    : gpaFloat >= 8 ? 'glow-success'
    : gpaFloat >= 6 ? 'glow-accent'
    : 'glow-danger'

  const rankLabel = gpaFloat === null ? null
    : gpaFloat >= 9 ? 'DISTINGUISHED'
    : gpaFloat >= 8 ? 'FIRST CLASS'
    : gpaFloat >= 6 ? 'SECOND CLASS'
    : 'PASS'

  return (
    <div
      className="shrink-0 px-2 py-2 panel-chamfer-sm"
      style={{ border: '1px solid var(--cad-border)', background: 'var(--cad-bg-input)' }}
    >
      <div className="flex justify-between items-center mb-1">
        <span style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)' }}>
          {label}
        </span>
        {hex && (
          <span className="hex-val" style={{ color: 'var(--cad-hex-color)', fontSize: '10px', fontFamily: 'var(--cad-font-mono)' }}>{hex}</span>
        )}
      </div>

      {value !== null && value !== undefined ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className={glowClass} style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '24px', lineHeight: 1, color: colorStyle }}>
              {value}
            </span>
            <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-lo)' }}>/ 10.0</span>
            {rankLabel && (
              <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-mid)', marginLeft: 'auto' }}>
                {rankLabel}
              </span>
            )}
          </div>
          {gradedCount !== undefined && (
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)', marginTop: '4px' }}>
              {gradedCount}/{totalCount} GRADES RECORDED
            </div>
          )}
        </>
      ) : (
        <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-lo)' }}>
          AWAITING GRADE INPUT
        </div>
      )}
    </div>
  )
}
