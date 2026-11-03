import { Link } from 'react-router-dom';

const MAP: [string, string, string, string][] = [
  ['4.4', 'Sistema de gestão e seus processos', 'Processos', '/processos'],
  ['7.5', 'Informação documentada', 'Documentos', '/documentos'],
  ['9.1', 'Monitoramento, medição, análise e avaliação', 'Indicadores', '/indicadores'],
  ['9.2', 'Auditoria interna', 'Auditorias', '/auditorias'],
  ['10.2', 'Não conformidade e ação corretiva', 'Não conformidades', '/nao-conformidades'],
];

export default function About() {
  return (
    <div className="page">
      <div className="page-head"><div><h1>Sobre o projeto</h1><p>Um sistema de gestão da qualidade (SGQ) simples, feito como projeto de portfólio.</p></div></div>
      <div className="grid">
        <section className="card s7"><h2>O que é</h2><div className="prose" style={{ marginTop: 10 }}>
          <p>A <b>Rotalume Indústria</b> é fictícia: fabrica eixos e conjuntos em três linhas (usinagem, montagem e pintura). É a mesma fábrica do <a href="https://painel-qualidade-rotalume.vercel.app" target="_blank" rel="noreferrer">painel de Qualidade</a>. O painel <b>mostra</b> os indicadores; este sistema é onde o trabalho acontece: registrar o problema, achar a causa, agir e confirmar que funcionou.</p>
          <p>O tratamento de não conformidades segue o <b>PDCA</b> e só avança quando cada etapa está completa: não dá para ir ao plano de ação sem causa raiz, nem encerrar sem evidência de eficácia. Se a ação não foi eficaz, o tratamento volta para a análise de causa.</p>
          <p><b>Ferramentas da qualidade usadas:</b></p>
          <ul><li>5 Porquês e diagrama de Ishikawa (6M) para a causa raiz;</li><li>Plano de ação 5W2H;</li><li>SIPOC e mapa de processos;</li><li>Checklist de auditoria por requisito da ISO 9001;</li><li>Indicadores com meta e sentido (maior ou menor é melhor).</li></ul>
        </div></section>
        <section className="card s5"><h2>Como os dados funcionam</h2><div className="prose" style={{ marginTop: 10 }}>
          <p>Não há servidor. Tudo fica salvo <b>no seu navegador</b> (localStorage) e ninguém mais vê as suas alterações.</p>
          <p>Todos os módulos permitem <b>criar, editar e excluir</b>: processos e SIPOC, não conformidades (inclusive voltar etapa e reabrir), auditorias e checklist, documentos, indicadores e resultados.</p>
          <p>Em <Link to="/dados">Dados e backup</Link> você baixa um backup .json para levar a outro computador, restaura um backup, exporta planilhas CSV para Excel ou Power BI e volta aos dados de exemplo.</p>
          <p>As datas dos exemplos são calculadas a partir de hoje, então sempre há itens vencidos, a vencer e auditorias programadas.</p>
          <p><b>Feito com:</b> React, TypeScript e Vite. Publicado na Vercel.</p>
        </div></section>
        <section className="card s12"><h2>Requisitos da ISO 9001:2015 cobertos</h2>
          <div className="tscroll" style={{ marginTop: 12 }}><table>
            <thead><tr><th>Cláusula</th><th>Requisito</th><th>Módulo</th></tr></thead>
            <tbody>{MAP.map(([c, r, m, to]) => <tr key={c}><td className="mono">{c}</td><td>{r}</td><td><Link to={to}>{m}</Link></td></tr>)}</tbody>
          </table></div>
        </section>
      </div>
    </div>
  );
}
