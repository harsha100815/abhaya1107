'use client';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Navigation,
  Map,
  FileText,
  History as HistoryIcon,
  Settings as SettingsIcon,
  ArrowUpRight,
  MapPin,
  WifiOff,
  Check,
  ArrowRight,
} from 'lucide-react';
import { ApiError } from '@abhaya/client';
import { dashboardSchema, configViewSchema } from '@abhaya/validation';
import { api, readableTime } from '../lib/api';
import { Auth } from './Auth';
import { Sos } from './Sos';
import { Contacts } from './Contacts';
import { Journeys } from './Journeys';
import { Reports } from './Reports';
import { Settings } from './Settings';
import { History } from './History';
import { SafetyMap } from './SafetyMap';
import { useLocation } from './location';
import { Notice, Badge, Button } from './common';
const navigation = [
  { id: 'home', label: 'Overview', icon: LayoutDashboard },
  { id: 'contacts', label: 'Your circle', icon: Users },
  { id: 'journeys', label: 'Safe journeys', icon: Navigation },
  { id: 'map', label: 'Safety map', icon: Map },
  { id: 'reports', label: 'Private reports', icon: FileText },
  { id: 'history', label: 'Your timeline', icon: HistoryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];
export function Application() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 15000 },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Shell />
    </QueryClientProvider>
  );
}
function Shell() {
  const client = useQueryClient(),
    [tab, setTab] = useState('home'),
    [online, setOnline] = useState(true),
    [systemDark, setSystemDark] = useState(false);
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      try {
        return await api.call('GET', '/dashboard', dashboardSchema);
      } catch (error) {
        // Signed out is a stable session state, not a transient loading error.
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    refetchInterval: (query) => (query.state.data ? 10000 : false),
    refetchOnWindowFocus: (query) => query.state.data !== null,
    refetchOnReconnect: (query) => query.state.data !== null,
  });
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api.call('GET', '/config', configViewSchema),
    staleTime: 60000,
  });
  const data = query.data,
    location = useLocation(data ?? undefined);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    const media = matchMedia('(prefers-color-scheme: dark)'),
      theme = () => setSystemDark(media.matches);
    theme();
    media.addEventListener('change', theme);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
      media.removeEventListener('change', theme);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme =
      data?.user.theme === 'system'
        ? systemDark
          ? 'dark'
          : 'light'
        : (data?.user.theme ?? 'light');
  }, [data?.user.theme, systemDark]);
  if (data === null)
    return (
      <Auth
        onSuccess={() => {
          void client.resetQueries({ queryKey: ['dashboard'] });
          setTab('home');
        }}
      />
    );
  if (!data || !config.data)
    return (
      <main className="loading-shell">
        <ShieldCheck size={42} />
        <h2>{query.error || config.error ? 'Let’s reconnect.' : 'Opening your safety space…'}</h2>
        {query.error || config.error ? (
          <>
            <Notice error>{(query.error ?? config.error)?.message}</Notice>
            <Button
              className="primary"
              onClick={() => {
                void query.refetch();
                void config.refetch();
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <div className="skeleton" />
        )}
      </main>
    );
  const active = data.emergencies.find((e) => e.status === 'ACTIVE'),
    journey = data.journeys.find((j) => ['ACTIVE', 'OVERDUE'].includes(j.status));
  const recent = [
    ...data.emergencies.map((e) => ({
      id: e.id,
      title: e.testMode ? 'Test SOS' : 'SOS event',
      status: e.status,
      at: e.createdAt,
      tab: 'history',
    })),
    ...data.journeys.map((j) => ({
      id: j.id,
      title: `Journey to ${j.destination}`,
      status: j.status,
      at: j.createdAt,
      tab: 'journeys',
    })),
    ...data.incidents.map((i) => ({
      id: i.id,
      title: 'Private report saved',
      status: 'PRIVATE',
      at: i.createdAt,
      tab: 'reports',
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 3);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <ShieldCheck size={31} />
          <span>
            abhaya<span className="brand-number">1107</span>
          </span>
        </a>
        <p className="nav-caption">YOUR PERSONAL SAFETY SPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? 'nav-item current' : 'nav-item'}
              aria-current={tab === n.id ? 'page' : undefined}
              onClick={() => setTab(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {tab === n.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="leaf-symbol">✧</div>
          <strong>
            Here for the everyday.
            <br />
            Ready for the unexpected.
          </strong>
          <p>Small steps towards a little more peace of mind.</p>
        </div>
        <button className="user-chip" onClick={() => setTab('settings')}>
          <span className="avatar small-avatar">{data.user.name[0]?.toUpperCase()}</span>
          <span>
            <strong>{data.user.name}</strong>
            <small>Personal account</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Your space <span>/</span> <strong>{navigation.find((n) => n.id === tab)?.label}</strong>
          </div>
          <div className="row">
            <Badge>{config.data.testOnly ? 'TEST MODE' : 'LIVE MODE'}</Badge>
            <span className={`connection ${online ? '' : 'disconnected'}`}>
              <span className="status-dot" />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </header>
        <main className="main-content">
          {!online && (
            <Notice error>
              <WifiOff size={17} /> You’re offline. SOS transmission and live location cannot be
              confirmed.
            </Notice>
          )}
          {query.error && (
            <Notice error>
              {query.error.message}{' '}
              <button className="link" onClick={() => void query.refetch()}>
                Retry
              </button>
            </Notice>
          )}
          {location.sharingError && <Notice error>{location.sharingError}</Notice>}
          {tab === 'home' && (
            <>
              <div className="welcome">
                <div>
                  <p className="eyebrow">A LITTLE MORE PEACE OF MIND</p>
                  <h1>
                    Hello, {data.user.name.split(' ')[0]}
                    <span className="greeting-mark">✧</span>
                  </h1>
                  <p>Wherever today takes you, keep your circle close.</p>
                </div>
                <div className="date-chip">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <div className="status-strip">
                <span className="status-icon">
                  <ShieldCheck size={21} />
                </span>
                <div>
                  <strong>
                    {active
                      ? 'Your SOS is active'
                      : journey
                        ? 'Your journey is in progress'
                        : 'Your safety space is ready'}
                  </strong>
                  <span>
                    {active
                      ? 'Review contact delivery status below.'
                      : 'No active SOS. Readiness is not a guarantee of safety.'}
                  </span>
                </div>
                <Badge>{data.contacts.filter((c) => c.receivesAlerts).length} alert contacts</Badge>
              </div>
              <div className="dashboard-grid">
                <div>
                  <Sos active={active} config={config.data} point={location.point} />
                  <section className="card">
                    <div className="row between">
                      <h3>A little reassurance for the journey.</h3>
                      <Navigation size={22} />
                    </div>
                    <p>
                      {journey
                        ? `Heading to ${journey.destination}. Check in by ${new Date(journey.expectedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}.`
                        : 'Let someone know when you expect to arrive. We’ll flag a missed check-in.'}
                    </p>
                    <Button className="secondary" onClick={() => setTab('journeys')}>
                      {journey ? 'View your journey' : 'Plan a safe journey'}
                      <ArrowRight size={16} />
                    </Button>
                  </section>
                </div>
                <div>
                  <section className="card location-card">
                    <div className="row between">
                      <span className="feature-icon">
                        <MapPin size={22} />
                      </span>
                      <Badge>{location.point ? 'GPS obtained' : 'Not located'}</Badge>
                    </div>
                    <h3>{location.point ? 'Your location, in view.' : 'Know where you stand.'}</h3>
                    <p>
                      Refresh your position to use it in an SOS or private report. Coordinates are
                      sent only when you enable sharing or attach them.
                    </p>
                    {location.point && (
                      <p className="coordinates">
                        {location.point.latitude.toFixed(5)}, {location.point.longitude.toFixed(5)}
                        <small>
                          ±{Math.round(location.point.accuracy)} m ·{' '}
                          {new Date(location.point.capturedAt).toLocaleTimeString()}
                        </small>
                      </p>
                    )}
                    <Button
                      className="secondary full"
                      busy={location.busy}
                      onClick={location.refresh}
                    >
                      Refresh my location
                    </Button>
                    {location.error && <Notice error>{location.error}</Notice>}
                  </section>
                  <section className="card">
                    <div className="row between">
                      <h3>Your circle</h3>
                      <button className="link" onClick={() => setTab('contacts')}>
                        Manage
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                    {data.contacts.length ? (
                      data.contacts.slice(0, 3).map((c, i) => (
                        <div className="mini-contact" key={c.id}>
                          <span className={`avatar small-avatar tone-${i % 3}`}>{c.name[0]}</span>
                          <div>
                            <strong>{c.name}</strong>
                            <small>
                              {c.isPrimary
                                ? 'Primary contact'
                                : c.receivesAlerts
                                  ? 'Alerts enabled'
                                  : 'Alerts paused'}
                            </small>
                          </div>
                          <a
                            className="icon-btn"
                            aria-label={`Call ${c.name}`}
                            href={`tel:${c.phone}`}
                          >
                            <ArrowUpRight size={17} />
                          </a>
                        </div>
                      ))
                    ) : (
                      <>
                        <p>A friend. A sibling. Someone who picks up.</p>
                        <button className="link" onClick={() => setTab('contacts')}>
                          Add your first contact
                          <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                  </section>
                </div>
              </div>
              <section className="card">
                <div className="row between">
                  <h3>Recent moments</h3>
                  <button className="link" onClick={() => setTab('history')}>
                    View timeline
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                {recent.length ? (
                  recent.map((r) => (
                    <button className="activity-row" key={r.id} onClick={() => setTab(r.tab)}>
                      <span className="activity-icon">
                        <Check size={18} />
                      </span>
                      <span>
                        <strong>{r.title}</strong>
                        <small>{readableTime(r.at)}</small>
                      </span>
                      <Badge>{r.status}</Badge>
                    </button>
                  ))
                ) : (
                  <p className="small">
                    Nothing to review yet. Your journeys, SOS events and reports will appear here.
                  </p>
                )}
              </section>
            </>
          )}
          {tab === 'contacts' && <Contacts contacts={data.contacts} />}{' '}
          {tab === 'journeys' && (
            <Journeys journeys={data.journeys} contacts={data.contacts} config={config.data} />
          )}{' '}
          {tab === 'reports' && <Reports incidents={data.incidents} point={location.point} />}{' '}
          {tab === 'settings' && (
            <Settings
              user={data.user}
              onLogout={() => {
                client.clear();
                void query.refetch();
              }}
            />
          )}{' '}
          {tab === 'history' && <History />}{' '}
          {tab === 'map' && (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">YOUR SURROUNDINGS</p>
                  <h2>A map with privacy in mind.</h2>
                  <p>Only your position and your private reports appear here.</p>
                </div>
                <Button className="secondary" busy={location.busy} onClick={location.refresh}>
                  Refresh location
                </Button>
              </div>
              {location.error && <Notice error>{location.error}</Notice>}
              <SafetyMap point={location.point} incidents={data.incidents} />
            </>
          )}
          <footer className="main-footer">
            <ShieldCheck size={14} />
            <span>YOUR SAFETY. YOUR CIRCLE. YOUR CONTROL.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
