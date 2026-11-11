import { useRef, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { Attachment } from '../data/types';
import { MAX_FILE, MAX_FILES, fmtSize } from '../data/quality';
import { uid } from '../data/utils';

const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,.xlsx,.docx';
/** Folga para o localStorage do navegador (cerca de 5 MB no total). */
const STORAGE_BUDGET = 4.2 * 1024 * 1024;

const read = (f: File) => new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => fail(r.error); r.readAsDataURL(f); });

/** Evidências anexadas a uma NC ou auditoria. No modo demonstração ficam no navegador; com banco, vão para o armazenamento de arquivos. */
export default function Attachments({ entity, id, canEdit }: { entity: 'ncs' | 'audits'; id: string; canEdit: boolean }) {
  const { db, update, notify, user } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const rec = (db[entity] as { id: string; attachments?: Attachment[] }[]).find((x) => x.id === id);
  const list = rec?.attachments ?? [];
  const pick = async (files: FileList | null) => {
    setError('');
    if (!files?.length) return;
    const room = MAX_FILES - list.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Cabem até ${MAX_FILES} anexos por registro.`);
    const tooBig = chosen.filter((f) => f.size > MAX_FILE);
    if (tooBig.length) { setError(`No modo demonstração cada arquivo pode ter até ${fmtSize(MAX_FILE)}: ${tooBig.map((f) => f.name).join(', ')}.`); }
    const ok = chosen.filter((f) => f.size <= MAX_FILE);
    if (!ok.length) return;
    let used = 0;
    try { used = (localStorage.getItem('sgq-rotalume') ?? '').length; } catch { /* sem armazenamento */ }
    if (used + ok.reduce((s, f) => s + f.size * 1.37, 0) > STORAGE_BUDGET) { setError('O armazenamento deste navegador está quase cheio. Exclua anexos antigos ou faça backup e restaure os dados de exemplo.'); return; }
    const added: Attachment[] = await Promise.all(ok.map(async (f) => ({ id: uid('a'), name: f.name, type: f.type || 'application/octet-stream', size: f.size, data: await read(f), at: new Date().toISOString(), user: user.name })));
    update((d) => { const x = (d[entity] as { id: string; attachments?: Attachment[] }[]).find((y) => y.id === id); if (x) x.attachments = [...(x.attachments ?? []), ...added]; });
    notify(added.length === 1 ? `${added[0].name} anexado.` : `${added.length} arquivos anexados.`);
    if (input.current) input.current.value = '';
  };
  const remove = (a: Attachment) => { update((d) => { const x = (d[entity] as { id: string; attachments?: Attachment[] }[]).find((y) => y.id === id); if (x) x.attachments = (x.attachments ?? []).filter((y) => y.id !== a.id); }); notify(`${a.name} removido.`); };
  return (
    <section className="card">
      <div className="card-h">
        <div><h2>Evidências anexadas</h2><p className="how" style={{ margin: '2px 0 0' }}>Fotos, laudos e registros que comprovam o que foi feito. Até {MAX_FILES} arquivos de {fmtSize(MAX_FILE)} cada, salvos neste navegador.</p></div>
        {canEdit && list.length < MAX_FILES && (
          <>
            <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" id={`up-${id}`} onChange={(e) => pick(e.target.files)} />
            <label htmlFor={`up-${id}`} className="btn" tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}><Paperclip />Anexar arquivo</label>
          </>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {list.length ? (
        <ul className="files">
          {list.map((a) => (
            <li key={a.id}>
              {a.type.startsWith('image/') ? <img src={a.data} alt="" /> : <span className="ficon">{a.type === 'application/pdf' ? <FileText /> : <ImageIcon />}</span>}
              <span className="fmeta"><b title={a.name}>{a.name}</b><span>{fmtSize(a.size)} · {a.user} · {new Date(a.at).toLocaleDateString('pt-BR')}</span></span>
              <a className="btn ghost small" href={a.data} download={a.name} aria-label={`Baixar ${a.name}`}><Download /></a>
              {canEdit && <button className="btn ghost small danger" onClick={() => remove(a)} aria-label={`Remover ${a.name}`}><Trash2 /></button>}
            </li>
          ))}
        </ul>
      ) : <p className="muted" style={{ margin: 0, fontSize: 14 }}>Nenhum arquivo anexado.</p>}
    </section>
  );
}
