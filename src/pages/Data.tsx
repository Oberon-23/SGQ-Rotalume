import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import { isDB, useStore } from '../data/store';
import type { DB } from '../data/types';
import { fmtDate, stageLabel, today } from '../data/utils';
import { Confirm } from '../components/ui';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV com ponto e vírgula e BOM, para abrir certo no Excel em português. */
function csv(rows: (string | number | undefined)[][]) {
  const cell = (v: string | number | undefined) => { const s = v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v; return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

export default function Data() {
  const { db, replace, reset, notify } = useStore();
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
  const pick = async (f?: File) => {
    setError('');
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!isDB(data)) throw new Error();
      setPending(data);
    } catch { setError('Esse arquivo não é um backup válido do SGQ Rotalume.'); }
    if (file.current) file.current.value = '';
  };

  return (
    <div className="page">
      <div className="page-head"><div><h1>Dados e backup</h1><p>Tudo o que você cadastra fica salvo neste navegador. Baixe um backup para guardar ou levar para outro computador, e exporte planilhas para Excel ou Power BI.</p></div></div>
      <div className="tiles five">
        <div className="tile"><span className="lab">Processos</span><span className="val">{db.processes.length}</span></div>
        <div className="tile"><span className="lab">Não conformidades</span><span className="val">{db.ncs.length}</span></div>
        <div className="tile"><span className="lab">Auditorias</span><span className="val">{db.audits.length}</span></div>
        <div className="tile"><span className="lab">Documentos</span><span className="val">{db.docs.length}</span></div>
        <div className="tile"><span className="lab">Indicadores</span><span className="val">{db.kpis.length}</span></div>
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
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => pick(e.target.files?.[0])} aria-label="Arquivo de backup" />
          <button className="btn" onClick={() => file.current?.click()}><Upload />Escolher arquivo</button>
          {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
        </section>
        <section className="card">
          <h2>Planilhas</h2>
          <p>CSV separado por ponto e vírgula, abre direto no Excel.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={exportNCs}><FileSpreadsheet />Não conformidades</button>
            <button className="btn" onClick={exportKpis}><FileSpreadsheet />Indicadores</button>
          </div>
        </section>
        <section className="card">
          <h2>Dados de exemplo</h2>
          <p>Volta ao estado inicial da Rotalume. As datas são recalculadas a partir de hoje.</p>
          <button className="btn danger" onClick={() => setResetting(true)}><RotateCcw />Restaurar dados de exemplo</button>
        </section>
      </div>
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
