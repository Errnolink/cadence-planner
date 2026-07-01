import React, { useState } from 'react';
import { supabase } from '../data/supabaseClient';
import { API } from '../data/api';
import { useAuth } from '../hooks/useAuth.jsx';

export function Auth() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);


  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else if (data?.session) {
      await API.syncFromServer(data.session.user.id);
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else if (data?.session) {
      await API.syncFromServer(data.session.user.id);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    API.clearLocalData();
    window.location.reload(); // Reload to reset state to local
  };

  if (session) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-text-mid)', borderBottom: '1px solid var(--cad-border-dim)', paddingBottom: '8px' }}>
          CONNECTED AS: <span style={{ color: 'var(--cad-text-hi)' }}>{session.user.email}</span>
        </div>
        <button 
          onClick={handleLogout}
          className="py-2 btn-mech panel-chamfer-sm mt-2"
          style={{
            fontFamily:   'var(--cad-font-mono)',
            fontSize:     '10px',
            letterSpacing:'0.15em',
            border:       '1px solid var(--cad-danger)',
            color:        'var(--cad-danger)',
            background:   'transparent',
          }}
        >
          DISCONNECT (SIGN OUT)
        </button>
        <button 
          onClick={async () => {
            await supabase.auth.signOut({ scope: 'others' });
            // No reload needed — we stay logged in on this device
          }}
          className="py-2 btn-mech panel-chamfer-sm"
          style={{
            fontFamily:   'var(--cad-font-mono)',
            fontSize:     '10px',
            letterSpacing:'0.15em',
            border:       '1px solid var(--cad-border)',
            color:        'var(--cad-text-mid)',
            background:   'transparent',
          }}
        >
          SIGN OUT ALL OTHER DEVICES
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {error && (
        <div className="p-2 text-center panel-chamfer-sm" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-danger)', border: '1px solid var(--cad-danger)', background: 'var(--cad-danger-dim)' }}>
          {error.toUpperCase()}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="EMAIL IDENTIFIER"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 panel-chamfer-sm"
          style={{
            fontFamily:  'var(--cad-font-mono)',
            fontSize:    '10px',
            background:  'var(--cad-bg-input)',
            border:      '1px solid var(--cad-border)',
            color:       'var(--cad-text-hi)',
            outline:     'none',
          }}
        />
        <input
          type="password"
          placeholder="ACCESS CODE (PASSWORD)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 panel-chamfer-sm"
          style={{
            fontFamily:  'var(--cad-font-mono)',
            fontSize:    '10px',
            background:  'var(--cad-bg-input)',
            border:      '1px solid var(--cad-border)',
            color:       'var(--cad-text-hi)',
            outline:     'none',
          }}
        />
        <div className="flex gap-2 mt-2">
          <button 
            onClick={handleLogin} 
            disabled={loading}
            className="flex-1 py-2 btn-mech panel-chamfer-sm"
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     '10px',
              letterSpacing:'0.15em',
              border:       '1px solid var(--cad-accent)',
              color:        'var(--cad-bg-primary)',
              background:   'var(--cad-accent)',
              fontWeight:   'bold'
            }}
          >
            {loading ? '...' : 'AUTHENTICATE'}
          </button>
          <button 
            onClick={handleSignUp} 
            disabled={loading}
            className="flex-1 py-2 btn-mech panel-chamfer-sm"
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     '10px',
              letterSpacing:'0.15em',
              border:       '1px solid var(--cad-border)',
              color:        'var(--cad-text-mid)',
              background:   'var(--cad-bg-elevated)',
            }}
          >
            {loading ? '...' : 'INITIALIZE'}
          </button>
        </div>
      </div>
    </div>
  );
}
