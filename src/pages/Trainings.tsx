import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, UserPlus, X } from 'lucide-react';
import { useStore } from '../data/store';
import type { ParticipantStatus, Training } from '../data/types';
import { TRAINING_LABEL, evalLate, trainingEfficacy, trainingState } from '../data/quality';
import { addDays, daysBetween, fmtDate, today } from '../data/utils';
import { Confirm, Headline, Modal } from '../components/ui';
import { Pager, SortTh, useTable } from '../components/Table';
import History from '../components/History';
import { ReadOnlyNote } from '../components/DemoBar';
import { Bar, CodeTitle, Crumb, Missing } from '../components/bits';

const P_LABEL: Record<ParticipantStatus, [string, string, string]> = {
  pendente: ['Não participou ainda', '', '·'], concluido: ['Participou, avaliar', 'warn', '◐'], eficaz: ['Eficaz', 'ok', '●'], ineficaz: ['Não eficaz', 'bad', '✕'],
};
const StatePill = ({ t }: { t: Training }) => { const s = trainingState(t); return <span className={`pill dot ${TRAINING_LABEL[s][1]}`}>{TRAINING_LABEL[s][0]}</span>; };

function TrainingForm({ onClose }: { onClose: () => void }) {
  const { db, update, notify, user } = useStore();
  const nav = useNavigate();
  const mine = user.role === 'dono' ? db.processes.find((p) => p.owner === user.name)?.id : undefined;
  const [f, setF] = useState({ title: '', processId: mine ?? db.processes[0]?.id ?? '', docId: '', instructor: '', date: addDays(today(), 14), hours: 4, owner: user.role === 'leitor' ? '' : user.name, people: '', notes: '' });
  const ok = f.title.trim() && f.instructor.trim() && f.owner.trim() && f.people.trim() && f.hours > 0;
  const save = () => {
    const year = f.date.slice(0, 4);
    const n = Math.max(0, ...db.trainings.filter((t) => t.code.startsWith(`TR-${year}-`)).map((t) => +t.code.slice(8) || 0)) + 1;
    const code = `TR-${year}-${String(n).padStart(2, '0')}`;
    const participants = f.people.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean).map((name) => ({ name, status: 'pendente' as const }));
    update((d) => { d.trainings.push({ id: code.toLowerCase(), code, title: f.title, processId: f.processId, docId: f.docId || undefined, instructor: f.instructor, date: f.date, hours: f.hours, owner: f.owner, evalBy: addDays(f.date, 30), participants, notes: f.notes }); });
    notify(`${code} programado. Eficácia a avaliar até ${fmtDate(addDays(f.date, 30))}.`);
    onClose(); nav(`/treinamentos/${code.toLowerCase()}`);
  };
  return (
    <Modal title="Novo treinamento" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!ok} onClick={save}>Programar</button></>}>
      <div className="form-grid">
        <label className="field full"><span>Tema *</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="field"><span>Processo</span><select className="input" value={f.processId} onChange={(e) => setF({ ...f, processId: e.target.value })}>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
        <label className="field"><span>Documento de referência</span><select className="input" value={f.docId} onChange={(e) => setF({ ...f, docId: e.target.value })}><option value="">Nenhum</option>{db.docs.filter((d) => d.status !== 'obsoleto').map((d) => <option key={d.id} value={d.id}>{d.code} · {d.title}</option>)}</select></label>
        <label className="field"><span>Instrutor *</span><input className="input" value={f.instructor} onChange={(e) => setF({ ...f, instructor: e.target.value })} /></label>
        <label className="field"><span>Quem avalia a eficácia *</span><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
        <label className="field"><span>Data</span><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="field"><span>Carga horária (h)</span><input className="input" type="number" min={1} value={f.hours} onChange={(e) => setF({ ...f, hours: Math.max(0, +e.target.value) })} /></label>
        <label className="field full"><span>Participantes * (um por linha)</span><textarea className="input" rows={3} value={f.people} onChange={(e) => setF({ ...f, people: e.target.value })} /></label>
      </div>
    </Modal>
  );
}

export default function Trainings() {
  const { db, can } = useStore();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const rows = [...db.trainings].sort((a, b) => b.date.localeCompare(a.date));
  const t = useTable(rows, { code: (x: Training) => x.code, date: (x: Training) => x.date, eff: (x: Training) => trainingEfficacy(x), state: (x: Training) => ['avaliar', 'programado', 'concluido'].indexOf(trainingState(x)) });
  const year = today().slice(0, 4);
  const done = db.trainings.filter((x) => x.date <= today() && x.date.startsWith(year));
  const hours = done.reduce((s, x) => s + x.hours * x.participants.filter((p) => p.status !== 'pendente').length, 0);
  const evaluated = db.trainings.flatMap((x) => x.participants).filter((p) => p.status === 'eficaz' || p.status === 'ineficaz');
  const eff = evaluated.length ? Math.round((evaluated.filter((p) => p.status === 'eficaz').length / evaluated.length) * 100) : null;
  const toEval = db.trainings.filter((x) => trainingState(x) === 'avaliar');
  const late = db.trainings.filter((x) => evalLate(x));
  const people = [...new Set(db.trainings.flatMap((x) => x.participants.map((p) => p.name)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const matrix = [...db.trainings].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Treinamentos e competências</h1><p>Quem foi treinado em quê, e se o treinamento resolveu: a eficácia é avaliada no posto, até 30 dias depois (ISO 9001:2015, cláusula 7.2).</p></div>
        {can('create', 'trainings') && <button className="btn primary" onClick={() => setCreating(true)}><Plus />Novo treinamento</button>}
      </div>
      <Headline tone={late.length ? 'bad' : toEval.length ? 'warn' : 'ok'} title={late.length ? `${late.length} ${late.length === 1 ? 'avaliação de eficácia está vencida' : 'avaliações de eficácia estão vencidas'}.` : toEval.length ? `${toEval.length} ${toEval.length === 1 ? 'treinamento aguarda' : 'treinamentos aguardam'} avaliação de eficácia.` : 'Todas as avaliações de eficácia em dia.'}>
        {late.map((x) => `${x.code} ${x.title} (${x.owner})`).join('; ')}
      </Headline>
      <div className="tiles">
        <div className="tile"><span className="lab">Horas de treinamento em {year}</span><span className="val">{hours}</span><span className="sub">horas × pessoas que participaram</span></div>
        <div className="tile"><span className="lab">Eficácia</span><span className="val">{eff ?? '—'}%</span><span className="sub">das {evaluated.length} pessoas já avaliadas</span></div>
        <div className="tile"><span className="lab">Aguardando avaliação</span><span className="val">{toEval.length}</span><span className="sub">{late.length} fora do prazo</span></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="tscroll" tabIndex={0} style={{ border: 0 }}>
          <table>
            <thead><tr><SortTh t={t} k="code">Treinamento</SortTh><SortTh t={t} k="date">Data</SortTh><th>Participantes</th><SortTh t={t} k="eff">Eficácia</SortTh><SortTh t={t} k="state">Situação</SortTh></tr></thead>
            <tbody>{t.view.map((x) => { const e = trainingEfficacy(x); return (
              <tr key={x.id} className="link" onClick={() => nav(`/treinamentos/${x.id}`)}>
                <td><Link to={`/treinamentos/${x.id}`} style={{ textDecoration: 'none' }} onClick={(ev) => ev.stopPropagation()}><div className="t">{x.title}</div><div className="s"><span className="mono">{x.code}</span> · {x.instructor} · {x.hours} h</div></Link></td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(x.date)}</td>
                <td>{x.participants.length}</td>
                <td style={{ minWidth: 120 }}>{e === null ? <span className="muted">—</span> : <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Bar pct={e} tone={e >= 80 ? 'ok' : 'warn'} /><b>{e}%</b></span>}</td>
                <td>{evalLate(x) ? <span className="pill dot bad">Avaliação vencida</span> : <StatePill t={x} />}</td>
              </tr>); })}
            </tbody>
          </table>
        </div>
        <Pager t={t} noun="treinamentos" />
      </div>
      <section className="card">
        <h2>Matriz de competências</h2>
        <p className="how">Cada linha é uma pessoa, cada coluna um treinamento. ● eficaz · ◐ participou, falta avaliar · ✕ não eficaz (precisa de reforço) · vazio: não se aplica.</p>
        <div className="tscroll" tabIndex={0}>
          <table className="cmatrix">
            <thead><tr><th>Pessoa</th>{matrix.map((x) => <th key={x.id} title={x.title}><Link to={`/treinamentos/${x.id}`} className="mono">{x.code.replace(/^TR-\d{4}-/, 'TR-')}</Link></th>)}</tr></thead>
            <tbody>{people.map((name) => (
              <tr key={name}><td style={{ whiteSpace: 'nowrap' }}>{name}</td>
                {matrix.map((x) => { const p = x.participants.find((y) => y.name === name); return <td key={x.id} className={p ? `cm ${P_LABEL[p.status][1]}` : 'cm'} title={p ? `${x.title}: ${P_LABEL[p.status][0]}` : undefined}>{p ? P_LABEL[p.status][2] : ''}<span className="sr-only">{p ? P_LABEL[p.status][0] : 'Não se aplica'}</span></td>; })}
              </tr>))}
            </tbody>
          </table>
        </div>
      </section>
      {creating && <TrainingForm onClose={() => setCreating(false)} />}
    </div>
  );
}

export function TrainingDetail() {
  const { id } = useParams();
  const { db, update, notify, can } = useStore();
  const nav = useNavigate();
  const [modal, setModal] = useState<'delete' | null>(null);
  const [newName, setNewName] = useState('');
  const x = db.trainings.find((y) => y.id === id);
  if (!x) return <Missing to="/treinamentos" back="Treinamentos">Treinamento não encontrado.</Missing>;
  const canEdit = can('edit', 'trainings', x);
  const p = db.processes.find((y) => y.id === x.processId);
  const doc = db.docs.find((d) => d.id === x.docId);
  const e = trainingEfficacy(x);
  const future = x.date > today();
  const mut = (fn: (t: Training) => void) => update((d) => { const y = d.trainings.find((z) => z.id === x.id); if (y) fn(y); });
  const add = () => { const n = newName.trim(); if (!n || x.participants.some((q) => q.name === n)) return; mut((t) => t.participants.push({ name: n, status: 'pendente' })); setNewName(''); };
  const remove = () => { update((d) => { d.trainings = d.trainings.filter((y) => y.id !== x.id); }); notify(`${x.code} excluído.`); nav('/treinamentos'); };
  return (
    <div className="page">
      <div>
        <Crumb to="/treinamentos">Treinamentos</Crumb>
        <div className="page-head">
          <div>
            <CodeTitle code={x.code}>{x.title}</CodeTitle>
            <div className="meta-row" style={{ marginTop: 8 }}>
              {evalLate(x) ? <span className="pill dot bad">Avaliação vencida há {daysBetween(x.evalBy, today())} dias</span> : <StatePill t={x} />}
              <span>Data <b>{fmtDate(x.date)}</b></span><span>Carga <b>{x.hours} h</b></span><span>Instrutor <b>{x.instructor}</b></span>
              <span>Processo <b>{p ? <Link to={`/processos/${p.id}`}>{p.name}</Link> : '—'}</b></span>
              {doc && <span>Documento <b><Link to={`/documentos/${doc.id}`}>{doc.code}</Link></b></span>}
              <span>Eficácia avaliada por <b>{x.owner}</b> até <b>{fmtDate(x.evalBy)}</b></span>
            </div>
          </div>
          {can('delete', 'trainings', x) && <div className="head-actions"><button className="btn ghost danger" onClick={() => setModal('delete')} aria-label="Excluir treinamento"><Trash2 />Excluir</button></div>}
        </div>
      </div>
      <ReadOnlyNote show={!canEdit} />
      <div className="grid">
        <section className="card s8">
          <h2>Participantes e eficácia</h2>
          <p className="how">{future ? 'O treinamento ainda não aconteceu. Depois da data, marque quem participou e avalie a eficácia no posto.' : 'Marque quem participou e, depois de observar a pessoa no posto, se o treinamento foi eficaz.'}</p>
          <ul className="list">
            {x.participants.map((q) => (
              <li key={q.name}>
                <b style={{ fontSize: 14 }}>{q.name}</b>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {canEdit ? (
                    <select className="input" style={{ width: 'auto' }} value={q.status} aria-label={`Situação de ${q.name}`} onChange={(ev) => mut((t) => { const r = t.participants.find((z) => z.name === q.name); if (r) r.status = ev.target.value as ParticipantStatus; })}>
                      {(Object.keys(P_LABEL) as ParticipantStatus[]).map((s) => <option key={s} value={s} disabled={future && s !== 'pendente'}>{P_LABEL[s][0]}</option>)}
                    </select>
                  ) : <span className={`pill ${P_LABEL[q.status][1]}`}>{P_LABEL[q.status][0]}</span>}
                  {canEdit && <button className="btn ghost small" aria-label={`Tirar ${q.name}`} onClick={() => mut((t) => { t.participants = t.participants.filter((z) => z.name !== q.name); })}><X /></button>}
                </span>
              </li>
            ))}
          </ul>
          {canEdit && <div className="add-row"><input className="input" value={newName} onChange={(ev) => setNewName(ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') add(); }} placeholder="Nome do participante" aria-label="Nome do participante" /><button className="btn" onClick={add} disabled={!newName.trim()}><UserPlus />Incluir</button></div>}
        </section>
        <section className="card s4">
          <h2>Resultado</h2>
          {e === null ? <p className="muted">Ninguém avaliado ainda.</p> : <><div className="big-num">{e}%</div><Bar pct={e} tone={e >= 80 ? 'ok' : 'warn'} /><p className="how" style={{ marginTop: 8 }}>{x.participants.filter((q) => q.status === 'eficaz').length} de {x.participants.filter((q) => q.status === 'eficaz' || q.status === 'ineficaz').length} pessoas avaliadas foram eficazes.</p></>}
          <h2 style={{ marginTop: 16 }}>Observações</h2>
          {canEdit ? <textarea className="input" rows={4} value={x.notes} onChange={(ev) => mut((t) => { t.notes = ev.target.value; })} aria-label="Observações" /> : <p className="ink2">{x.notes || '—'}</p>}
        </section>
      </div>
      <History entity="trainings" id={x.id} />
      {modal === 'delete' && <Confirm title={`Excluir ${x.code}?`} onClose={() => setModal(null)} onConfirm={remove}><p>O registro de quem participou e da eficácia será apagado. Ele é evidência de competência para a auditoria.</p></Confirm>}
    </div>
  );
}
