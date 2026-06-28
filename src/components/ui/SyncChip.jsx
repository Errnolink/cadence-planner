import React, { useState, useEffect } from 'react';
import { Auth } from '../Auth.jsx';
import { Modal } from './Modal.jsx';

export function SyncChip() {
  const [status, setStatus] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    let timeout;
    const handleSync = (e) => {
      setStatus(e.detail);
      if (e.detail === 'success' || e.detail === 'error') {
        clearTimeout(timeout);
        timeout = setTimeout(() => setStatus(null), 2500);
      }
    };

    window.addEventListener('cadence-sync', handleSync);
    return () => {
      window.removeEventListener('cadence-sync', handleSync);
      clearTimeout(timeout);
    };
  }, []);

  const getStatusContent = () => {
    if (status === 'syncing') return <><span className="animate-pulse" style={{ color: 'var(--cad-accent)' }}>●</span> SYNCING</>;
    if (status === 'success') return 'SYNCED';
    if (status === 'error') return 'SYNC FAILED';
    return 'CLOUD SYNC';
  };

  return (
    <>
      <button
        onClick={() => setShowAuth(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 panel-chamfer-sm btn-mech"
        style={{
          border:       status === 'error' ? '1px solid var(--cad-danger)' : '1px solid var(--cad-border)',
          color:        status === 'error' ? 'var(--cad-danger)' : 'var(--cad-text-mid)',
          background:   status === 'error' ? 'var(--cad-danger-dim)' : 'transparent',
          fontFamily:   'var(--cad-font-mono)',
          fontSize:     '9px',
          letterSpacing:'0.15em',
          borderRadius: 'var(--cad-radius)',
          transition:   'all 0.15s',
        }}
      >
        {getStatusContent()}
      </button>

      {showAuth && (
        <Modal title="CLOUD SYNC" hex="0xC001" onClose={() => setShowAuth(false)}>
           <Auth />
        </Modal>
      )}
    </>
  );
}
