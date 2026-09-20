import {
  createRouter,
  memoryHistory,
  useLocation,
  useNavigate,
  type RouteSectionProps,
} from '@solidjs/router';
import ApplicationPage from './pages/ApplicationPage';
import DebugPage from './pages/DebugPage';
import { t } from './i18n/context';
import './styles/app.css';

const Router = createRouter({
  routes: [
    { path: '/', component: ApplicationPage },
    { path: '/debug', component: DebugPage },
    { path: '*404', component: ApplicationPage },
  ],
  // Browser history for clean URLs on the client; memory history is used
  // during prerender where there is no `window`.
  history: typeof window !== 'undefined' ? undefined : memoryHistory('/'),
});

function Layout(props: RouteSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <main class="app">
      <nav class="nav">
        <button class={isActive('/') ? 'active' : ''} onClick={() => navigate('/')}>
          {t('nav.application')}
        </button>
        <button class={isActive('/debug') ? 'active' : ''} onClick={() => navigate('/debug')}>
          {t('nav.debug')}
        </button>
      </nav>
      {props.children}
    </main>
  );
}

export default function App() {
  return (
    <Router url="/">
      {(props) => <Layout {...props} />}
    </Router>
  );
}
