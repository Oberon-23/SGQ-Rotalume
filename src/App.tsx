import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { RealtimeSync, Splash, useCloud } from './components/CloudRoot';
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
const Complaints = lazy(() => import('./pages/Complaints'));
const ComplaintDetail = lazy(() => import('./pages/Complaints').then((m) => ({ default: m.ComplaintDetail })));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const SupplierDetail = lazy(() => import('./pages/Suppliers').then((m) => ({ default: m.SupplierDetail })));
const Trainings = lazy(() => import('./pages/Trainings'));
const TrainingDetail = lazy(() => import('./pages/Trainings').then((m) => ({ default: m.TrainingDetail })));
const Objectives = lazy(() => import('./pages/Objectives'));
const Board = lazy(() => import('./pages/Board'));
const Login = lazy(() => import('./pages/Login'));
const People = lazy(() => import('./pages/People'));
const MyTasks = lazy(() => import('./pages/MyTasks'));

const NotFound = () => <div className="page"><h1>Página não encontrada</h1><p className="ink2">Esse endereço não existe no sistema.</p><Link className="btn" to="/" style={{ justifySelf: 'start' }}>Voltar ao painel</Link></div>;

export default function App() {
  return <BrowserRouter><Root /></BrowserRouter>;
}

function Root() {
  const { state, start, leave } = useCloud();
  if (state.status === 'loading') return <Splash />;
  const ready = state.status === 'ready' ? state : null;
  return (
    <StoreProvider key={ready ? ready.profile.user_id : 'demo'} initial={ready?.db} source={ready?.source} account={ready?.account} empresaId={ready?.profile.empresa_id} signOut={ready ? () => void leave() : undefined}>
        {ready && <RealtimeSync empresaId={ready.profile.empresa_id} me={ready.profile.user_id} />}
        <Suspense fallback={<div className="page"><p className="ink2" role="status">Carregando…</p></div>}>
        <Routes>
          <Route path="imprimir/:kind/:id" element={<Print />} />
          <Route path="entrar" element={<Login onLogged={start} error={state.status === 'demo' ? state.error : undefined} />} />
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
            <Route path="quadro" element={<Board />} />
            <Route path="reclamacoes" element={<Complaints />} />
            <Route path="reclamacoes/:id" element={<ComplaintDetail />} />
            <Route path="fornecedores" element={<Suppliers />} />
            <Route path="fornecedores/:id" element={<SupplierDetail />} />
            <Route path="treinamentos" element={<Trainings />} />
            <Route path="treinamentos/:id" element={<TrainingDetail />} />
            <Route path="objetivos" element={<Objectives />} />
            <Route path="objetivos/:id" element={<Objectives />} />
            <Route path="dados" element={<Data />} />
            <Route path="sobre" element={<About />} />
            <Route path="pessoas" element={<People />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </Suspense>
    </StoreProvider>
  );
}
