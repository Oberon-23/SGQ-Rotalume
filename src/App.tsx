import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './data/store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
const NCList = lazy(() => import('./pages/NCList'));
const NCDetail = lazy(() => import('./pages/NCDetail'));
const Processes = lazy(() => import('./pages/Processes'));
const ProcessDetail = lazy(() => import('./pages/Processes').then((m) => ({ default: m.ProcessDetail })));
const Audits = lazy(() => import('./pages/Audits'));
const AuditDetail = lazy(() => import('./pages/Audits').then((m) => ({ default: m.AuditDetail })));
const Documents = lazy(() => import('./pages/Documents'));
const DocumentDetail = lazy(() => import('./pages/Documents').then((m) => ({ default: m.DocumentDetail })));
const Indicators = lazy(() => import('./pages/Indicators'));
const IndicatorDetail = lazy(() => import('./pages/Indicators').then((m) => ({ default: m.IndicatorDetail })));
const About = lazy(() => import('./pages/About'));
const Data = lazy(() => import('./pages/Data'));
const Risks = lazy(() => import('./pages/Risks'));
const RiskDetail = lazy(() => import('./pages/Risks').then((m) => ({ default: m.RiskDetail })));
const Reviews = lazy(() => import('./pages/Reviews'));
const ReviewDetail = lazy(() => import('./pages/Reviews').then((m) => ({ default: m.ReviewDetail })));
const Print = lazy(() => import('./pages/Print'));
const MyTasks = lazy(() => import('./pages/MyTasks'));

const NotFound = () => <div className="page"><h1>Página não encontrada</h1><p className="ink2">Esse endereço não existe no sistema.</p><Link className="btn" to="/" style={{ justifySelf: 'start' }}>Voltar ao painel</Link></div>;

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="page"><p className="ink2" role="status">Carregando…</p></div>}>
        <Routes>
          <Route path="imprimir/:kind/:id" element={<Print />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="minhas-pendencias" element={<MyTasks />} />
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
        </Suspense>
      </BrowserRouter>
    </StoreProvider>
  );
}
