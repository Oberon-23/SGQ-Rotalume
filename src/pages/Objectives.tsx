import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { Objective } from '../data/types';
import { OBJECTIVE_LABEL, objectiveProgress, objectiveState } from '../data/quality';
import { fmtDate, fmtKpi, today } from '../data/utils';
import { Confirm, Empty, Headline, Modal, Sparkline } from '../components/ui';
import { Bar } from '../components/bits';

function ObjectiveForm({ initial, onClose }: { initial?: Objective; onClose: () => void }) {
  const { db, update, notify } = useStore();
  const [f, setF] = useState<Omit<Objective, 'id' | 'code'>>(initial ? { title: initial.title, kpiId: initial.kpiId, target: initial.target, deadline: initial.deadline, owner: initial.owner, plan: initial.plan }
    : { title: '', kpiId: db.kpis[0]?.id ?? '', target: db.kpis[0]?.target ?? 0, deadline: `${today().slice(0, 4)}-12-31`, owner: '', plan: '' });
  const k = db.kpis.find((x) => x.id === f.kpiId);
  const save = () => {
    if (initial) { update((d) => { const x = d.objectives.find((y) => y.id === initial.id); if (x) Object.assign(x, f); }); notify(`${initial.code} atualizado.`); onClose(); return; }
    const n = Math.max(0, ...db.objectives.map((o) => +o.code.slice(4) || 0)) + 1;
    const code = `OBJ-${String(n).padStart(2, '0')}`;
    update((d) => { d.objectives.push({ id: code.toLowerCase(), code, ...f }); });
    notify(`${code} criado.`); onClose();
  };
  return (
    <Modal title={initial ? `Editar ${initial.code}` : 'Novo objetivo da qualidade'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!f.title.trim() || !f.owner.trim() || !f.kpiId} onClick={save}>{initial ? 'Salvar' : 'Criar'}</button></>}>
      <div className="form-grid">
        <label className="field full"><span>Objetivo *</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: Reduzir o refugo da usinagem" /></label>
        <label className="field full"><span>Medido pelo indicador</span><select className="input" value={f.kpiId} onChange={(e) => { const nk = db.kpis.find((x) => x.id === e.target.value); setF({ ...f, kpiId: e.target.value, target: nk?.target ?? f.target }); }}>{db.kpis.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="field"><span>Meta do objetivo ({k?.unit})</span><input className="input" type="number" step="any" value={f.target} onChange={(e) => setF({ ...f, target: +e.target.value })} /><small className="muted">{k ? `${k.higherIsBetter ? 'Maior' : 'Menor'} é melhor. Meta mensal atual: ${fmtKpi(k, k.target)}.` : ''}</small></label>
        <label className="field"><span>Prazo</span><input className="input" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></label>
        <label className="field"><span>Responsável *</span><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
        <label className="field full"><span>Como vamos chegar lá</span><textarea className="input" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} /></label>
      </div>
    </Modal>
  );
}

export default function Objectives() {
  const { db, update, notify, can } = useStore();
  const [modal, setModal] = useState<{ kind: 'new' } | { kind: 'edit' | 'delete'; o: Objective } | null>(null);
  const items = db.objectives.map((o) => { const k = db.kpis.find((x) => x.id === o.kpiId); return { o, k, st: objectiveState(o, k), pr: objectiveProgress(o, k) }; });
  const behind = items.filter((x) => x.st === 'risco' || x.st === 'atrasado');
  const editable = can('edit', 'objectives');
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Objetivos da qualidade</h1><p>O que a Rotalume se comprometeu a melhorar no ano, cada objetivo medido por um indicador do sistema (ISO 9001:2015, cláusula 6.2). O progresso sai do último mês fechado.</p></div>
        {editable && <button className="btn primary" onClick={() => setModal({ kind: 'new' })}><Plus />Novo objetivo</button>}
      </div>
      <Headline tone={behind.length ? 'warn' : 'ok'} title={`${items.filter((x) => x.st === 'atingido').length} de ${items.length} objetivos atingidos${behind.length ? `, ${behind.length} em risco` : ''}.`}>
        {behind.map((x) => `${x.o.code} ${x.o.title}`).join('; ')}
      </Headline>
      {items.length ? (
        <div className="obj-grid">
          {items.map(({ o, k, st, pr }) => (
            <section key={o.id} className="card obj">
              <div className="card-h">
                <div><span className="mono muted" style={{ fontSize: 12.5 }}>{o.code}</span><h2 style={{ margin: '2px 0 0' }}>{o.title}</h2></div>
                <span className={`pill dot ${OBJECTIVE_LABEL[st][1]}`}>{OBJECTIVE_LABEL[st][0]}</span>
              </div>
              {k ? (
                <>
                  <div className="obj-nums">
                    <div><span className="lab">Início</span><b>{pr.base !== undefined ? fmtKpi(k, pr.base) : '—'}</b></div>
                    <div><span className="lab">Agora</span><b>{pr.cur !== undefined ? fmtKpi(k, pr.cur) : '—'}</b></div>
                    <div><span className="lab">Meta</span><b>{fmtKpi(k, o.target)}</b></div>
                    <Sparkline k={k} />
                  </div>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Bar pct={pr.pct} tone={st === 'atingido' ? 'ok' : st === 'caminho' ? 'accent' : 'warn'} label={`${pr.pct}% do caminho até a meta`} /><b>{pr.pct}%</b></span>
                  <p className="how" style={{ margin: 0 }}>Indicador: <Link to={`/indicadores/${k.id}`}>{k.name}</Link> · prazo {fmtDate(o.deadline)} · {o.owner}</p>
                </>
              ) : <Empty>O indicador deste objetivo foi excluído.</Empty>}
              {o.plan && <p className="ink2" style={{ margin: 0, fontSize: 14 }}>{o.plan}</p>}
              {editable && <div style={{ display: 'flex', gap: 8 }}><button className="btn small" onClick={() => setModal({ kind: 'edit', o })}><Pencil />Editar</button><button className="btn small ghost danger" onClick={() => setModal({ kind: 'delete', o })} aria-label={`Excluir ${o.code}`}><Trash2 /></button></div>}
            </section>
          ))}
        </div>
      ) : <Empty>Nenhum objetivo cadastrado.</Empty>}
      {!editable && <p className="muted" style={{ fontSize: 13 }}>Só a gestão da qualidade define os objetivos. Troque para Marina no topo da página para editar.</p>}
      {modal?.kind === 'new' && <ObjectiveForm onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <ObjectiveForm initial={modal.o} onClose={() => setModal(null)} />}
      {modal?.kind === 'delete' && <Confirm title={`Excluir ${modal.o.code}?`} onClose={() => setModal(null)} onConfirm={() => { update((d) => { d.objectives = d.objectives.filter((y) => y.id !== modal.o.id); }); notify(`${modal.o.code} excluído.`); setModal(null); }}><p>O indicador continua existindo; só o objetivo sai da lista.</p></Confirm>}
    </div>
  );
}
