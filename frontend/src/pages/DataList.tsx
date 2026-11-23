import { useMemo, useState } from 'react';
import { useAllData } from '@/hooks/useData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Calendar, Eye } from 'lucide-react';
import { Link } from '@tanstack/react-router';

const DataList = () => {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [commandType, setCommandType] = useState('all');

  const { data: dataResponse, isLoading } = useAllData({
    page,
    limit: 20,
    status: status !== 'all' ? status : undefined,
    commandType: commandType !== 'all' ? commandType : undefined,
  });

  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (dataResponse?.data ?? []).filter((data) => {
      if (!q) return true;
      return data.lockAddress.toLowerCase().includes(q)
        || data.submittedByAddress.toLowerCase().includes(q)
        || (data.blockchainTxHash?.toLowerCase().includes(q) ?? false)
        || data.commandType.toLowerCase().includes(q);
    });
  }, [dataResponse, searchQuery]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Commands & Logs</h1>
        <p className="text-muted-foreground">Review raw payloads, AES outputs, execution results, and on-chain confirmations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by lock, sender, tx hash..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="executed">Executed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={commandType} onValueChange={setCommandType}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="LOCK">LOCK</SelectItem>
                <SelectItem value="UNLOCK">UNLOCK</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Command Log</CardTitle>
          <CardDescription>{dataResponse?.pagination.total || 0} commands recorded</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitted</TableHead>
                <TableHead>Lock</TableHead>
                <TableHead>Command</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>On-chain</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((data) => (
                <TableRow key={data.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(data.submittedAt).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{data.lockAddress.slice(0, 10)}...{data.lockAddress.slice(-6)}</TableCell>
                  <TableCell>{data.commandType}</TableCell>
                  <TableCell><Badge variant={data.status === 'executed' ? 'default' : data.status === 'failed' ? 'destructive' : 'secondary'}>{data.status}</Badge></TableCell>
                  <TableCell>{data.executionSyncedOnChain ? 'Synced' : data.blockchainTxHash ? 'Submitted' : 'No'}</TableCell>
                  <TableCell>
                    <Link to="/commands/$dataId" params={{ dataId: data.id }}>
                      <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-2" />View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">Page {dataResponse?.pagination.page || 1} of {dataResponse?.pagination.pages || 1}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= (dataResponse?.pagination.pages || 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataList;
