import React, { useState, useEffect } from 'react';
import { Auth } from '../Auth.jsx';
import { Modal } from './Modal.jsx';

export function SyncChip({ className, style }) {
  const [status, setStatus] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    let timeout;
    const handleSync = (e) => {
      setStatus(e.detail);
      // Storage failures stick until a write succeeds — they mean an edit was
      // just lost, and 2.5s of "STORAGE FULL" is not a chance to act on it.
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
    if (status === 'storage-full') return 'STORAGE FULL';
    if (status === 'storage-error') return 'SAVE FAILED';
    return 'CLOUD SYNC';
  };
  const storageFailed = status === 'storage-full' || status === 'storage-error'

  return (
    <>
      <button
        type="button"
        onClick={() => setShowAuth(true)}
        aria-label={
          status === 'storage-full'
            ? 'Local storage is full — the last edit was not saved. Export a backup from settings, then clear old data.'
            : status === 'storage-error'
              ? 'The last edit could not be saved to local storage.'
              : 'Cloud sync'
        }
        className={`flex items-center justify-center gap-1.5 panel-chamfer-sm btn-mech tap-grow ${className || 'px-2.5 py-1.5'}`}
        style={{
          border:       (status === 'error' || storageFailed) ? '1px solid var(--cad-danger)' : '1px solid var(--cad-border)',
          color:        (status === 'error' || storageFailed) ? 'var(--cad-danger)' : 'var(--cad-text-mid)',
          background:   (status === 'error' || storageFailed) ? 'var(--cad-danger-dim)' : 'transparent',
          fontFamily:   'var(--cad-font-mono)',
          // Was a hardcoded 9px — under the 10px floor the type scale sets, on
          // a real control carrying the sync state.
          fontSize:     'var(--cad-fs-micro)',
          letterSpacing:'var(--cad-track-wide)',
          borderRadius: 'var(--cad-radius)',
          transition:   'opacity 0.15s, color 0.15s',
          ...style
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
