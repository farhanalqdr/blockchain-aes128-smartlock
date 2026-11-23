import { useMemo } from 'react';
import { useAllDevices } from '@/hooks/useDevices';
import { useAllData } from '@/hooks/useData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, Clock, ShieldCheck, Send, Activity, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const { data: locks, isLoading: locksLoading } = useAllDevices();
  const { data: commandsResponse, isLoading: commandsLoading } = useAllData({ page: 1, limit: 20 });

  const stats = useMemo(() => {
    const commands = commandsResponse?.data ?? [];
    return {
      totalLocks: locks?.length ?? 0,
      approvedLocks: locks?.filter((lock) => lock.isApproved).length ?? 0,
      onlineLocks: locks?.filter((lock) => lock.status === 'online').length ?? 0,
      totalCommands: commands.length,
      executedCommands: commands.filter((command) => command.status === 'executed').length,
      failedCommands: commands.filter((command) => command.status === 'failed').length,
      pendingCommands: commands.filter((command) => command.status === 'pending').length,
    };
  }, [locks, commandsResponse]);

  const recentLocks = [...(locks ?? [])]
    .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
    .slice(0, 5);

  const recentCommands = [...(commandsResponse?.data ?? [])]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  if (locksLoading || commandsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Smartlock overview across registration, approval, command delivery, and execution logs.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locks</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLocks}</div>
            <p className="text-xs text-muted-foreground">Registered lock devices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved / Online</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approvedLocks} / {stats.onlineLocks}</div>
            <p className="text-xs text-muted-foreground">Approved locks / currently online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Commands</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingCommands}</div>
            <p className="text-xs text-muted-foreground">Commands waiting to be executed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executed / Failed</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.executedCommands} / {stats.failedCommands}</div>
            <p className="text-xs text-muted-foreground">Latest command outcomes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest Locks</CardTitle>
            <CardDescription>Recently registered lock devices</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLocks.map((lock) => (
                  <TableRow key={lock.id}>
                    <TableCell className="font-medium">{lock.name}</TableCell>
                    <TableCell>
                      <Badge variant={lock.status === 'online' ? 'default' : lock.isApproved ? 'secondary' : 'outline'}>
                        {lock.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(lock.registeredAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Commands</CardTitle>
            <CardDescription>Recent command submissions and outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Command</TableHead>
                  <TableHead>Lock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCommands.map((command) => (
                  <TableRow key={command.id}>
                    <TableCell className="font-medium">{command.commandType}</TableCell>
                    <TableCell className="font-mono text-xs">{command.lockAddress.slice(0, 10)}...{command.lockAddress.slice(-6)}</TableCell>
                    <TableCell>
                      <Badge variant={command.status === 'executed' ? 'default' : command.status === 'failed' ? 'destructive' : 'secondary'}>
                        {command.status === 'failed' ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Activity className="h-3 w-3 mr-1" />}
                        {command.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
