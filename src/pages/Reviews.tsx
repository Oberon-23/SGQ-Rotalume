import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Plus, Printer, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { nextCode, useStore } from '../data/store';
import type { Review } from '../data/types';
import { reviewInputs } from '../data/review';
import { addDays, fmtDate, today, uid } from '../data/utils';
import { Confirm, Empty } from '../components/ui';
import History from '../components/History';
import { ReadOnlyNote } from '../components/DemoBar';

export default function Reviews() {
  const { db, update, notify, can } = useStore();
  const nav = useNavigate();
  const list = [...db.reviews].sort((a, b) => b.date.localeCompare(a.date));
  const pending = db.reviews.flatMap((r) => r.decisions.filter((d) => !d.done).map((d) => ({ ...d, review: r })));
  const create = () => {
    const last = list[0];
    const T = today();
    const from = last ? addDays(last.to, 1) : addDays(T, -182);
    const code = nextCode(db.reviews.map((r) => r.code), 'ACD');
    const r: Review = { id: code.toLowerCase(), code, date: T, from, to: T, participants: '', context: '', inputs: reviewInputs(db, from, T), decisions: [], conclusion: '', closed: false };
    update((d) => { d.reviews.push(r); });
    notify(`${code} criada com as entradas do período.`);
    nav(`/analise-critica/${r.id}`);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Análise crítica pela direção</h1><p>Reunião periódica em que a direção avalia se o SGQ funciona e decide o que mudar (ISO 9001:2015, cláusula 9.3). As entradas exigidas pela norma são montadas automaticamente a partir dos outros módulos.</p></div>
        {can('create', 'reviews') && <button className="btn primary" onClick={create}><Plus />Nova análise crítica</button>}
      </div>
      <div className="grid">
        <section className="card s7" style={{ padding: 0 }}>
          {list.length ? (
            <div className="tscroll" tabIndex={0} style={{ border: 0 }}>
              <table>
                <thead><tr><th>Análise</th><th>Período</th><th>Decisões</th><th>Situação</th></tr></thead>
                <tbody>{list.map((r) => (
                  <tr key={r.id} className="link" onClick={() => nav(`/analise-critica/${r.id}`)}>
                    <td><Link to={`/analise-critica/${r.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}><div className="t">{r.code}</div><div className="s">Reunião em {fmtDate(r.date)}</div></Link></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.from)} a {fmtDate(r.to)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.decisions.filter((d) => d.done).length} de {r.decisions.length} concluídas</td>
                    <td>{r.closed ? <span className="pill dot ok">Concluída</span> : <span className="pill dot info">Em andamento</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <Empty>Nenhuma análise crítica registrada.</Empty>}
        </section>
        <section className="card s5">
          <h2>Decisões em aberto</h2>
          <p className="how">Ações decididas pela direção que ainda não foram concluídas. Entram na próxima análise (9.3.2 a).</p>
          {pending.length ? <ul className="list">{pending.map((d) => (
            <li key={d.id + d.review.id}><Link to={`/analise-critica/${d.review.id}`} style={{ minWidth: 0 }}><b style={{ fontWeight: 600 }}>{d.text}</b><div className="s">{d.owner} · prazo {fmtDate(d.due)} · {d.review.code}</div></Link>{d.due < today() && <span className="pill dot bad">Vencida</span>}</li>
          ))}</ul> : <Empty>Nenhuma decisão pendente.</Empty>}
        </section>
      </div>
    </div>
  );
}

export function ReviewDetail() {
  const { id } = useParams();
  const { db, update, notify, can } = useStore();
  const nav = useNavigate();
  const [modal, setModal] = useState<'delete' | 'refresh' | null>(null);
  const r = db.reviews.find((x) => x.id === id);
  if (!r) return <div className="page"><Link className="crumb" to="/analise-critica"><ArrowLeft size={14} />Análise crítica</Link><Empty>Análise crítica não encontrada.</Empty></div>;
  const canEdit = can('edit', 'reviews', r);
  const ro = !canEdit || r.closed;
  const set = (fn: (x: Review) => void) => update((d) => { const x = d.reviews.find((y) => y.id === r.id); if (x) fn(x); });
  const refresh = () => { set((x) => { x.inputs = reviewInputs(db, x.from, x.to, x.id); }); setModal(null); notify('Entradas atualizadas com os dados de hoje.'); };
  const remove = () => { update((d) => { d.reviews = d.reviews.filter((y) => y.id !== r.id); }); notify(`${r.code} excluída.`); nav('/analise-critica'); };
  const blockers = [!r.participants.trim() && 'Informe os participantes.', !r.decisions.length && 'Registre pelo menos uma decisão (9.3.3).', !r.conclusion.trim() && 'Escreva a conclusão sobre a adequação e eficácia do SGQ.'].filter(Boolean) as string[];
  return (
    <div className="page">
      <div>
        <Link className="crumb" to="/analise-critica"><ArrowLeft size={14} />Análise crítica</Link>
        <div className="page-head">
          <div>
            <h1><span className="mono" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 10 }}>{r.code}</span>Análise crítica de {fmtDate(r.date)}</h1>
            <div className="meta-row" style={{ marginTop: 8 }}>
              {r.closed ? <span className="pill dot ok">Concluída</span> : <span className="pill dot info">Em andamento</span>}
              <span>Período <b>{fmtDate(r.from)} a {fmtDate(r.to)}</b></span>
              <span>Decisões <b>{r.decisions.filter((d) => d.done).length} de {r.decisions.length} concluídas</b></span>
            </div>
          </div>
          <div className="head-actions">
            {canEdit && !r.closed && <button className="btn" onClick={() => setModal('refresh')}><RefreshCw />Atualizar entradas</button>}
            {canEdit && (r.closed
              ? <button className="btn" onClick={() => set((x) => { x.closed = false; })}><RotateCcw />Reabrir</button>
              : <button className="btn primary" disabled={blockers.length > 0} title={blockers.join(' ')} onClick={() => { set((x) => { x.closed = true; }); notify(`${r.code} concluída.`); }}><Check />Concluir</button>)}
            <Link className="btn" to={`/imprimir/analise/${r.id}`} target="_blank"><Printer />Ata em PDF</Link>
            {can('delete', 'reviews', r) && <button className="btn ghost danger" onClick={() => setModal('delete')} aria-label="Excluir análise crítica"><Trash2 />Excluir</button>}
          </div>
        </div>
      </div>
      <ReadOnlyNote show={!canEdit} />
      {!r.closed && canEdit && blockers.length > 0 && <div className="blockers"><b>Para concluir:</b><ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul></div>}
      <section className="card">
        <h2>Reunião</h2>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <label className="field"><span>Data da reunião</span><input className="input" type="date" disabled={ro} value={r.date} onChange={(e) => set((x) => { x.date = e.target.value; })} /></label>
          <div className="field"><span>Período analisado</span>
            <div className="period">
              <input className="input" type="date" disabled={ro} value={r.from} onChange={(e) => set((x) => { x.from = e.target.value; })} aria-label="Início do período" />
              <span className="muted">a</span>
              <input className="input" type="date" disabled={ro} value={r.to} onChange={(e) => set((x) => { x.to = e.target.value; })} aria-label="Fim do período" />
            </div>
          </div>
          <label className="field full"><span>Participantes</span><input className="input" disabled={ro} value={r.participants} onChange={(e) => set((x) => { x.participants = e.target.value; })} placeholder="Nome e função de quem participou" /></label>
          <label className="field full"><span>Mudanças em questões internas e externas (9.3.2 b)</span><textarea className="input" disabled={ro} value={r.context} onChange={(e) => set((x) => { x.context = e.target.value; })} placeholder="Novos clientes, mudanças de mercado, legislação, estrutura da empresa..." /></label>
        </div>
      </section>
      <section className="card">
        <h2>Entradas da análise (9.3.2)</h2>
        <p className="how">Montadas a partir dos módulos do sistema e guardadas como foto do período. {!r.closed && 'Se os dados mudaram, use "Atualizar entradas".'}</p>
        <div className="review-inputs">
          {r.inputs.map((s) => (
            <div key={s.clause} className="ri">
              <h3><span className="mono">{s.clause}</span>{s.title}</h3>
              <ul>{s.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <div className="card-h">
          <div><h2>Decisões e ações (9.3.3)</h2><p className="how" style={{ margin: '2px 0 0' }}>Melhorias, mudanças no SGQ e recursos necessários, com responsável e prazo. O andamento pode ser marcado mesmo depois de concluída a análise.</p></div>
          {!ro && <button className="btn" onClick={() => set((x) => { x.decisions.push({ id: uid('d'), text: '', owner: '', due: addDays(today(), 60), done: false }); })}><Plus />Nova decisão</button>}
        </div>
        {r.decisions.length === 0 && <Empty>Nenhuma decisão registrada.</Empty>}
        <div style={{ display: 'grid', gap: 10 }}>
          {r.decisions.map((d, i) => (
            <div key={d.id} className={`action${d.done ? ' done' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="check"><input type="checkbox" disabled={!canEdit} checked={d.done} onChange={(e) => set((x) => { const y = x.decisions.find((z) => z.id === d.id); if (y) y.done = e.target.checked; })} />Decisão {i + 1} {d.done ? 'concluída' : 'pendente'}</label>
                <span style={{ display: 'flex', gap: 6 }}>{!d.done && d.due < today() && <span className="pill dot bad">Vencida</span>}{!ro && <button className="btn small ghost danger" onClick={() => set((x) => { x.decisions = x.decisions.filter((z) => z.id !== d.id); })} aria-label={`Excluir decisão ${i + 1}`}><Trash2 /></button>}</span>
              </div>
              <div className="action-grid">
                <label className="field" style={{ gridColumn: '1 / -1' }}><span>Decisão</span><input className="input" disabled={ro} value={d.text} onChange={(e) => set((x) => { const y = x.decisions.find((z) => z.id === d.id); if (y) y.text = e.target.value; })} /></label>
                <label className="field w2"><span>Responsável</span><input className="input" disabled={ro} value={d.owner} onChange={(e) => set((x) => { const y = x.decisions.find((z) => z.id === d.id); if (y) y.owner = e.target.value; })} /></label>
                <label className="field w2"><span>Prazo</span><input className="input" type="date" disabled={ro} value={d.due} onChange={(e) => set((x) => { const y = x.decisions.find((z) => z.id === d.id); if (y) y.due = e.target.value; })} /></label>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Conclusão</h2>
        <p className="how">O SGQ continua adequado, suficiente e eficaz? Está alinhado à direção estratégica?</p>
        <textarea className="input" style={{ width: '100%', minHeight: 90 }} disabled={ro} value={r.conclusion} onChange={(e) => set((x) => { x.conclusion = e.target.value; })} aria-label="Conclusão" />
      </section>
      <History entity="reviews" id={r.id} />
      {modal === 'refresh' && (
        <Confirm title="Atualizar as entradas?" confirmLabel="Atualizar" onClose={() => setModal(null)} onConfirm={refresh}>
          <p>As entradas serão recalculadas com os dados atuais dos módulos para o período de {fmtDate(r.from)} a {fmtDate(r.to)}. Decisões e conclusão não mudam.</p>
        </Confirm>
      )}
      {modal === 'delete' && (
        <Confirm title={`Excluir ${r.code}?`} onClose={() => setModal(null)} onConfirm={remove}>
          <p>A ata e as decisões serão apagadas. Decisões pendentes deixam de aparecer na próxima análise.</p>
        </Confirm>
      )}
    </div>
  );
}
