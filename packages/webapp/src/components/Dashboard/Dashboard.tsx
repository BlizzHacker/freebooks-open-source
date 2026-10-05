import React from 'react';
import { NavLink } from 'react-router-dom';
import { withDashboard } from '@/containers/Dashboard/withDashboard';
import { withDashboardActions } from '@/containers/Dashboard/withDashboardActions';
import { Switch, Route } from 'react-router-dom';
import '@/style/pages/Dashboard/Dashboard.scss';
import '@/style/freebooks-theme.scss';
import '@/style/freebooks-app-shell.scss';
import '@/style/freebooks-design-v2.scss';
import '@/style/pages/Connections/ConnectionsPage.scss';
import DashboardProvider from './DashboardProvider';
import { DashboardSockets } from './DashboardSockets';
import GlobalHotkeys from './GlobalHotkeys';
import DashboardContent from '@/components/Dashboard/DashboardContent';
import DashboardSplitPane from '@/components/Dashboard/DashboardSplitePane';
import DialogsContainer from '@/components/DialogsContainer';
import DrawersContainer from '@/components/DrawersContainer';
import PreferencesPage from '@/components/Preferences/PreferencesPage';
import { AlertsContainer } from '@/containers/AlertsContainer';
import { Sidebar } from '@/containers/Dashboard/Sidebar/Sidebar';
import { DashboardUniversalSearch } from '@/containers/UniversalSearch/DashboardUniversalSearch';

const MobileSidebarScrim = withDashboard()(
  withDashboardActions(({ sidebarExpended, toggleSidebarExpand }: any) => (
    <button
      aria-label="Close navigation"
      className={`freebooks-mobile-scrim${sidebarExpended ? ' is-open' : ''}`}
      onClick={() => toggleSidebarExpand(false)}
      type="button"
    />
  )),
);

function FreeBooksMobileDock() {
  return (
    <nav
      aria-label="FreeBooks mobile navigation"
      className="freebooks-mobile-dock"
    >
      <NavLink exact to="/" activeClassName="is-active">
        <span aria-hidden="true">⌂</span>Home
      </NavLink>
      <NavLink to="/cashflow-accounts" activeClassName="is-active">
        <span aria-hidden="true">▦</span>Banking
      </NavLink>
      <NavLink
        to="/source-documents?capture=1"
        activeClassName="is-active"
        isActive={(_, location) =>
          location.pathname === '/source-documents' &&
          location.search.includes('capture=1')
        }
      >
        <span aria-hidden="true">＋</span>Capture
      </NavLink>
      <NavLink
        to="/source-documents"
        activeClassName="is-active"
        isActive={(_, location) =>
          location.pathname === '/source-documents' &&
          !location.search.includes('capture=1')
        }
      >
        <span aria-hidden="true">▤</span>Documents
      </NavLink>
      <NavLink to="/connections" activeClassName="is-active">
        <span aria-hidden="true">↔</span>Connect
      </NavLink>
    </nav>
  );
}

/**
 * Dashboard preferences.
 */
function DashboardPreferences() {
  return (
    <div className="dashboard-layout">
      <div className="dashboard-layout__main">
        <DashboardSplitPane>
          <Sidebar />
          <PreferencesPage />
        </DashboardSplitPane>
      </div>
      <MobileSidebarScrim />
      <FreeBooksMobileDock />
    </div>
  );
}

/**
 * Dashboard other routes.
 */
function DashboardAnyPage() {
  return (
    <div className="dashboard-layout">
      <div className="dashboard-layout__main">
        <DashboardSplitPane>
          <Sidebar />
          <DashboardContent />
        </DashboardSplitPane>
      </div>
      <MobileSidebarScrim />
      <FreeBooksMobileDock />
    </div>
  );
}

/**
 * Dashboard page.
 */
export default function Dashboard() {
  return (
    <DashboardProvider>
      <Switch>
        <Route path="/preferences" component={DashboardPreferences} />
        <Route path="/" component={DashboardAnyPage} />
      </Switch>

      <DashboardSockets />
      <DashboardUniversalSearch />
      <GlobalHotkeys />
      <DialogsContainer />
      <DrawersContainer />
      <AlertsContainer />
    </DashboardProvider>
  );
}
