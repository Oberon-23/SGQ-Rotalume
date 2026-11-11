import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { cloudConfigured, resetPassword, signIn, signUp } from '../data/cloud';

/** Entrar com conta (Supabase). A demonstração continua aberta para quem só quer olhar. */
export default function Login({ onLogged, error: initialError }: { onLogged: () => Promise<void>; error?: string }) {
  const nav = useNavigate();
  const [tab, setTab] = useState<'entrar' | 'criar' | 'senha'>('entrar');
  const [f, setF] = useState({ email: '', password: '', nome: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'bad' | 'ok'; text: string } | null>(initialError ? { tone: 'bad', text: initialError } : null);
  if (!cloudConfigured) return (
    <div className="auth"><div className="card auth-card"><h1>Banco não configurado</h1><p className="ink2">Este endereço roda só a demonstração.</p><Link className="btn" to="/">Abrir a demonstração</Link></div></div>
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (tab === 'senha') { await resetPassword(f.email); setMsg({ tone: 'ok', text: 'Se o e-mail tiver conta, chega um link para criar uma nova senha.' }); return; }
      if (tab === 'criar') {
        const r = await signUp(f.email, f.password, f.nome.trim());
        if (r.needsConfirmation) { setMsg({ tone: 'ok', text: 'Conta criada. Abra o link que enviamos para o seu e-mail e depois entre aqui.' }); setTab('entrar'); return; }
      } else await signIn(f.email, f.password);
      await onLogged();
      nav('/');
    } catch (err) { setMsg({ tone: 'bad', text: (err as Error).message }); } finally { setBusy(false); }
  };
  return (
    <div className="auth">
      <main className="card auth-card">
        <Link to="/" className="crumb"><ArrowLeft size={14} />Voltar para a demonstração</Link>
        <div className="brand"><span className="logo"><ShieldCheck /></span><div><b>SGQ Rotalume</b><small>Entrar com conta</small></div></div>
        <h1 style={{ fontSize: 22, margin: 0 }}>{tab === 'criar' ? 'Criar conta' : tab === 'senha' ? 'Esqueci a senha' : 'Entrar'}</h1>
        <p className="auth-note">Com conta, os dados ficam num banco de dados real e são compartilhados com a equipe. A primeira pessoa a criar conta vira gestora da qualidade; as outras entram como leitoras até a gestão liberar.</p>
        <div className="seg" role="group" aria-label="Opção">
          <button type="button" aria-pressed={tab === 'entrar'} onClick={() => setTab('entrar')}>Entrar</button>
          <button type="button" aria-pressed={tab === 'criar'} onClick={() => setTab('criar')}>Criar conta</button>
        </div>
        <form onSubmit={submit}>
          {tab === 'criar' && <label className="field"><span>Seu nome (como aparece nos registros)</span><input className="input" required autoComplete="name" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></label>}
          <label className="field"><span>E-mail</span><input className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          {tab !== 'senha' && <label className="field"><span>Senha</span><input className="input" type="password" required minLength={6} autoComplete={tab === 'criar' ? 'new-password' : 'current-password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>}
          {msg && <p className={msg.tone === 'bad' ? 'form-error' : 'ink2'} role={msg.tone === 'bad' ? 'alert' : 'status'} style={{ margin: 0 }}>{msg.text}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'Aguarde…' : tab === 'criar' ? 'Criar conta' : tab === 'senha' ? 'Enviar link' : 'Entrar'}</button>
          {tab === 'entrar' && <button type="button" className="btn ghost small" onClick={() => setTab('senha')}>Esqueci a senha</button>}
        </form>
      </main>
    </div>
  );
}
