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

const NotFound = () => <div className="page"><h1>Página não encontrada</h1><p className="ink2">Esse endereço não existe no sistema.</p><Link className="btn" to="/" style={{ justifySelf: 'start' }}>Voltar ao painel</Link></div>;

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="nao-conformidades" element={<NCList />} />
            <Route path="nao-conformidades/:id" element={<NCDetail />} />
            <Route path="processos" element={<Processes />} />
            <Route path="processos/:id" element={<ProcessDetail />} />
            <Route path="auditorias" element={<Audits />} />
            <Route path="auditorias/:id" element={<AuditDetail />} />
            <Route path="documentos" element={<Documents />} />
            <Route path="documentos/:id" element={<DocumentDetail />} />
            <Route path="indicadores" element={<Indicators />} />
            <Route path="indicadores/:id" element={<IndicatorDetail />} />
            <Route path="sobre" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
