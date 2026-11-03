/* Exportação de arquivos (CSV e JSON) pelo navegador. */

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV com ponto e vírgula e BOM, para abrir certo no Excel em português. */
export function csv(rows: (string | number | undefined)[][]) {
  const cell = (v: string | number | undefined) => { const s = v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v; return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}
