import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import { importDB, useStore } from '../data/store';
import type { DB, Entity } from '../data/types';
import { ENTITY_LABEL } from '../data/changes';
import { ROLE_LABEL } from '../data/access';
import { LogLine, fmtDateTime } from '../components/History';
import { csv, download } from '../data/csv';
import { fmtDate, stageLabel, today } from '../data/utils';
import { Confirm } from '../components/ui';

export default function Data() {
  const { db, replace, reset, notify, can, sourceName } = useStore();
  const admin = can('edit', 'data');
  const [fEntity, setFEntity] = useState('');
  const [fUser, setFUser] = useState('');
  const [limit, setLimit] = useState(25);
  const logRows = db.log.filter((e) => (!fEntity || e.entity === fEntity) && (!fUser || e.user === fUser));
  const logUsers = [...new Set(db.log.map((e) => e.user))].sort();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<DB | null>(null);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '';

  const exportJson = () => { download(`sgq-rotalume-backup-${today()}.json`, JSON.stringify(db, null, 2), 'application/json'); notify('Backup baixado.'); };
  const exportNCs = () => {
    const rows: (string | number | undefined)[][] = [['Código', 'Título', 'Processo', 'Origem', 'Gravidade', 'Etapa', 'Responsável', 'Aberta em', 'Prazo', 'Encerrada em', 'Categoria 6M', 'Causa raiz', 'Ações', 'Ações concluídas', 'Investimento (R$)']];
    db.ncs.forEach((n) => rows.push([n.code, n.title, pname(n.processId), n.origin, n.severity, stageLabel(n.stage), n.owner, n.openedAt, n.dueAt, n.closedAt, n.category, n.rootCause, n.actions.length, n.actions.filter((a) => a.done).length, n.actions.reduce((s, a) => s + (a.howMuch || 0), 0)]));
    download(`nao-conformidades-${today()}.csv`, csv(rows), 'text/csv;charset=utf-8'); notify('Planilha de não conformidades baixada.');
  };
  const exportKpis = () => {
    const rows: (string | number | undefined)[][] = [['Indicador', 'Processo', 'Unidade', 'Meta', 'Sentido', 'Mês', 'Resultado', 'Na meta']];
    db.kpis.forEach((k) => k.values.forEach((v) => rows.push([k.name, pname(k.processId), k.unit, k.target, k.higherIsBetter ? 'maior é melhor' : 'menor é melhor', v.month, v.value, (k.higherIsBetter ? v.value >= k.target : v.value <= k.target) ? 'sim' : 'não'])));
    download(`indicadores-${today()}.csv`, csv(rows), 'text/csv;charset=utf-8'); notify('Planilha de indicadores baixada.');
  };
  const exportLog = () => {
    const rows: (string | number | undefined)[][] = [['Data e hora', 'Usuário', 'Perfil', 'Módulo', 'Registro', 'Ação', 'Campo', 'Antes', 'Depois']];
    db.log.forEach((e) => (e.fields.length ? e.fields : [{ field: '', from: '', to: '' }]).forEach((f) => rows.push([fmtDateTime(e.at), e.user, ROLE_LABEL[e.role], ENTITY_LABEL[e.entity], e.label, e.action, f.field, f.from, f.to])));
    download(`trilha-de-auditoria-${today()}.csv`, csv(rows), 'text/csv;charset=utf-8'); notify('Trilha de auditoria baixada.');
  };
  const pick = async (f?: File) => {
    setError('');
    if (!f) return;
    try {
      const data = importDB(JSON.parse(await f.text()));
      if (!data) throw new Error();
      setPending(data);
    } catch { setError('Esse arquivo não é um backup válido do SGQ Rotalume.'); }
    if (file.current) file.current.value = '';
  };

  return (
    <div className="page">
      <div className="page-head"><div><h1>Dados e backup</h1><p>Onde os dados ficam, backup, planilhas para Excel ou Power BI e a trilha de auditoria completa. Fonte de dados atual: <b>{sourceName}</b>.</p></div></div>
      <div className="tiles">
        <div className="tile"><span className="lab">Processos</span><span className="val">{db.processes.length}</span></div>
        <div className="tile"><span className="lab">Não conformidades</span><span className="val">{db.ncs.length}</span></div>
        <div className="tile"><span className="lab">Auditorias</span><span className="val">{db.audits.length}</span></div>
        <div className="tile"><span className="lab">Documentos</span><span className="val">{db.docs.length}</span></div>
        <div className="tile"><span className="lab">Indicadores</span><span className="val">{db.kpis.length}</span></div>
        <div className="tile"><span className="lab">Riscos e oportunidades</span><span className="val">{db.risks.length}</span></div>
        <div className="tile"><span className="lab">Análises críticas</span><span className="val">{db.reviews.length}</span></div>
        <div className="tile"><span className="lab">Reclamações</span><span className="val">{db.complaints.length}</span></div>
        <div className="tile"><span className="lab">Fornecedores</span><span className="val">{db.suppliers.length}</span></div>
        <div className="tile"><span className="lab">Treinamentos</span><span className="val">{db.trainings.length}</span></div>
        <div className="tile"><span className="lab">Objetivos</span><span className="val">{db.objectives.length}</span></div>
        <div className="tile"><span className="lab">Alterações registradas</span><span className="val">{db.log.length}</span></div>
      </div>
      <div className="data-grid">
        <section className="card">
          <h2>Backup completo</h2>
          <p>Arquivo .json com todos os módulos. Serve para restaurar depois neste ou em outro navegador.</p>
          <button className="btn primary" onClick={exportJson}><Download />Baixar backup</button>
        </section>
        <section className="card">
          <h2>Restaurar backup</h2>
          <p>Substitui os dados atuais pelos do arquivo. Você confirma antes.</p>
          {!admin && <p className="muted">Só a gestão da qualidade pode restaurar backups.</p>}
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => pick(e.target.files?.[0])} aria-label="Arquivo de backup" />
          <button className="btn" disabled={!admin} onClick={() => file.current?.click()}><Upload />Escolher arquivo</button>
          {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
        </section>
        <section className="card">
          <h2>Planilhas</h2>
          <p>CSV separado por ponto e vírgula, abre direto no Excel.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={exportNCs}><FileSpreadsheet />Não conformidades</button>
            <button className="btn" onClick={exportKpis}><FileSpreadsheet />Indicadores</button>
            <button className="btn" onClick={exportLog}><FileSpreadsheet />Trilha de auditoria</button>
          </div>
        </section>
        <section className="card">
          <h2>Dados de exemplo</h2>
          <p>Volta ao estado inicial da Rotalume. As datas são recalculadas a partir de hoje.</p>
          <button className="btn danger" disabled={!admin} onClick={() => setResetting(true)}><RotateCcw />Restaurar dados de exemplo</button>
        </section>
      </div>
      <section className="card" id="trilha">
        <div className="card-h">
          <div><h2>Trilha de auditoria</h2><p className="how" style={{ margin: '2px 0 0' }}>Toda criação, alteração e exclusão, com usuário, data e valor anterior (ISO 9001, 7.5.3). Edições seguidas no mesmo campo viram uma linha só.</p></div>
        </div>
        <div className="toolbar" style={{ marginBottom: 6 }}>
          <select className="input" value={fEntity} onChange={(e) => { setFEntity(e.target.value); setLimit(25); }} aria-label="Módulo"><option value="">Todos os módulos</option>{(Object.keys(ENTITY_LABEL) as Entity[]).map((k) => <option key={k} value={k}>{ENTITY_LABEL[k]}</option>)}</select>
          <select className="input" value={fUser} onChange={(e) => { setFUser(e.target.value); setLimit(25); }} aria-label="Usuário"><option value="">Todos os usuários</option>{logUsers.map((u) => <option key={u}>{u}</option>)}</select>
        </div>
        {logRows.length ? <ul className="log">{logRows.slice(0, limit).map((e) => <LogLine key={e.id} e={e} showRecord />)}</ul> : <p className="muted" style={{ margin: 0 }}>Nenhuma alteração com esses filtros.</p>}
        {logRows.length > limit && <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => setLimit(limit + 50)}>Ver mais ({logRows.length - limit} restantes)</button>}
      </section>
      {pending && (
        <Confirm title="Restaurar este backup?" confirmLabel="Substituir dados" onClose={() => setPending(null)} onConfirm={() => { replace(pending); setPending(null); notify('Backup restaurado.'); }}>
          <p>O arquivo tem {pending.processes.length} processos, {pending.ncs.length} não conformidades, {pending.audits.length} auditorias, {pending.docs.length} documentos e {pending.kpis.length} indicadores{pending.seededAt ? `, com base criada em ${fmtDate(pending.seededAt)}` : ''}.</p>
          <p>Os dados atuais deste navegador serão substituídos. Se quiser guardá-los, baixe um backup antes.</p>
        </Confirm>
      )}
      {resetting && (
        <Confirm title="Restaurar dados de exemplo?" confirmLabel="Restaurar" onClose={() => setResetting(false)} onConfirm={() => { reset(); setResetting(false); notify('Dados de exemplo restaurados.'); }}>
          <p>Tudo o que foi criado ou alterado neste navegador será perdido.</p>
        </Confirm>
      )}
    </div>
  );
}
