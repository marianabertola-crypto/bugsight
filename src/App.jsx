import { useState } from 'react';
import Sidebar from './components/Sidebar';
import BugTracker from './components/BugTracker';
import ReportBug from './components/ReportBug';
import History from './components/History';
import Kanban from './components/Kanban';
import './App.css';

const SECTIONS = {
  tracker: { title: 'Bug Tracker', subtitle: 'Monitoreá bugs por módulo, filtrá por estado y consultá ETAs a los PMs.' },
  report: { title: 'Reportar bug', subtitle: 'Creá una nueva card con contexto, evaluación de calidad y búsqueda de duplicados con IA.' },
  history: { title: 'Historial', subtitle: 'Bugs resueltos en los últimos 7 días.' },
  kanban: { title: 'Kanban', subtitle: 'Moveé bugs entre columnas para actualizar su estado.' },
};

export default function App() {
  const [section, setSection] = useState('tracker');
  const meta = SECTIONS[section];

  return (
    <div className="app-shell">
      <Sidebar active={section} onChange={setSection} />
      <main className="app-main">
        <header className="app-header">
          <h1>{meta.title}</h1>
          <p className="app-subtitle">{meta.subtitle}</p>
        </header>
        <section className="app-content">
          {section === 'tracker' && <BugTracker />}
          {section === 'report' && <ReportBug onSaved={() => setSection('tracker')} />}
          {section === 'history' && <History />}
          {section === 'kanban' && <Kanban />}
        </section>
      </main>
    </div>
  );
}
