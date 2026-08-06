import { useState } from 'react';
import { getSupabase } from '../data/supabaseClient';
import { API } from '../data/api';
import { useAuth } from '../hooks/useAuth.jsx';
import { ConfirmDeleteButton } from './ui/ConfirmDeleteButton.jsx';

export function Auth() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);


  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    if (password.length < 8) {
      setError('PASSWORD MUST BE AT LEAST 8 CHARACTERS');
      setLoading(false);
      return;
    }
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data?.user?.identities?.length === 0) {
        setError('USER ALREADY REGISTERED. PLEASE AUTHENTICATE INSTEAD.');
      } else if (data?.user && !data?.session) {
        setMessage('CONFIRMATION EMAIL SENT. PLEASE CHECK YOUR INBOX.');
      } else if (data?.session) {
        await API.syncFromServer(data.session.user.id);
      }
    } catch (err) {
      setError(err?.message || 'SYNC FAILED. PLEASE RETRY.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message === 'Invalid login credentials') {
          setError('THERE EXISTS NO ACCOUNT WITH THAT EMAIL (OR INVALID PASSWORD). PLEASE INITIALIZE FIRST.');
        } else {
          setError(error.message);
        }
      } else if (data?.session) {
        await API.syncFromServer(data.session.user.id);
      }
    } catch (err) {
      setError(err?.message || 'SYNC FAILED. PLEASE RETRY.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = await getSupabase();
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
        <ConfirmDeleteButton
          onConfirm={handleLogout}
          label="DISCONNECT (SIGN OUT)"
          confirmLabel="CONFIRM WIPE?"
          className="py-2 panel-chamfer-sm mt-2"
          style={{
            border:     '1px solid var(--cad-danger)',
            color:      'var(--cad-danger)',
            background: 'transparent',
          }}
        />
        <button 
          onClick={async () => {
            const supabase = await getSupabase();
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
      {message && (
        <div className="p-2 text-center panel-chamfer-sm" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-success)', border: '1px solid var(--cad-success)', background: 'transparent' }}>
          {message.toUpperCase()}
        </div>
      )}
      <form className="flex flex-col gap-3" onSubmit={handleLogin}>
        <input
          type="email"
          autoComplete="email"
          aria-label="Email"
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
          }}
        />
        <input
          type="password"
          autoComplete="current-password"
          aria-label="Password"
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
          }}
        />
        <div className="flex gap-2 mt-2">
          <button 
            type="submit"
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
            type="button"
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
      </form>
    </div>
  );
}
