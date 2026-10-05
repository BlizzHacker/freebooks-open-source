import {
  Navbar,
  NavbarGroup,
  NavbarDivider,
  Button,
  Classes,
  Tooltip,
  Position,
  MenuItem,
  Menu,
  MenuDivider,
} from '@blueprintjs/core';
import { Popover2 } from '@blueprintjs/popover2';
import * as FF from 'fp-ts/function';
import { NavLink, useHistory } from 'react-router-dom';
import {
  DashboardHamburgerButton,
  DashboardQuickSearchButton,
} from './_components';
import type { WithDashboardProps } from '@/containers/Dashboard/withDashboard';
import type { WithDashboardActionsProps } from '@/containers/Dashboard/withDashboardActions';
import type { WithDialogActionsProps } from '@/containers/Dialog/withDialogActions';
import type { WithUniversalSearchActionsProps } from '@/containers/UniversalSearch/withUniversalSearchActions';
import { FormattedMessage as T, Icon, Hint, If } from '@/components';
import DashboardBackLink from '@/components/Dashboard/DashboardBackLink';
import DashboardBreadcrumbs from '@/components/Dashboard/DashboardBreadcrumbs';
import DashboardTopbarUser from '@/components/Dashboard/TopbarUser';
import { DialogsName } from '@/constants/dialogs';
import { withDashboard } from '@/containers/Dashboard/withDashboard';
import { withDashboardActions } from '@/containers/Dashboard/withDashboardActions';
import { withDialogActions } from '@/containers/Dialog/withDialogActions';
import { QuickNewDropdown } from '@/containers/QuickNewDropdown/QuickNewDropdown';
import { withUniversalSearchActions } from '@/containers/UniversalSearch/withUniversalSearchActions';

type DashboardTopbarProps = Pick<
  WithDashboardProps,
  'pageTitle' | 'pageHint' | 'editViewId' | 'sidebarExpended'
> &
  Pick<WithDashboardActionsProps, 'toggleSidebarExpand'> &
  Pick<WithUniversalSearchActionsProps, 'openGlobalSearch'> &
  Pick<WithDialogActionsProps, 'openDialog'>;

/**
 * Dashboard topbar.
 */
function DashboardTopbar({
  // #withDashboard
  pageTitle,
  editViewId,
  pageHint,

  // #withDashboardActions
  toggleSidebarExpand,

  // #withDashboard
  sidebarExpended,

  // #withGlobalSearch
  openGlobalSearch,

  // #withDialogActions
  openDialog,
}: DashboardTopbarProps) {
  const history = useHistory();

  const handlerClickEditView = () => {
    history.push(`/custom_views/${editViewId}/edit`);
  };

  const handleSidebarToggleBtn = () => {
    toggleSidebarExpand();
  };

  return (
    <div className="dashboard__topbar" data-testId={'dashboard-topbar'}>
      <div className="dashboard__topbar-left">
        <div className="dashboard__topbar-sidebar-toggle">
          <Tooltip
            content={
              !sidebarExpended ? (
                <T id={'open_sidebar'} />
              ) : (
                <T id={'close_sidebar'} />
              )
            }
            position={Position.RIGHT}
          >
            <DashboardHamburgerButton onClick={handleSidebarToggleBtn} />
          </Tooltip>
        </div>

        <div className="dashboard__title">
          <h1>{pageTitle}</h1>

          <If condition={!!pageHint}>
            <div className="dashboard__hint">
              <Hint content={pageHint} />
            </div>
          </If>

          <If condition={!!editViewId}>
            <Button
              className={Classes.MINIMAL + ' button--view-edit'}
              icon={<Icon icon="pen" iconSize={13} />}
              onClick={handlerClickEditView}
            />
          </If>
        </div>

        <div className="dashboard__breadcrumbs">
          <DashboardBreadcrumbs />
        </div>
        <DashboardBackLink />
      </div>

      <div className="dashboard__topbar-right">
        <nav aria-label="Workspace" className="freebooks-workspace-nav">
          <NavLink exact to="/" activeClassName="is-active">
            Overview
          </NavLink>
          <NavLink to="/connections" activeClassName="is-active">
            Connections
          </NavLink>
          <NavLink to="/cashflow-accounts" activeClassName="is-active">
            Banking
          </NavLink>
          <NavLink to="/source-documents" activeClassName="is-active">
            Documents
          </NavLink>
        </nav>
        <Navbar className="dashboard__topbar-navbar">
          <NavbarGroup>
            <DashboardQuickSearchButton onClick={() => openGlobalSearch()} />
            <QuickNewDropdown />
            <Button
              className="freebooks-capture-cta"
              icon="camera"
              onClick={() => history.push('/source-documents?capture=1')}
            >
              Capture receipt
            </Button>
            <Popover2
              content={
                <Menu>
                  <MenuItem
                    text="Source documents"
                    onClick={() => history.push('/source-documents')}
                  />
                  <MenuItem
                    text="Connections"
                    onClick={() => history.push('/connections')}
                  />
                  <MenuItem
                    text="Install app / switch server"
                    onClick={() => window.location.assign('/app-launcher.html')}
                  />
                  <MenuDivider />
                  <MenuItem
                    text="Keyboard shortcuts"
                    onClick={() => openDialog(DialogsName.KeyboardShortcutForm)}
                  />
                </Menu>
              }
            >
              <Button
                className={Classes.MINIMAL}
                icon={<Icon icon={'help-24'} iconSize={20} />}
                text={<T id={'help'} />}
              />
            </Popover2>
            <NavbarDivider />
          </NavbarGroup>
        </Navbar>

        <div className="dashboard__topbar-user">
          <DashboardTopbarUser />
        </div>
      </div>
    </div>
  );
}

export default FF.pipe(
  DashboardTopbar,
  withDialogActions,
  withDashboardActions,
  withDashboard(({ pageTitle, pageHint, editViewId, sidebarExpended }) => ({
    pageTitle,
    editViewId,
    sidebarExpended,
    pageHint,
  })),
  withUniversalSearchActions,
);
