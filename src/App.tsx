import {
  createRouter,
  memoryHistory,
  useLocation,
  useNavigate,
  type RouteSectionProps,
} from '@solidjs/router';
import ApplicationPage from './pages/ApplicationPage';
import FullChipPage from './pages/FullChipPage';
import { t } from './i18n/context';
import './styles/app.css';

const Router = createRouter({
  routes: [
    { path: '/', component: ApplicationPage },
    { path: '/fullchip', component: FullChipPage },
    { path: '*404', component: ApplicationPage },
  ],
  // Browser history for clean URLs on the client; memory history is used
  // during prerender where there is no `window`.
  history: typeof window !== 'undefined' ? undefined : memoryHistory('/'),
});

function Layout(props: RouteSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const onFullChip = () => location.pathname.startsWith('/fullchip');

  return (
    <main class="app">
      <nav class="nav">
        <button class={onFullChip() ? '' : 'active'} onClick={() => navigate('/')}>
          {t('nav.application')}
        </button>
        <button class={onFullChip() ? 'active' : ''} onClick={() => navigate('/fullchip')}>
          {t('nav.fullchip')}
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
