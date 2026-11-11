import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BookOpen, ClipboardCheck, ClipboardList, Database, FileText, Gauge, LayoutDashboard, Presentation, ShieldAlert, ShieldCheck, TriangleAlert, Workflow } from 'lucide-react';
import TopBar from './DemoBar';
import SearchPalette from './Search';
import Tour, { tourSeen } from './Tour';
import { tasksFor } from '../data/pending';
import { useStore } from '../data/store';
import { isLate } from '../data/utils';
import { ThemeToggle, Toast } from './ui';

export default function Layout() {
  const { db, toast, user } = useStore();
  const { pathname } = useLocation();
  const [searching, setSearching] = useState(false);
  const [touring, setTouring] = useState(() => !tourSeen());
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setSearching(true); }
      else if (e.key === '/' && !typing && !document.querySelector('.overlay')) { e.preventDefault(); setSearching(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const late = db.ncs.filter(isLate).length;
  const myLate = user.role === 'leitor' ? 0 : tasksFor(db, user.name).filter((t) => (t.days ?? 1) < 0).length;
  type NavItem = { to: string; label: string; icon: typeof Gauge; end?: boolean; count?: number; countTitle?: string };
  const groups: { label: string; items: NavItem[] }[] = [
    { label: 'Hoje', items: [
      { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
      { to: '/minhas-pendencias', label: 'Minhas pendências', icon: ClipboardList, count: myLate, countTitle: 'pendências vencidas' },
      { to: '/nao-conformidades', label: 'Não conformidades', icon: TriangleAlert, count: late, countTitle: 'não conformidades vencidas' },
    ] },
    { label: 'Planejamento', items: [
      { to: '/processos', label: 'Processos', icon: Workflow },
      { to: '/riscos', label: 'Riscos e oportunidades', icon: ShieldAlert },
      { to: '/indicadores', label: 'Indicadores', icon: Gauge },
    ] },
    { label: 'Verificação', items: [
      { to: '/auditorias', label: 'Auditorias', icon: ClipboardCheck },
      { to: '/documentos', label: 'Documentos', icon: FileText },
      { to: '/analise-critica', label: 'Análise crítica', icon: Presentation },
    ] },
    { label: 'Sistema', items: [
      { to: '/dados', label: 'Dados e backup', icon: Database },
      { to: '/sobre', label: 'Sobre o projeto', icon: BookOpen },
    ] },
  ];
  return (
    <div className="app">
      <aside className="side">
        <div className="side-top">
          <NavLink to="/" className="brand"><span className="logo"><ShieldCheck /></span><div><b>SGQ Rotalume</b><small>Indústria · empresa fictícia</small></div></NavLink>
        </div>
        <nav className="nav" aria-label="Módulos">
          {groups.map((g) => (
            <div className="nav-group" key={g.label} role="group" aria-label={g.label}>
              <span className="nav-label">{g.label}</span>
              {g.items.map(({ to, label, icon: Icon, end, count, countTitle }) => (
                <NavLink key={to} to={to} end={end} data-tour={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon />{label}{count ? <span className="count" title={`${count} ${countTitle}`} aria-label={`${count} ${countTitle}`}>{count}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <ThemeToggle />
          <span className="note">Os dados ficam salvos neste navegador. Faça backup em <NavLink to="/dados">Dados e backup</NavLink>.</span>
        </div>
      </aside>
      <div className="main">
        <TopBar onSearch={() => setSearching(true)} onHelp={() => setTouring(true)} />
        <Outlet />
        <footer className="foot">Projeto de portfólio de Breno Silva · Rotalume é uma empresa fictícia e todos os dados são simulados.</footer>
      </div>
      {toast && <Toast key={toast.id} msg={toast.msg} />}
      {searching && <SearchPalette onClose={() => setSearching(false)} />}
      {touring && <Tour onClose={() => setTouring(false)} />}
    </div>
  );
}
