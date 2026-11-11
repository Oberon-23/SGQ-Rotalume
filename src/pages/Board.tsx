import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarClock, GripVertical } from 'lucide-react';
import { useStore } from '../data/store';
import type { BoardStatus } from '../data/types';
import { COLUMNS, WIP_PER_PERSON, cards, moveCard, overWip, type Card } from '../data/board';
import { brl, daysBetween, fmtDate, today } from '../data/utils';
import { Headline } from '../components/ui';
import { norm } from '../components/Search';

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function Board() {
  const { db, update, notify, user } = useStore();
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const [kind, setKind] = useState<'' | Card['kind']>('');
  const [mine, setMine] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<BoardStatus | null>(null);
  const all = useMemo(() => cards(db), [db]);
  const people = [...new Set(all.map((c) => c.who).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const list = all.filter((c) => (!mine || c.who === user.name) && (!who || c.who === who) && (!kind || c.kind === kind)
    && (!q || norm(`${c.title} ${c.parentCode} ${c.who}`).includes(norm(q))));
  const canMove = (c: Card) => user.role !== 'leitor' && (user.role === 'gestor' || c.who === user.name || (c.kind === 'acao' && c.processOwner === user.name));
  const move = (key: string, to: BoardStatus) => {
    const c = all.find((x) => x.key === key);
    if (!c || c.status === to) return;
    if (!canMove(c)) { notify('Seu perfil não pode mover este cartão. Troque de perfil no topo da página.'); return; }
    update((d) => moveCard(d, key, to));
    notify(`"${c.title.slice(0, 48)}" → ${COLUMNS.find((x) => x.id === to)!.label.toLowerCase()}.`);
  };
  const wip = overWip(all);
  const late = all.filter((c) => c.late);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Quadro de ações</h1><p>Todas as ações das não conformidades em aberto e as decisões da direção num quadro Kanban. Arraste o cartão entre as colunas ou use as setas. Cada movimento grava no registro de origem e entra no histórico.</p></div>
      </div>
      <Headline tone={late.length ? 'bad' : wip.length ? 'warn' : 'ok'} title={late.length ? `${late.length} ${late.length === 1 ? 'cartão está atrasado' : 'cartões estão atrasados'}.` : 'Nenhum cartão atrasado.'}>
        {wip.length ? `${wip.join(' e ')} ${wip.length === 1 ? 'tem' : 'têm'} mais de ${WIP_PER_PERSON} itens em andamento ao mesmo tempo: termine antes de começar outro.` : `Limite de ${WIP_PER_PERSON} itens em andamento por pessoa respeitado.`}
      </Headline>
      <div className="toolbar">
        <input className="input search" type="search" placeholder="Buscar ação, código ou pessoa" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar no quadro" />
        {user.role !== 'leitor' && <button type="button" className="btn" aria-pressed={mine} onClick={() => setMine(!mine)}>{mine ? 'Mostrando só os meus' : 'Só os meus'}</button>}
        <select className="input" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Responsável"><option value="">Todas as pessoas</option>{people.map((p) => <option key={p}>{p}</option>)}</select>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as '' | Card['kind'])} aria-label="Origem"><option value="">Todas as origens</option><option value="acao">Ações de NC (5W2H)</option><option value="decisao">Decisões da direção</option></select>
      </div>
      <div className="board">
        {COLUMNS.map((col, ci) => {
          const items = list.filter((c) => c.status === col.id).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
          return (
            <section key={col.id} className={`col${over === col.id ? ' over' : ''}`} aria-label={`${col.label}: ${items.length} cartões`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== col.id) setOver(col.id); }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); const k = e.dataTransfer.getData('text/plain') || dragging; if (k) move(k, col.id); setDragging(null); setOver(null); }}>
              <header className="col-h"><h2>{col.label}</h2><span className="count-pill">{items.length}</span><p>{col.help}</p></header>
              <ul className="cards">
                {items.map((c) => {
                  const movable = canMove(c);
                  const days = c.due ? daysBetween(today(), c.due) : undefined;
                  return (
                    <li key={c.key} className={`kcard${c.late ? ' late' : ''}${dragging === c.key ? ' dragging' : ''}`} draggable={movable}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', c.key); e.dataTransfer.effectAllowed = 'move'; setDragging(c.key); }} onDragEnd={() => { setDragging(null); setOver(null); }}>
                      <div className="kc-top">
                        {movable && <GripVertical className="grip" aria-hidden="true" />}
                        <Link to={c.path} className={`kc-tag ${c.kind}`}>{c.parentCode}</Link>
                        {c.late ? <span className="pill dot bad">Atrasado {-(days ?? 0)} d</span> : c.status !== 'done' && days !== undefined && days <= 7 ? <span className="pill dot warn">{days === 0 ? 'Vence hoje' : `Vence em ${days} d`}</span> : null}
                      </div>
                      <b className="kc-title">{c.title}</b>
                      <div className="kc-foot">
                        <span className="who" title={c.who}><span className="avatar" aria-hidden="true">{initials(c.who || '?')}</span>{c.who || 'Sem responsável'}</span>
                        <span className="muted">{c.due && <><CalendarClock size={13} aria-hidden="true" /> {fmtDate(c.due)}</>}{c.cost ? ` · ${brl(c.cost)}` : ''}</span>
                      </div>
                      {movable && (
                        <div className="kc-move">
                          {ci > 0 && <button className="btn ghost small" onClick={() => move(c.key, COLUMNS[ci - 1].id)} aria-label={`Mover "${c.title}" para ${COLUMNS[ci - 1].label}`}><ArrowLeft /></button>}
                          {ci < COLUMNS.length - 1 && <button className="btn ghost small" onClick={() => move(c.key, COLUMNS[ci + 1].id)} aria-label={`Mover "${c.title}" para ${COLUMNS[ci + 1].label}`}><ArrowRight /></button>}
                        </div>
                      )}
                    </li>
                  );
                })}
                {!items.length && <li className="kc-empty">{dragging ? 'Solte aqui' : 'Nada nesta coluna'}</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>Concluir uma ação aqui não encerra a não conformidade: a eficácia ainda é verificada na própria NC.</p>
    </div>
  );
}
