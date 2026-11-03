import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BookOpen, ClipboardCheck, Database, FileText, Gauge, LayoutDashboard, ShieldCheck, TriangleAlert, Workflow } from 'lucide-react';
import { useStore } from '../data/store';
import { isLate } from '../data/utils';
import { ThemeToggle, Toast } from './ui';

export default function Layout() {
  const { db, toast } = useStore();
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
    { to: '/dados', label: 'Dados e backup', icon: Database },
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
          <span className="note">Os dados ficam salvos neste navegador. Faça backup em <NavLink to="/dados">Dados e backup</NavLink>.</span>
        </div>
      </aside>
      <div className="main">
        <Outlet />
        <footer className="foot">Projeto de portfólio de Breno Silva · Rotalume é uma empresa fictícia e todos os dados são simulados.</footer>
      </div>
      {toast && <Toast key={toast.id} msg={toast.msg} />}
    </div>
  );
}
