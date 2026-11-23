import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useDevice } from '@/hooks/useDevices';
import { useCreateCommand, useDataHistory } from '@/hooks/useData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Calendar, ShieldCheck, Activity, Send } from 'lucide-react';

type LatencyClickNote = {
  txLabel: string;
  runId: string;
  userClickedAt: string;
  backendResponseAt?: string;
  commandType: 'LOCK' | 'UNLOCK';
  lockAddress: string;
  submittedByAddress: string;
  commandId?: string;
  blockchainCommandId?: number | string;
  txHash?: string;
  blockNumber?: number | string;
  blockTimestamp?: string;
  status: 'clicked' | 'success' | 'failed';
  errorMessage?: string;
};

const LATENCY_RUN_ID_KEY = 'latency_run_id';
const LATENCY_TX_COUNTER_KEY = 'latency_tx_counter';
const LATENCY_CLICK_NOTES_KEY = 'latency_click_notes';

const getNowIso = () => new Date().toISOString();

const createNewRunId = () => {
  return `latency-run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
};

const getOrCreateLatencyRunId = () => {
  const existing = localStorage.getItem(LATENCY_RUN_ID_KEY);

  if (existing) return existing;

  const runId = createNewRunId();

  localStorage.setItem(LATENCY_RUN_ID_KEY, runId);
  localStorage.setItem(LATENCY_TX_COUNTER_KEY, '0');

  return runId;
};

const getNextLatencyLabel = () => {
  const runId = getOrCreateLatencyRunId();
  const currentCounter = Number(localStorage.getItem(LATENCY_TX_COUNTER_KEY) || '0');
  const nextCounter = currentCounter + 1;

  localStorage.setItem(LATENCY_TX_COUNTER_KEY, String(nextCounter));

  return {
    runId,
    txLabel: `tx${nextCounter}`,
  };
};

const loadLatencyNotes = (): LatencyClickNote[] => {
  try {
    const raw = localStorage.getItem(LATENCY_CLICK_NOTES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLatencyNotes = (notes: LatencyClickNote[]) => {
  localStorage.setItem(LATENCY_CLICK_NOTES_KEY, JSON.stringify(notes));
};

const upsertLatencyNote = (note: LatencyClickNote) => {
  const notes = loadLatencyNotes();
  const index = notes.findIndex(
    (item) => item.runId === note.runId && item.txLabel === note.txLabel
  );

  if (index >= 0) {
    notes[index] = {
      ...notes[index],
      ...note,
    };
  } else {
    notes.push(note);
  }

  saveLatencyNotes(notes);
  return notes;
};

const escapeCsv = (value: unknown) => {
  if (value === null || typeof value === 'undefined') return '';

  const stringValue = typeof value === 'object'
    ? JSON.stringify(value)
    : String(value);

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const downloadCsv = (notes: LatencyClickNote[]) => {
  const header = [
    'Tx ke-',
    'Run ID',
    'Command Type',
    'Lock Address',
    'Submitted By Address',
    'User Clicked At',
    'Backend Response At',
    'Command ID',
    'Blockchain Command ID',
    'Tx Hash',
    'Block Number',
    'Block Timestamp',
    'Status',
    'Error Message',
  ];

  const rows = notes.map((note) => [
    note.txLabel,
    note.runId,
    note.commandType,
    note.lockAddress,
    note.submittedByAddress,
    note.userClickedAt,
    note.backendResponseAt || '',
    note.commandId || '',
    note.blockchainCommandId || '',
    note.txHash || '',
    note.blockNumber || '',
    note.blockTimestamp || '',
    note.status,
    note.errorMessage || '',
  ]);

  const csv = [
    header.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const fileName = `latency-click-notes-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
};

const DeviceDetail = () => {
  const { deviceId } = useParams({ from: '/devices/$deviceId' });
  const { data: deviceResponse, isLoading } = useDevice(deviceId);
  const device = deviceResponse?.data;

  const { data: historyResponse, isLoading: historyLoading } = useDataHistory(device?.walletAddress || '', { page: 1, limit: 20 });
  const createCommand = useCreateCommand();

  const [commandType, setCommandType] = useState<'LOCK' | 'UNLOCK'>('UNLOCK');
  const [submittedByAddress, setSubmittedByAddress] = useState(localStorage.getItem('submitted_by_address') || '');
  const [expiresInSeconds, setExpiresInSeconds] = useState('300');
  const [latencyNotes, setLatencyNotes] = useState<LatencyClickNote[]>(loadLatencyNotes());

  const resetLatencyRun = () => {
    const runId = createNewRunId();

    localStorage.setItem(LATENCY_RUN_ID_KEY, runId);
    localStorage.setItem(LATENCY_TX_COUNTER_KEY, '0');
    saveLatencyNotes([]);
    setLatencyNotes([]);

    window.alert(`Latency run reset.\nNew Run ID:\n${runId}\nNext command will start from tx1.`);
  };

  const clearLatencyNotes = () => {
    saveLatencyNotes([]);
    setLatencyNotes([]);
    window.alert('Latency click notes cleared.');
  };

  const handleExportCsv = () => {
    const notes = loadLatencyNotes();

    if (notes.length === 0) {
      window.alert('No latency notes to export.');
      return;
    }

    downloadCsv(notes);
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;

    localStorage.setItem('submitted_by_address', submittedByAddress);

    const { runId, txLabel } = getNextLatencyLabel();
    const userClickedAt = getNowIso();

    const clickedNote: LatencyClickNote = {
      txLabel,
      runId,
      userClickedAt,
      commandType,
      lockAddress: device.walletAddress,
      submittedByAddress,
      status: 'clicked',
    };

    const updatedClickedNotes = upsertLatencyNote(clickedNote);
    setLatencyNotes(updatedClickedNotes);

    console.log('======================================');
    console.log('[LATENCY_CLICK]');
    console.log('Tx Label           :', txLabel);
    console.log('Run ID             :', runId);
    console.log('User Clicked At    :', userClickedAt);
    console.log('Command Type       :', commandType);
    console.log('Lock Address       :', device.walletAddress);
    console.log('Submitted By       :', submittedByAddress);
    console.log('======================================');

    try {
      const response = await createCommand.mutateAsync({
        lockAddress: device.walletAddress,
        commandType,
        submittedByAddress,
        expiresInSeconds: Number(expiresInSeconds),
        metadata: {
          source: 'frontend-web-console',
        },
      });

      const backendResponseAt = getNowIso();

      const commandId =
        response?.command?.id ||
        response?.command?._id ||
        response?.data?.id ||
        response?.data?._id ||
        '';

      const blockchainCommandId =
        response?.command?.blockchainCommandId ||
        response?.blockchain?.blockchainCommandId ||
        '';

      const txHash =
        response?.blockchain?.transactionHash ||
        response?.command?.blockchainTxHash ||
        '';

      const blockNumber =
        response?.blockchain?.blockNumber ||
        response?.command?.blockNumber ||
        '';

      const blockTimestamp =
        response?.blockchain?.blockTimestamp ||
        response?.command?.blockTimestamp ||
        '';

      const successNote: LatencyClickNote = {
        ...clickedNote,
        backendResponseAt,
        commandId,
        blockchainCommandId,
        txHash,
        blockNumber,
        blockTimestamp,
        status: 'success',
      };

      const updatedSuccessNotes = upsertLatencyNote(successNote);
      setLatencyNotes(updatedSuccessNotes);

      console.log('======================================');
      console.log('[LATENCY_RESPONSE]');
      console.log('Tx Label            :', txLabel);
      console.log('Run ID              :', runId);
      console.log('User Clicked At     :', userClickedAt);
      console.log('Backend Response At :', backendResponseAt);
      console.log('Command ID          :', commandId);
      console.log('Blockchain Cmd ID   :', blockchainCommandId);
      console.log('Tx Hash             :', txHash);
      console.log('Block Number        :', blockNumber);
      console.log('Block Timestamp     :', blockTimestamp);
      console.log('======================================');

      window.alert(
        `${commandType} command submitted successfully.\n\n` +
        `Latency Label: ${txLabel}\n` +
        `Command ID: ${commandId || '-'}\n` +
        `Tx Hash: ${txHash || '-'}`
      );
    } catch (error: any) {
      const backendResponseAt = getNowIso();
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Unknown error';

      const failedNote: LatencyClickNote = {
        ...clickedNote,
        backendResponseAt,
        status: 'failed',
        errorMessage,
      };

      const updatedFailedNotes = upsertLatencyNote(failedNote);
      setLatencyNotes(updatedFailedNotes);

      console.log('======================================');
      console.log('[LATENCY_RESPONSE_FAILED]');
      console.log('Tx Label            :', txLabel);
      console.log('Run ID              :', runId);
      console.log('User Clicked At     :', userClickedAt);
      console.log('Backend Response At :', backendResponseAt);
      console.log('Error               :', errorMessage);
      console.log('======================================');

      window.alert(`${commandType} command failed.\n\nLatency Label: ${txLabel}\nError: ${errorMessage}`);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!device) {
    return <div>Device not found</div>;
  }

  const currentLatencyRunId = localStorage.getItem(LATENCY_RUN_ID_KEY) || '-';
  const currentLatencyCounter = localStorage.getItem(LATENCY_TX_COUNTER_KEY) || '0';
  const latestLatencyNotes = latencyNotes.slice(-10).reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/devices">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back to Devices</Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{device.name}</h1>
          <p className="text-muted-foreground">Single-lock control panel, approval state, and command audit trail.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lock Information</CardTitle>
          <CardDescription>Operational identity and last-known state for this lock.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Lock ID</Label>
            <p className="font-medium">{device.lockId}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Wallet Address</Label>
            <p className="font-mono text-sm break-all">{device.walletAddress}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Status</Label>
            <div className="mt-1"><Badge variant={device.status === 'online' ? 'default' : device.isApproved ? 'secondary' : 'outline'}>{device.status}</Badge></div>
          </div>
          <div>
            <Label className="text-muted-foreground">Approved</Label>
            <div className="mt-1 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" />{device.isApproved ? 'Yes' : 'No'}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Registered At</Label>
            <div className="mt-1 flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{new Date(device.registeredAt).toLocaleString()}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Last Command Status</Label>
            <div className="mt-1 flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" />{device.lastCommandStatus || '-'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latency Click Notes</CardTitle>
          <CardDescription>
            This only records the web dApp click timestamp and backend response data. Match Command ID with Raspberry log to calculate relay latency.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Current Run ID</Label>
              <p className="font-mono text-sm break-all">{currentLatencyRunId}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Current Tx Counter</Label>
              <p className="font-mono text-sm">{currentLatencyCounter}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={resetLatencyRun}>
              Reset Run to tx1
            </Button>
            <Button type="button" variant="outline" onClick={handleExportCsv}>
              Export Click Notes CSV
            </Button>
            <Button type="button" variant="outline" onClick={clearLatencyNotes}>
              Clear Notes
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tx</TableHead>
                  <TableHead>User Clicked At</TableHead>
                  <TableHead>Command ID</TableHead>
                  <TableHead>Tx Hash</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestLatencyNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No latency click notes yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  latestLatencyNotes.map((note) => (
                    <TableRow key={`${note.runId}-${note.txLabel}`}>
                      <TableCell className="font-medium">{note.txLabel}</TableCell>
                      <TableCell className="font-mono text-xs">{note.userClickedAt}</TableCell>
                      <TableCell className="font-mono text-xs">{note.commandId || '-'}</TableCell>
                      <TableCell className="font-mono text-xs break-all">{note.txHash || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={note.status === 'success' ? 'default' : note.status === 'failed' ? 'destructive' : 'secondary'}>
                          {note.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send Command</CardTitle>
          <CardDescription>Frontend sends the command request. Backend performs AES-128 encryption and blockchain relay.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSendCommand}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Command Type</Label>
                <Select value={commandType} onValueChange={(value: 'LOCK' | 'UNLOCK') => setCommandType(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCK">LOCK</SelectItem>
                    <SelectItem value="UNLOCK">UNLOCK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Submitted By Address</Label>
                <Input value={submittedByAddress} onChange={(e) => setSubmittedByAddress(e.target.value)} placeholder="0x..." required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expires In Seconds</Label>
                <Input type="number" min="30" value={expiresInSeconds} onChange={(e) => setExpiresInSeconds(e.target.value)} required />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createCommand.isPending || !device.isApproved}>
                  {createCommand.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Submit Command
                </Button>
              </div>
            </div>
            {!device.isApproved && <p className="text-sm text-destructive">This lock must be approved before commands can be sent.</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Command History</CardTitle>
          <CardDescription>Latest commands sent to this lock, including execution and sync state.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Command</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>On-chain Sync</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyResponse?.data.map((command) => (
                  <TableRow key={command.id}>
                    <TableCell>{new Date(command.submittedAt).toLocaleString()}</TableCell>
                    <TableCell>{command.commandType}</TableCell>
                    <TableCell><Badge variant={command.status === 'executed' ? 'default' : command.status === 'failed' ? 'destructive' : 'secondary'}>{command.status}</Badge></TableCell>
                    <TableCell>{command.executionSyncedOnChain ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Link to="/commands/$dataId" params={{ dataId: command.id }}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeviceDetail;