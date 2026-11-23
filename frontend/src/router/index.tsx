import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';

import Layout from '@/components/layout/Layout';
import Dashboard from '@/pages/Dashboard';
import DeviceList from '@/pages/DeviceList';
import DeviceDetail from '@/pages/DeviceDetail';
import DataList from '@/pages/DataList';
import DataDetail from '@/pages/DataDetail';
import Login from '@/pages/Login';

const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Layout />
    </QueryClientProvider>
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});

const deviceListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/devices',
  component: DeviceList,
});

const deviceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/devices/$deviceId',
  component: DeviceDetail,
});

const commandListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/commands',
  component: DataList,
});

const commandDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/commands/$dataId',
  component: DataDetail,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    dashboardRoute,
    deviceListRoute,
    deviceDetailRoute,
    commandListRoute,
    commandDetailRoute,
    loginRoute,
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
