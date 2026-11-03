import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useStore } from '../data/store';
import type { Action, NCStage, NonConformity, Origin, Severity, SixM } from '../data/types';
import { SIX_M } from '../data/types';
import { addDays, blockers, brl, daysBetween, fmtDate, isLate, STAGES, stageIndex, today, uid } from '../data/utils';
import { Empty, SeverityPill, StagePill } from '../components/ui';

const ORIGINS: Origin[] = ['Inspeção de processo', 'Auditoria interna', 'Reclamação de cliente', 'Fornecedor', 'Metrologia'];

export default function NCDetail() {
  const { id } = useParams();
  const { db, update } = useStore();
  const nc = db.ncs.find((n) => n.id === id);
  const [view, setView] = useState<NCStage | null>(null);
  if (!nc) return <div className="page"><Link className="crumb" to="/nao-conformidades"><ArrowLeft size={14} />Não conformidades</Link><Empty>Não conformidade não encontrada.</Empty></div>;

  const set = (fn: (n: NonConformity) => void) => update((d) => { const n = d.ncs.find((x) => x.id === nc.id); if (n) fn(n); });
  const shown = view ?? nc.stage;
  const cur = stageIndex(nc.stage);
  const ro = nc.stage === 'encerrada' || stageIndex(shown) < cur; // etapas anteriores ficam só para leitura
  const proc = db.processes.find((p) => p.id === nc.processId);
  const audit = nc.auditId ? db.audits.find((a) => a.id === nc.auditId) : undefined;
  const bl = blockers(nc);
  const next = STAGES[cur + 1];

  const advance = () => {
    if (bl.length || !next) return;
    set((n) => {
      n.stage = next.id;
      if (next.id === 'verificacao' && !n.verification.date) n.verification.date = today();
      if (next.id === 'encerrada') n.closedAt = today();
    });
    setView(null);
  };
  const backToAnalysis = () => { set((n) => { n.stage = 'analise'; n.verification = { effective: null, evidence: '', date: '' }; n.actions.forEach((a) => { a.done = false; }); }); setView(null); };

  return (
    <div className="page">
      <div>
        <Link className="crumb" to="/nao-conformidades"><ArrowLeft size={14} />Não conformidades</Link>
        <div className="page-head">
          <div>
            <h1><span className="mono" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 10 }}>{nc.code}</span>{nc.title}</h1>
            <div className="meta-row" style={{ marginTop: 8 }}>
              <SeverityPill s={nc.severity} /><StagePill s={nc.stage} />{isLate(nc) && <span className="pill dot bad">Vencida há {daysBetween(nc.dueAt, today())} dias</span>}
              <span>Processo <b><Link to={`/processos/${nc.processId}`}>{proc?.name}</Link></b></span>
              <span>Origem <b>{nc.origin}</b>{audit && <> (<Link to={`/auditorias/${audit.id}`}>{audit.code}</Link>)</>}</span>
              <span>Responsável <b>{nc.owner}</b></span>
              <span>Aberta em <b>{fmtDate(nc.openedAt)}</b></span>
              <span>Prazo <b>{fmtDate(nc.dueAt)}</b></span>
            </div>
          </div>
        </div>
      </div>

      <div className="stepper" role="tablist" aria-label="Etapas do tratamento">
        {STAGES.map((s, i) => {
          const reached = i <= cur;
          return (
            <button key={s.id} role="tab" aria-selected={shown === s.id} disabled={!reached}
              className={`step${i < cur || nc.stage === 'encerrada' ? ' done' : ''}${i === cur && nc.stage !== 'encerrada' ? ' current' : ''}${shown === s.id && i !== cur ? ' view' : ''}`}
              style={!reached ? { opacity: .55, cursor: 'default' } : undefined} onClick={() => setView(i === cur ? null : s.id)}>
              <span className="pd">{s.pdca} · {i + 1}</span><b>{s.label}</b>
            </button>
          );
        })}
      </div>

      {shown === 'registro' && (
        <section className="card">
          <h2>Registro e contenção</h2>
          <p className="how">Descreva o problema com fatos e registre o que foi feito de imediato para proteger o cliente.</p>
          <div className="form-grid">
            <label className="field full"><span>Título</span><input className="input" disabled={ro} value={nc.title} onChange={(e) => set((n) => { n.title = e.target.value; })} /></label>
            <label className="field full"><span>O que aconteceu</span><textarea className="input" disabled={ro} value={nc.description} onChange={(e) => set((n) => { n.description = e.target.value; })} /></label>
            <label className="field"><span>Processo</span><select className="input" disabled={ro} value={nc.processId} onChange={(e) => set((n) => { n.processId = e.target.value; })}>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
            <label className="field"><span>Origem</span><select className="input" disabled={ro} value={nc.origin} onChange={(e) => set((n) => { n.origin = e.target.value as Origin; })}>{ORIGINS.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="field"><span>Gravidade</span><select className="input" disabled={ro} value={nc.severity} onChange={(e) => set((n) => { n.severity = e.target.value as Severity; })}>{(['Menor', 'Maior', 'Crítica'] as Severity[]).map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="field"><span>Prazo</span><input className="input" type="date" disabled={ro} value={nc.dueAt} onChange={(e) => set((n) => { n.dueAt = e.target.value; })} /></label>
            <label className="field full"><span>Responsável</span><input className="input" disabled={ro} value={nc.owner} onChange={(e) => set((n) => { n.owner = e.target.value; })} /></label>
            <label className="field full"><span>Contenção imediata</span><textarea className="input" disabled={ro} value={nc.containment} onChange={(e) => set((n) => { n.containment = e.target.value; })} placeholder="Segregar o lote, inspecionar 100%, avisar o cliente..." /></label>
          </div>
        </section>
      )}

      {shown === 'analise' && <Analysis nc={nc} ro={ro} set={set} />}
      {shown === 'plano' && <Plan nc={nc} ro={ro} set={set} />}

      {shown === 'verificacao' && (
        <section className="card">
          <h2>Verificação de eficácia</h2>
          <p className="how">Depois de um tempo, o problema voltou a acontecer? Use dados: indicador, carta de controle, inspeções.</p>
          <div className="form-grid">
            <div className="field full"><span>As ações foram eficazes?</span>
              <div className="seg" role="group" aria-label="Eficácia" style={{ justifySelf: 'start' }}>
                <button type="button" disabled={ro} aria-pressed={nc.verification.effective === true} onClick={() => set((n) => { n.verification.effective = true; })}><Check />Sim, o problema não voltou</button>
                <button type="button" disabled={ro} aria-pressed={nc.verification.effective === false} onClick={() => set((n) => { n.verification.effective = false; })}><X />Não</button>
              </div>
            </div>
            <label className="field full"><span>Evidência</span><textarea className="input" disabled={ro} value={nc.verification.evidence} onChange={(e) => set((n) => { n.verification.evidence = e.target.value; })} placeholder="Ex.: 90 dias sem pontos fora de controle; Cpk de 0,9 para 1,6." /></label>
            <label className="field"><span>Data da verificação</span><input className="input" type="date" disabled={ro} value={nc.verification.date} onChange={(e) => set((n) => { n.verification.date = e.target.value; })} /></label>
          </div>
          {nc.verification.effective === false && !ro && (
            <div className="blockers" style={{ marginTop: 14 }}>
              <b>Ação não eficaz.</b> A causa raiz provavelmente não foi a certa. Volte para a análise de causa e refaça o plano.
              <div style={{ marginTop: 8 }}><button className="btn small" onClick={backToAnalysis}><RotateCcw />Voltar para a análise de causa</button></div>
            </div>
          )}
        </section>
      )}

      {shown === 'encerrada' && (
        <section className="card">
          <h2>Tratamento encerrado</h2>
          <div className="tiles" style={{ marginTop: 12 }}>
            <div className="tile"><span className="lab">Tempo de tratamento</span><span className="val">{daysBetween(nc.openedAt, nc.closedAt ?? today())} dias</span><span className="sub">{fmtDate(nc.openedAt)} a {fmtDate(nc.closedAt)}</span></div>
            <div className="tile"><span className="lab">Ações</span><span className="val">{nc.actions.length}</span><span className="sub">investimento de {brl(nc.actions.reduce((s, a) => s + (a.howMuch || 0), 0))}</span></div>
            <div className="tile"><span className="lab">Prazo</span><span className="val">{(nc.closedAt ?? '') <= nc.dueAt ? 'No prazo' : 'Atrasada'}</span><span className="sub">prazo era {fmtDate(nc.dueAt)}</span></div>
          </div>
          <div className="prose" style={{ marginTop: 16 }}>
            <p><b>Causa raiz ({nc.category}):</b> {nc.rootCause}</p>
            <p><b>Evidência de eficácia:</b> {nc.verification.evidence}</p>
          </div>
        </section>
      )}

      {view === null && nc.stage !== 'encerrada' && next && (
        <section className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          {bl.length ? (
            <div className="blockers" style={{ flex: '1 1 320px' }}><b>Para avançar para "{next.label}":</b><ul>{bl.map((b) => <li key={b}>{b}</li>)}</ul></div>
          ) : <span className="saved" style={{ flex: '1 1 320px' }}><Check size={15} />Tudo pronto para avançar. As alterações são salvas automaticamente.</span>}
          <button className="btn primary" disabled={bl.length > 0} onClick={advance}>{next.id === 'encerrada' ? <><Check />Encerrar não conformidade</> : <>Avançar para {next.label.toLowerCase()}<ArrowRight /></>}</button>
        </section>
      )}
      {view !== null && <div><button className="btn" onClick={() => setView(null)}><ArrowLeft />Voltar para a etapa atual</button></div>}
    </div>
  );
}

function Analysis({ nc, ro, set }: { nc: NonConformity; ro: boolean; set: (fn: (n: NonConformity) => void) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const addCause = (m: SixM) => { const t = (draft[m] || '').trim(); if (!t) return; set((n) => { n.ishikawa[m].push(t); }); setDraft({ ...draft, [m]: '' }); };
  const bone = (m: SixM, pos: string) => (
    <div key={m} className={`bone ${pos}${nc.category === m ? ' hit' : ''}`}>
      <b>{m}{nc.category === m && <span className="pill accent" style={{ fontSize: 11 }}>causa raiz</span>}</b>
      {nc.ishikawa[m].length ? <ul>{nc.ishikawa[m].map((c, i) => <li key={i}>{c}{!ro && <button className="rm" aria-label={`Remover ${c}`} onClick={() => set((n) => { n.ishikawa[m].splice(i, 1); })}>×</button>}</li>)}</ul> : <span className="muted" style={{ fontSize: 12 }}>Nenhuma causa</span>}
      {!ro && <div className="add"><input className="input" placeholder="Nova causa" value={draft[m] || ''} onChange={(e) => setDraft({ ...draft, [m]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') addCause(m); }} aria-label={`Nova causa em ${m}`} /><button className="btn small" onClick={() => addCause(m)} aria-label={`Adicionar causa em ${m}`}><Plus /></button></div>}
    </div>
  );
  return (
    <>
      <section className="card">
        <h2>5 Porquês</h2>
        <p className="how">Pergunte "por quê?" a partir do problema até chegar a algo que, se corrigido, impede que ele volte. Normalmente de 3 a 5 vezes.</p>
        <div className="whys">
          {[...nc.whys, ...Array(Math.max(0, 5 - nc.whys.length)).fill('')].map((w: string, i) => (
            <label key={i} className="why"><span>{i + 1}º por quê</span><input className="input" disabled={ro} value={w} onChange={(e) => set((n) => { n.whys[i] = e.target.value; })} placeholder={i === 0 ? 'Por que o problema aconteceu?' : 'E por que isso aconteceu?'} /></label>
          ))}
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <label className="field full"><span>Causa raiz</span><textarea className="input" disabled={ro} value={nc.rootCause} onChange={(e) => set((n) => { n.rootCause = e.target.value; })} placeholder="A causa que, eliminada, impede a reincidência" /></label>
          <label className="field"><span>Categoria (6M)</span><select className="input" disabled={ro} value={nc.category} onChange={(e) => set((n) => { n.category = e.target.value as SixM | ''; })}><option value="">Escolha</option>{SIX_M.map((m) => <option key={m}>{m}</option>)}</select></label>
        </div>
      </section>
      <section className="card">
        <h2>Diagrama de Ishikawa</h2>
        <p className="how">Causas possíveis em cada um dos 6M. A categoria da causa raiz fica destacada.</p>
        <div className="fish">
          {SIX_M.slice(0, 3).map((m) => bone(m, 'top'))}
          <div className="spine" aria-hidden="true" />
          {SIX_M.slice(3).map((m) => bone(m, 'bot'))}
          <div className="head">{nc.title}</div>
        </div>
      </section>
    </>
  );
}

function Plan({ nc, ro, set }: { nc: NonConformity; ro: boolean; set: (fn: (n: NonConformity) => void) => void }) {
  const add = () => set((n) => { n.actions.push({ id: uid('a'), what: '', why: '', where: '', who: n.owner, when: addDays(today(), 15), how: '', howMuch: 0, done: false }); });
  const setA = (id: string, fn: (a: Action) => void) => set((n) => { const a = n.actions.find((x) => x.id === id); if (a) fn(a); });
  const total = nc.actions.reduce((s, a) => s + (a.howMuch || 0), 0);
  return (
    <section className="card">
      <div className="card-h">
        <div><h2>Plano de ação 5W2H</h2><p className="how" style={{ margin: '2px 0 0' }}>O quê, por quê, onde, quem, quando, como e quanto. Marque cada ação quando for concluída.</p></div>
        {!ro && <button className="btn" onClick={add}><Plus />Nova ação</button>}
      </div>
      {nc.rootCause && <p className="ink2" style={{ margin: '0 0 12px', fontSize: 13.5 }}><b style={{ color: 'var(--ink)' }}>Causa raiz:</b> {nc.rootCause}</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {nc.actions.length === 0 && <Empty>Nenhuma ação ainda.</Empty>}
        {nc.actions.map((a, i) => {
          const late = !a.done && a.when < today();
          return (
            <div key={a.id} className={`action${a.done ? ' done' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="check"><input type="checkbox" disabled={ro} checked={a.done} onChange={(e) => setA(a.id, (x) => { x.done = e.target.checked; })} />Ação {i + 1} {a.done ? 'concluída' : 'pendente'}</label>
                <span style={{ display: 'flex', gap: 6 }}>{late && <span className="pill dot bad">Atrasada</span>}{!ro && <button className="btn small ghost danger" onClick={() => set((n) => { n.actions = n.actions.filter((x) => x.id !== a.id); })} aria-label="Excluir ação"><Trash2 /></button>}</span>
              </div>
              <div className="action-grid">
                <label className="field w2"><span>O quê</span><input className="input" disabled={ro} value={a.what} onChange={(e) => setA(a.id, (x) => { x.what = e.target.value; })} /></label>
                <label className="field w2"><span>Por quê</span><input className="input" disabled={ro} value={a.why} onChange={(e) => setA(a.id, (x) => { x.why = e.target.value; })} /></label>
                <label className="field"><span>Onde</span><input className="input" disabled={ro} value={a.where} onChange={(e) => setA(a.id, (x) => { x.where = e.target.value; })} /></label>
                <label className="field"><span>Quem</span><input className="input" disabled={ro} value={a.who} onChange={(e) => setA(a.id, (x) => { x.who = e.target.value; })} /></label>
                <label className="field"><span>Quando</span><input className="input" type="date" disabled={ro} value={a.when} onChange={(e) => setA(a.id, (x) => { x.when = e.target.value; })} /></label>
                <label className="field"><span>Quanto (R$)</span><input className="input" type="number" min={0} disabled={ro} value={a.howMuch} onChange={(e) => setA(a.id, (x) => { x.howMuch = +e.target.value || 0; })} /></label>
                <label className="field" style={{ gridColumn: '1 / -1' }}><span>Como</span><input className="input" disabled={ro} value={a.how} onChange={(e) => setA(a.id, (x) => { x.how = e.target.value; })} /></label>
              </div>
            </div>
          );
        })}
      </div>
      {nc.actions.length > 0 && <p className="ink2" style={{ margin: '12px 0 0', fontSize: 13.5 }}>{nc.actions.filter((a) => a.done).length} de {nc.actions.length} concluídas · investimento total {brl(total)}</p>}
    </section>
  );
}
