import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Smartphone, Send, LogOut } from 'lucide-react';
import { useLogout } from '@/hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Devices', href: '/devices', icon: Smartphone },
  { name: 'Commands & Logs', href: '/commands', icon: Send },
];

const Navigation = () => {
  const logout = useLogout();

  return (
    <div className="w-64 bg-card border-r border-border min-h-screen p-4">
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold">Smartlock Console</h2>
          <p className="text-sm text-muted-foreground">Register, approve, command, audit</p>
        </div>

        <nav className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'text-muted-foreground'
                )}
                activeProps={{
                  className: 'bg-accent text-accent-foreground',
                }}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export { Navigation };
