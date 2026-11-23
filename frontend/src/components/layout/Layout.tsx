import { Outlet, useRouterState } from '@tanstack/react-router';
import { Navigation } from './Navigation';
import { Header } from './Header';

const Layout = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isLogin = pathname === '/login';

  if (isLogin) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Navigation />
        <div className="flex-1">
          <Header />
          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
