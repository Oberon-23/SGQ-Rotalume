import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useStore } from '../data/store';
import { SIX_M } from '../data/types';
import { auditFindings, brl, daysBetween, fmtDate, stageLabel } from '../data/utils';
import { fmtDateTime } from '../components/History';

const RESULT: Record<string, string> = { C: 'Conforme', NC: 'Não conformidade', OBS: 'Observação', OM: 'Oportunidade de melhoria' };

function Sheet({ title, form, code, children, back }: { title: string; form: string; code: string; children: ReactNode; back: string }) {
  const { user } = useStore();
  useEffect(() => {
    const prev = document.title;
    document.title = `${code} · ${title}`;
    document.documentElement.setAttribute('data-print', '');
    return () => { document.title = prev; document.documentElement.removeAttribute('data-print'); };
  }, [code, title]);
  return (
    <div className="print-wrap">
      <div className="print-bar">
        <Link className="btn" to={back}><ArrowLeft />Voltar ao sistema</Link>
        <span className="muted">Na janela de impressão, escolha <b>Salvar como PDF</b>.</span>
        <button className="btn primary" onClick={() => window.print()}><Printer />Imprimir ou salvar PDF</button>
      </div>
      <article className="sheet">
        <header className="sheet-h">
          <div><b>Rotalume Indústria</b><span>Sistema de Gestão da Qualidade</span></div>
          <div className="sheet-title"><h1>{title}</h1><span className="mono">{code}</span></div>
          <div className="sheet-form"><span>{form}</span><span>Empresa fictícia</span></div>
        </header>
        {children}
        <footer className="sheet-f">Emitido em {fmtDateTime(new Date().toISOString())} por {user.name} pelo SGQ Rotalume. Documento de demonstração (dados fictícios).</footer>
      </article>
    </div>
  );
}

const Box = ({ title, children }: { title: string; children: ReactNode }) => <section className="sbox" tabIndex={0} aria-label={title}><h2>{title}</h2>{children}</section>;
const Grid = ({ rows }: { rows: [string, ReactNode][] }) => <dl className="sgrid">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl>;
const Signs = ({ who }: { who: [string, string][] }) => <div className="signs">{who.map(([role, name]) => <div key={role}><span className="line" /><b>{name || ' '}</b><small>{role}</small><small>Data: ____/____/______</small></div>)}</div>;

export default function Print() {
  const { kind, id } = useParams();
  const { db } = useStore();
  const pname = (pid: string) => db.processes.find((p) => p.id === pid)?.name ?? '—';
  const notFound = <div className="page"><p>Registro não encontrado.</p><Link className="btn" to="/">Voltar</Link></div>;

  if (kind === 'nc') {
    const n = db.ncs.find((x) => x.id === id);
    if (!n) return notFound;
    const proc = db.processes.find((p) => p.id === n.processId);
    return (
      <Sheet title="Relatório de Não Conformidade" form="FR-QUA-001 rev. 2" code={n.code} back={`/nao-conformidades/${n.id}`}>
        <Box title="1. Identificação">
          <Grid rows={[['Título', n.title], ['Processo', pname(n.processId)], ['Origem', `${n.origin}${n.auditId ? ` (${db.audits.find((a) => a.id === n.auditId)?.code ?? ''})` : ''}`], ['Gravidade', n.severity], ['Responsável', n.owner], ['Etapa atual', stageLabel(n.stage)], ['Aberta em', fmtDate(n.openedAt)], ['Prazo', fmtDate(n.dueAt)]]} />
        </Box>
        <Box title="2. Descrição e contenção"><p><b>O que aconteceu:</b> {n.description || '—'}</p><p><b>Contenção imediata:</b> {n.containment || '—'}</p></Box>
        <Box title="3. Análise de causa">
          <ol className="whys-p">{n.whys.filter((w) => w?.trim()).map((w, i) => <li key={i}><b>{i + 1}º por quê:</b> {w}</li>)}</ol>
          <table className="stable"><thead><tr><th>6M</th><th>Causas levantadas (Ishikawa)</th></tr></thead>
            <tbody>{SIX_M.map((m) => <tr key={m} className={n.category === m ? 'hl' : ''}><td>{m}{n.category === m ? ' ★' : ''}</td><td>{n.ishikawa[m].join('; ') || '—'}</td></tr>)}</tbody></table>
          <p><b>Causa raiz{n.category ? ` (${n.category})` : ''}:</b> {n.rootCause || '—'}</p>
        </Box>
        <Box title="4. Plano de ação (5W2H)">
          {n.actions.length ? <table className="stable"><thead><tr><th>O quê</th><th>Por quê</th><th>Onde</th><th>Quem</th><th>Quando</th><th>Como</th><th>Quanto</th><th>Status</th></tr></thead>
            <tbody>{n.actions.map((a) => <tr key={a.id}><td>{a.what}</td><td>{a.why}</td><td>{a.where}</td><td>{a.who}</td><td>{fmtDate(a.when)}</td><td>{a.how}</td><td>{brl(a.howMuch || 0)}</td><td>{a.done ? 'Concluída' : 'Pendente'}</td></tr>)}</tbody></table> : <p>Nenhuma ação registrada.</p>}
        </Box>
        <Box title="5. Verificação de eficácia">
          <Grid rows={[['Ação eficaz?', n.verification.effective === true ? 'Sim' : n.verification.effective === false ? 'Não' : 'Ainda não verificada'], ['Data', fmtDate(n.verification.date)], ['Encerrada em', n.closedAt ? `${fmtDate(n.closedAt)} (${daysBetween(n.openedAt, n.closedAt)} dias)` : 'Em aberto']]} />
          <p><b>Evidência:</b> {n.verification.evidence || '—'}</p>
        </Box>
        <Signs who={[['Responsável pelo tratamento', n.owner], ['Dono do processo', proc?.owner ?? ''], ['Gestão da qualidade', '']]} />
      </Sheet>
    );
  }

  if (kind === 'auditoria') {
    const a = db.audits.find((x) => x.id === id);
    if (!a) return notFound;
    const f = auditFindings(a);
    const proc = db.processes.find((p) => p.id === a.processId);
    return (
      <Sheet title="Relatório de Auditoria Interna" form="FR-QUA-004 rev. 1" code={a.code} back={`/auditorias/${a.id}`}>
        <Box title="1. Identificação">
          <Grid rows={[['Processo auditado', proc ? `${proc.code} · ${proc.name}` : '—'], ['Dono do processo', proc?.owner], ['Auditor', a.auditor], ['Data', fmtDate(a.date)], ['Situação', a.done ? 'Realizada' : 'Programada'], ['Norma de referência', 'ISO 9001:2015']]} />
          <p><b>Escopo:</b> {a.scope || '—'}</p>
        </Box>
        <Box title="2. Resumo">
          <Grid rows={[['Requisitos avaliados', `${a.items.length - f.pending} de ${a.items.length}`], ['Não conformidades', String(f.nc)], ['Observações', String(f.obs)], ['Oportunidades de melhoria', String(f.om)]]} />
        </Box>
        <Box title="3. Checklist e evidências">
          <table className="stable"><thead><tr><th>Cláusula</th><th>Requisito</th><th>Resultado</th><th>Evidência</th><th>Tratamento</th></tr></thead>
            <tbody>{a.items.map((i) => <tr key={i.id} className={i.result === 'NC' ? 'hl' : ''}><td className="mono">{i.clause}</td><td>{i.requirement}</td><td>{i.result ? RESULT[i.result] : 'Não avaliado'}</td><td>{i.evidence || '—'}</td><td>{i.ncId ? db.ncs.find((n) => n.id === i.ncId)?.code ?? '—' : '—'}</td></tr>)}</tbody></table>
        </Box>
        <Signs who={[['Auditor', a.auditor], ['Dono do processo auditado', proc?.owner ?? ''], ['Gestão da qualidade', '']]} />
      </Sheet>
    );
  }

  if (kind === 'analise') {
    const r = db.reviews.find((x) => x.id === id);
    if (!r) return notFound;
    return (
      <Sheet title="Ata de Análise Crítica pela Direção" form="FR-QUA-007 rev. 1" code={r.code} back={`/analise-critica/${r.id}`}>
        <Box title="1. Reunião">
          <Grid rows={[['Data', fmtDate(r.date)], ['Período analisado', `${fmtDate(r.from)} a ${fmtDate(r.to)}`], ['Situação', r.closed ? 'Concluída' : 'Em andamento']]} />
          <p><b>Participantes:</b> {r.participants || '—'}</p>
          <p><b>Mudanças em questões internas e externas (9.3.2 b):</b> {r.context || '—'}</p>
        </Box>
        <Box title="2. Entradas (9.3.2)">
          {r.inputs.map((s) => <div key={s.clause} className="sinput"><h3>{s.clause} · {s.title}</h3><ul>{s.items.map((it, i) => <li key={i}>{it}</li>)}</ul></div>)}
        </Box>
        <Box title="3. Decisões e ações (9.3.3)">
          {r.decisions.length ? <table className="stable"><thead><tr><th>#</th><th>Decisão</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
            <tbody>{r.decisions.map((d, i) => <tr key={d.id}><td>{i + 1}</td><td>{d.text}</td><td>{d.owner}</td><td>{fmtDate(d.due)}</td><td>{d.done ? 'Concluída' : 'Pendente'}</td></tr>)}</tbody></table> : <p>Nenhuma decisão registrada.</p>}
        </Box>
        <Box title="4. Conclusão"><p>{r.conclusion || '—'}</p></Box>
        <Signs who={[['Diretoria', db.processes.find((p) => p.id === 'p01')?.owner ?? ''], ['Gestão da qualidade', 'Marina Lopes']]} />
      </Sheet>
    );
  }
  return notFound;
}
