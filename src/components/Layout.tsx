import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BookOpen, ClipboardCheck, FileText, Gauge, LayoutDashboard, RotateCcw, ShieldCheck, TriangleAlert, Workflow } from 'lucide-react';
import { useStore } from '../data/store';
import { isLate } from '../data/utils';
import { ThemeToggle } from './ui';

export default function Layout() {
  const { db, reset } = useStore();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const late = db.ncs.filter(isLate).length;
  const links = [
    { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
    { to: '/nao-conformidades', label: 'Não conformidades', icon: TriangleAlert, count: late },
    { to: '/processos', label: 'Processos', icon: Workflow },
    { to: '/auditorias', label: 'Auditorias', icon: ClipboardCheck },
    { to: '/documentos', label: 'Documentos', icon: FileText },
    { to: '/indicadores', label: 'Indicadores', icon: Gauge },
    { to: '/sobre', label: 'Sobre o projeto', icon: BookOpen },
  ];
  return (
    <div className="app">
      <aside className="side">
        <div className="side-top">
          <NavLink to="/" className="brand"><span className="logo"><ShieldCheck /></span><div><b>SGQ Rotalume</b><small>Indústria · empresa fictícia</small></div></NavLink>
        </div>
        <nav className="nav" aria-label="Módulos">
          <span className="nav-label">Módulos</span>
          {links.map(({ to, label, icon: Icon, end, count }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon />{label}{count ? <span className="count" title={`${count} vencidas`}>{count}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <ThemeToggle />
          <span className="note">Os dados ficam salvos só neste navegador.</span>
          <button className="btn small ghost note" style={{ justifyContent: 'flex-start', paddingLeft: 0 }} onClick={() => { if (confirm('Restaurar os dados de exemplo? As alterações feitas neste navegador serão perdidas.')) reset(); }}>
            <RotateCcw />Restaurar dados de exemplo
          </button>
        </div>
      </aside>
      <div className="main">
        <Outlet />
        <footer className="foot">Projeto de portfólio de Breno Silva · Rotalume é uma empresa fictícia e todos os dados são simulados.</footer>
      </div>
    </div>
  );
}
