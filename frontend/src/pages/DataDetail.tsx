import { useParams, Link } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, Calendar, Hash, Activity, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '@/services/dataService';

const JsonBlock = ({ value }: { value: unknown }) => (
  <div className="bg-muted p-4 rounded-md">
    <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
  </div>
);

const DataDetail = () => {
  const { dataId } = useParams({ from: '/commands/$dataId' });

  const { data: command, isLoading } = useQuery({
    queryKey: ['commandDetail', dataId],
    queryFn: () => dataService.getDataById(dataId),
    enabled: !!dataId,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!command) {
    return <div>Command not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/commands">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back to Commands</Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Details</h1>
          <p className="text-muted-foreground">Full off-chain and on-chain feedback for a single command lifecycle.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution Summary</CardTitle>
          <CardDescription>High-level command outcome and sync state.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Command Type</p>
            <p className="font-medium">{command.commandType}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={command.status === 'executed' ? 'default' : command.status === 'failed' ? 'destructive' : 'secondary'}>{command.status}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Submitted By Address</p>
            <p className="font-mono text-sm break-all">{command.submittedByAddress}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Executed By Lock</p>
            <p className="font-mono text-sm break-all">{command.executedByLockAddress || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Submitted At</p>
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{new Date(command.submittedAt).toLocaleString()}</div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Executed At</p>
            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" />{command.executedAt ? new Date(command.executedAt).toLocaleString() : '-'}</div>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground">Execution Result</p>
            <p>{command.executionResult || '-'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>On-chain Feedback</CardTitle>
          <CardDescription>Command submission and execution confirmation as recorded on Sepolia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Blockchain Command ID</p>
              <p>{command.blockchainCommandId ?? '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Execution Synced On-chain</p>
              <div className="mt-1 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" />{command.executionSyncedOnChain ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Submit Tx Hash</p>
              <p className="font-mono text-xs break-all">{command.blockchainTxHash || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Execution Tx Hash</p>
              <p className="font-mono text-xs break-all">{command.onChainExecutionTxHash || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Submit Block</p>
              <div className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" />{command.blockNumber ?? '-'}</div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Execution Block</p>
              <div className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" />{command.onChainExecutionBlockNumber ?? '-'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Off-chain Feedback</CardTitle>
          <CardDescription>Database state and backend-side tracking fields.</CardDescription>
        </CardHeader>
        <CardContent>
          <JsonBlock value={{
            status: command.status,
            processingStatus: command.processingStatus,
            processingError: command.processingError,
            executionResult: command.executionResult,
            executedAt: command.executedAt,
            executedByLockAddress: command.executedByLockAddress,
            executionSyncedOnChain: command.executionSyncedOnChain,
            onChainExecutionTxHash: command.onChainExecutionTxHash,
            onChainExecutionBlockNumber: command.onChainExecutionBlockNumber,
            onChainExecutionBlockTimestamp: command.onChainExecutionBlockTimestamp,
          }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw Payload</CardTitle>
          <CardDescription>Plain command object stored for debugging and thesis verification.</CardDescription>
        </CardHeader>
        <CardContent>
          <JsonBlock value={command.rawPayload || { note: 'No raw payload stored' }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Encrypted Payload</CardTitle>
          <CardDescription>AES-128 symmetric result as stored in off-chain logs.</CardDescription>
        </CardHeader>
        <CardContent>
          <JsonBlock value={command.cryptoDebug || { note: 'No crypto debug payload available' }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>Transport and request-side metadata captured by the backend.</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <JsonBlock value={{
            metadata: command.metadata,
            encryption: command.encryption,
            nonce: command.nonce,
            expiresAt: command.expiresAt,
            createdAt: command.createdAt,
            updatedAt: command.updatedAt,
          }} />
        </CardContent>
      </Card>
    </div>
  );
};

export default DataDetail;
