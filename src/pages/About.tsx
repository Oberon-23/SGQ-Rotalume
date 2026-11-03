import { Link } from 'react-router-dom';

const MAP: [string, string, string, string][] = [
  ['4.4', 'Sistema de gestão e seus processos', 'Processos', '/processos'],
  ['6.1', 'Ações para abordar riscos e oportunidades', 'Riscos e oportunidades', '/riscos'],
  ['7.5', 'Informação documentada (inclui a trilha de alterações)', 'Documentos e Dados', '/documentos'],
  ['9.1', 'Monitoramento, medição, análise e avaliação', 'Indicadores', '/indicadores'],
  ['9.2', 'Auditoria interna', 'Auditorias', '/auditorias'],
  ['9.3', 'Análise crítica pela direção', 'Análise crítica', '/analise-critica'],
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
          <ul><li>5 Porquês e diagrama de Ishikawa (6M) para a causa raiz;</li><li>Plano de ação 5W2H;</li><li>SIPOC e mapa de processos;</li><li>Matriz de riscos 5×5 (probabilidade × impacto);</li><li>Checklist de auditoria por requisito da ISO 9001;</li><li>Indicadores com meta e sentido (maior ou menor é melhor);</li><li>Análise crítica com as entradas da cláusula 9.3.2 montadas a partir dos dados.</li></ul>
          <p><b>Perfis de demonstração:</b> no topo da página você troca entre gestora da qualidade, dono de processo, auditor e leitor para ver o que cada papel pode fazer. Toda alteração entra na trilha de auditoria com usuário, data e valor anterior.</p>
          <p><b>No dia a dia:</b> "Minhas pendências" mostra o que está com cada pessoa, o sino avisa dos prazos, a busca (<kbd>Ctrl</kbd> + <kbd>K</kbd>) acha qualquer registro e as listas ordenam, paginam e permitem ações em lote.</p>
        </div></section>
        <section className="card s5"><h2>Como os dados funcionam</h2><div className="prose" style={{ marginTop: 10 }}>
          <p>Não há servidor. Tudo fica salvo <b>no seu navegador</b> (localStorage) e ninguém mais vê as suas alterações.</p>
          <p>Todos os módulos permitem <b>criar, editar e excluir</b>: processos e SIPOC, não conformidades (inclusive voltar etapa e reabrir), auditorias e checklist, documentos, indicadores e resultados.</p>
          <p>Em <Link to="/dados">Dados e backup</Link> você baixa um backup .json para levar a outro computador, restaura um backup, exporta planilhas CSV para Excel ou Power BI e volta aos dados de exemplo.</p>
          <p>As datas dos exemplos são calculadas a partir de hoje, então sempre há itens vencidos, a vencer e auditorias programadas.</p>
          <p>As telas não acessam o armazenamento diretamente: tudo passa por uma camada de dados que calcula o que mudou. Para levar a um banco real (por exemplo, Postgres no Supabase), troca-se só essa camada.</p>
          <p><b>Feito com:</b> React, TypeScript e Vite, com testes automatizados (Vitest) rodando no GitHub Actions. Publicado na Vercel.</p>
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
