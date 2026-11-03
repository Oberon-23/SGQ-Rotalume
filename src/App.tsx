import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './data/store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NCList from './pages/NCList';
import NCDetail from './pages/NCDetail';
import Processes, { ProcessDetail } from './pages/Processes';
import Audits, { AuditDetail } from './pages/Audits';
import Documents, { DocumentDetail } from './pages/Documents';
import Indicators, { IndicatorDetail } from './pages/Indicators';
import About from './pages/About';
import Data from './pages/Data';
import Risks, { RiskDetail } from './pages/Risks';
import Reviews, { ReviewDetail } from './pages/Reviews';
import Print from './pages/Print';

const NotFound = () => <div className="page"><h1>Página não encontrada</h1><p className="ink2">Esse endereço não existe no sistema.</p><Link className="btn" to="/" style={{ justifySelf: 'start' }}>Voltar ao painel</Link></div>;

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="imprimir/:kind/:id" element={<Print />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="nao-conformidades" element={<NCList />} />
            <Route path="nao-conformidades/:id" element={<NCDetail />} />
            <Route path="processos" element={<Processes />} />
            <Route path="processos/:id" element={<ProcessDetail />} />
            <Route path="riscos" element={<Risks />} />
            <Route path="riscos/:id" element={<RiskDetail />} />
            <Route path="analise-critica" element={<Reviews />} />
            <Route path="analise-critica/:id" element={<ReviewDetail />} />
            <Route path="auditorias" element={<Audits />} />
            <Route path="auditorias/:id" element={<AuditDetail />} />
            <Route path="documentos" element={<Documents />} />
            <Route path="documentos/:id" element={<DocumentDetail />} />
            <Route path="indicadores" element={<Indicators />} />
            <Route path="indicadores/:id" element={<IndicatorDetail />} />
            <Route path="dados" element={<Data />} />
            <Route path="sobre" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
