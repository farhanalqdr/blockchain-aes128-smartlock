import { useMemo, useState } from 'react';
import { useApproveDevice, useDevices, useRegisterDevice, useRejectDevice } from '@/hooks/useDevices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, CheckCircle, XCircle, Eye, Search, Plus } from 'lucide-react';
import { Link } from '@tanstack/react-router';

const emptyForm = {
  name: '',
  lockId: '',
  walletAddress: '',
};

const DeviceList = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: devicesResponse, isLoading } = useDevices({ page, limit: 10 });
  const approveDevice = useApproveDevice();
  const rejectDevice = useRejectDevice();
  const registerDevice = useRegisterDevice();

  const devices = useMemo(() => {
    const list = devicesResponse?.data ?? [];
    return list.filter((device) => {
      const matchesStatus =
        status === 'all' ||
        device.status === status ||
        (status === 'approved' && device.isApproved) ||
        (status === 'pending' && !device.isApproved);

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        device.name.toLowerCase().includes(q) ||
        device.lockId.toLowerCase().includes(q) ||
        device.walletAddress.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [devicesResponse, searchQuery, status]);

  const handleApprove = async (walletAddress: string) => {
    await approveDevice.mutateAsync(walletAddress);
  };

  const handleReject = async (walletAddress: string) => {
    await rejectDevice.mutateAsync(walletAddress);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await registerDevice.mutateAsync({
        name: form.name,
        lockId: form.lockId,
        walletAddress: form.walletAddress,
      });

      setForm(emptyForm);
      setOpen(false);
      window.alert('Lock registered successfully. Approve it from the table once the transaction is confirmed.');
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to register device';

      window.alert(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Devices</h1>
          <p className="text-muted-foreground">Register locks, approve them on-chain, and review operational status.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Register Device
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Register lock device</DialogTitle>
              <DialogDescription>
                Register a lock using only basic identity fields for the current AES-based smartlock flow.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Lock ID</Label>
                <Input
                  value={form.lockId}
                  onChange={(e) => setForm({ ...form, lockId: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Wallet Address</Label>
                <Input
                  value={form.walletAddress}
                  onChange={(e) => setForm({ ...form, walletAddress: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={registerDevice.isPending}>
                  {registerDevice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, lock ID, wallet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Device List</CardTitle>
          <CardDescription>{devicesResponse?.pagination.total || 0} registered devices</CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Lock ID</TableHead>
                <TableHead>Wallet Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Command</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell>{device.lockId}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {device.walletAddress.slice(0, 8)}...{device.walletAddress.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={device.status === 'online' ? 'default' : device.isApproved ? 'secondary' : 'outline'}>
                      {device.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{device.lastCommandStatus || '-'}</TableCell>
                  <TableCell>{new Date(device.registeredAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link to="/devices/$deviceId" params={{ deviceId: device.id }}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>

                      {!device.isApproved && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(device.walletAddress)}
                          disabled={approveDevice.isPending}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}

                      {!device.isApproved && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(device.walletAddress)}
                          disabled={rejectDevice.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              Page {devicesResponse?.pagination.page || 1} of {devicesResponse?.pagination.pages || 1}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={page >= (devicesResponse?.pagination.pages || 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeviceList;