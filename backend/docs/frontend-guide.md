# Frontend Development Guide for GydPlatform IoT Management

## Technology Stack

- **Framework**: React + Vite
- **State Management**: TanStack Query (React Query)
- **Routing**: TanStack Router
- **Forms**: React Hook Form
- **UI Components**: shadcn/ui + Tailwind CSS v4
- **Backend API**: GydPlatform IoT Backend

## Project Setup

### 1. Initialize Vite React Project

```bash
npm create vite@latest iot-frontend -- --template react-ts
cd iot-frontend
```

### 2. Install Dependencies

```bash
# Core dependencies
npm install @tanstack/react-query @tanstack/react-router
npm install react-hook-form @hookform/resolvers zod
npm install axios

# UI dependencies
npm install tailwindcss@next @tailwindcss/vite@next
npm install class-variance-authority clsx tailwind-merge lucide-react

# shadcn/ui setup
npx shadcn@latest init
npx shadcn@latest add button card input label table badge
npx shadcn@latest add dialog form select separator
npx shadcn@latest add tabs alert-dialog dropdown-menu
```

### 3. Configure Tailwind CSS v4

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

```css
/* src/index.css */
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

## Project Structure

```
src/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components
│   ├── dashboard/          # Dashboard components
│   ├── devices/            # Device components
│   └── data/               # Data components
├── hooks/                  # Custom hooks
├── lib/                    # Utilities and configurations
├── pages/                  # Route components
├── services/               # API services
├── stores/                 # State management
├── types/                  # TypeScript types
└── main.tsx               # App entry point
```

## API Service Setup

### 1. Create API Client

```typescript
// src/lib/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 2. Create API Services

```typescript
// src/services/authService.ts
import { api } from '@/lib/api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  async refreshToken(): Promise<AuthResponse> {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  logout() {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  },
};
```

```typescript
// src/services/deviceService.ts
import { api } from '@/lib/api';

export interface Device {
  _id: string;
  name: string;
  macAddress: string;
  walletAddress: string;
  owner: string;
  isApproved: boolean;
  blockchainTxHash?: string;
  registeredAt: string;
  lastDataTimestamp?: string;
  lastEncryptedData?: string;
  dataCount: number;
}

export interface DeviceStatus {
  device: Device;
  blockchainStatus: boolean;
  lastUpdate?: string;
}

export interface DeviceListResponse {
  devices: Device[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export const deviceService = {
  async getDevices(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<DeviceListResponse> {
    const response = await api.get('/devices', { params });
    return response.data;
  },

  async getDevice(deviceId: string): Promise<Device> {
    const response = await api.get(`/devices/${deviceId}`);
    return response.data;
  },

  async getDeviceStatus(deviceAddress: string): Promise<DeviceStatus> {
    const response = await api.get(`/devices/status/${deviceAddress}`);
    return response.data;
  },

  async approveDevice(deviceAddress: string): Promise<{ success: boolean; txHash: string }> {
    const response = await api.post(`/devices/approve/${deviceAddress}`);
    return response.data;
  },

  async rejectDevice(deviceAddress: string): Promise<{ success: boolean }> {
    const response = await api.post(`/devices/reject/${deviceAddress}`);
    return response.data;
  },

  async getAllDevices(): Promise<Device[]> {
    const response = await api.get('/devices/all');
    return response.data;
  },

  async searchDevices(query: string): Promise<Device[]> {
    const response = await api.get('/devices/search', { params: { q: query } });
    return response.data;
  },
};
```

```typescript
// src/services/dataService.ts
import { api } from '@/lib/api';

export interface DataPoint {
  _id: string;
  deviceAddress: string;
  encryptedData: string;
  txHash: string;
  timestamp: string;
  decryptedData?: any;
}

export interface DataListResponse {
  data: DataPoint[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export const dataService = {
  async getLatestData(deviceAddress: string): Promise<DataPoint> {
    const response = await api.get(`/data/latest/${deviceAddress}`);
    return response.data;
  },

  async getDataHistory(deviceAddress: string, params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<DataListResponse> {
    const response = await api.get(`/data/history/${deviceAddress}`, { params });
    return response.data;
  },

  async getAllData(params?: {
    page?: number;
    limit?: number;
  }): Promise<DataListResponse> {
    const response = await api.get('/data/all', { params });
    return response.data;
  },
};
```

## TanStack Query Setup

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});
```

## TanStack Router Setup

```typescript
// src/router/index.tsx
import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';

// Layout component
import Layout from '@/components/layout/Layout';

// Page components
import Dashboard from '@/pages/Dashboard';
import DeviceList from '@/pages/DeviceList';
import DeviceDetail from '@/pages/DeviceDetail';
import DataList from '@/pages/DataList';
import Login from '@/pages/Login';

// Root route
const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Layout />
    </QueryClientProvider>
  ),
});

// Dashboard route
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});

// Device routes
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

// Data routes
const dataListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data',
  component: DataList,
});

// Auth routes
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

// Create router
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    dashboardRoute,
    deviceListRoute,
    deviceDetailRoute,
    dataListRoute,
    loginRoute,
  ]),
});

// Register router for TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

## Custom Hooks

```typescript
// src/hooks/useAuth.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { authService, LoginCredentials, RegisterData } from '@/services/authService';

export const useLogin = () => {
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      window.location.href = '/';
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: (userData: RegisterData) => authService.register(userData),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      window.location.href = '/';
    },
  });
};

export const useLogout = () => {
  return () => {
    authService.logout();
  };
};
```

```typescript
// src/hooks/useDevices.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceService, Device } from '@/services/deviceService';

export const useDevices = (params?: { page?: number; limit?: number; status?: string }) => {
  return useQuery({
    queryKey: ['devices', params],
    queryFn: () => deviceService.getDevices(params),
  });
};

export const useDevice = (deviceId: string) => {
  return useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => deviceService.getDevice(deviceId),
    enabled: !!deviceId,
  });
};

export const useDeviceStatus = (deviceAddress: string) => {
  return useQuery({
    queryKey: ['deviceStatus', deviceAddress],
    queryFn: () => deviceService.getDeviceStatus(deviceAddress),
    enabled: !!deviceAddress,
  });
};

export const useApproveDevice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (deviceAddress: string) => deviceService.approveDevice(deviceAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
};

export const useRejectDevice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (deviceAddress: string) => deviceService.rejectDevice(deviceAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
};

export const useAllDevices = () => {
  return useQuery({
    queryKey: ['allDevices'],
    queryFn: () => deviceService.getAllDevices(),
  });
};
```

```typescript
// src/hooks/useData.ts
import { useQuery } from '@tanstack/react-query';
import { dataService } from '@/services/dataService';

export const useLatestData = (deviceAddress: string) => {
  return useQuery({
    queryKey: ['latestData', deviceAddress],
    queryFn: () => dataService.getLatestData(deviceAddress),
    enabled: !!deviceAddress,
  });
};

export const useDataHistory = (deviceAddress: string, params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: ['dataHistory', deviceAddress, params],
    queryFn: () => dataService.getDataHistory(deviceAddress, params),
    enabled: !!deviceAddress,
  });
};

export const useAllData = (params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['allData', params],
    queryFn: () => dataService.getAllData(params),
  });
};
```

## View Components

### 1. Dashboard View

```typescript
// src/pages/Dashboard.tsx
import { useAllDevices, useAllData } from '@/hooks/useDevices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, Clock, XCircle, Activity, Database, Smartphone } from 'lucide-react';

const Dashboard = () => {
  const { data: devices, isLoading: devicesLoading } = useAllDevices();
  const { data: dataResponse, isLoading: dataLoading } = useAllData({ limit: 10 });

  const stats = devices ? {
    total: devices.length,
    approved: devices.filter(d => d.isApproved).length,
    pending: devices.filter(d => !d.isApproved).length,
    rejected: 0, // Backend doesn't track rejected status separately
  } : { total: 0, approved: 0, pending: 0, rejected: 0 };

  const latestDevices = devices?.slice(0, 5).sort((a, b) => 
    new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  );

  const latestData = dataResponse?.data.slice(0, 5);

  if (devicesLoading || dataLoading) {
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
        <p className="text-muted-foreground">
          Overview of your IoT device management system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Registered devices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">
              Active devices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dataResponse?.data.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total data submissions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tables Side by Side */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Latest Devices */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Devices</CardTitle>
            <CardDescription>Recently registered devices</CardDescription>
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
                {latestDevices?.map((device) => (
                  <TableRow key={device._id}>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell>
                      <Badge variant={device.isApproved ? "default" : "secondary"}>
                        {device.isApproved ? "Approved" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(device.registeredAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Latest Data */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Data</CardTitle>
            <CardDescription>Recent sensor data submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestData?.map((data) => (
                  <TableRow key={data._id}>
                    <TableCell className="font-medium">
                      {data.deviceAddress.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {new Date(data.timestamp).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Activity className="h-3 w-3 mr-1" />
                        Active
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
```

### 2. Device List View

```typescript
// src/pages/DeviceList.tsx
import { useState } from 'react';
import { useDevices, useApproveDevice, useRejectDevice } from '@/hooks/useDevices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, CheckCircle, XCircle, Eye, Search } from 'lucide-react';
import { Link } from '@tanstack/react-router';

const DeviceList = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: devicesResponse, isLoading } = useDevices({ page, limit: 10, status: status !== 'all' ? status : undefined });
  const approveDevice = useApproveDevice();
  const rejectDevice = useRejectDevice();

  const handleApprove = async (deviceAddress: string) => {
    await approveDevice.mutateAsync(deviceAddress);
  };

  const handleReject = async (deviceAddress: string) => {
    await rejectDevice.mutateAsync(deviceAddress);
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
          <p className="text-muted-foreground">
            Manage and monitor your IoT devices
          </p>
        </div>
      </div>

      {/* Filters */}
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
                  placeholder="Search devices..."
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
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Device Table */}
      <Card>
        <CardHeader>
          <CardTitle>Device List</CardTitle>
          <CardDescription>
            {devicesResponse?.pagination.total || 0} devices found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>Wallet Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Count</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devicesResponse?.devices.map((device) => (
                <TableRow key={device._id}>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell>{device.macAddress}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {device.walletAddress.slice(0, 8)}...{device.walletAddress.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={device.isApproved ? "default" : "secondary"}>
                      {device.isApproved ? "Approved" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>{device.dataCount}</TableCell>
                  <TableCell>
                    {new Date(device.registeredAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link to="/devices/$deviceId" params={{ deviceId: device._id }}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      
                      {!device.isApproved && (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="default" size="sm">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Approve Device</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to approve {device.name}? This will allow the device to submit data to the blockchain.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleApprove(device.walletAddress)}>
                                  Approve
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reject Device</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to reject {device.name}? This will prevent the device from submitting data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleReject(device.walletAddress)}>
                                  Reject
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, devicesResponse?.pagination.total || 0)} of {devicesResponse?.pagination.total || 0} devices
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!devicesResponse?.pagination.hasNextPage}
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
```

### 3. Device Detail View

```typescript
// src/pages/DeviceDetail.tsx
import { useParams } from '@tanstack/react-router';
import { useDevice, useDeviceStatus, useDataHistory } from '@/hooks/useDevices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, CheckCircle, XCircle, Activity, Calendar, Hash } from 'lucide-react';
import { Link } from '@tanstack/react-router';

const DeviceDetail = () => {
  const { deviceId } = useParams({ from: '/devices/$deviceId' });
  
  const { data: device, isLoading: deviceLoading } = useDevice(deviceId);
  const { data: deviceStatus, isLoading: statusLoading } = useDeviceStatus(device?.walletAddress || '');
  const { data: dataHistory, isLoading: dataLoading } = useDataHistory(device?.walletAddress || '', { limit: 20 });

  if (deviceLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!device) {
    return <div>Device not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/devices">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Devices
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{device.name}</h1>
          <p className="text-muted-foreground">
            Device details and data history
          </p>
        </div>
      </div>

      {/* Device Details Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Device Information
            <Badge variant={device.isApproved ? "default" : "secondary"}>
              {device.isApproved ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approved
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Pending
                </>
              )}
            </Badge>
          </CardTitle>
          <CardDescription>
            Technical details and registration information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">MAC Address</label>
              <p className="font-mono">{device.macAddress}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Wallet Address</label>
              <p className="font-mono text-sm">{device.walletAddress}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Device ID</label>
              <p className="font-mono text-sm">{device._id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Data Count</label>
              <p>{device.dataCount} submissions</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Registered</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p>{new Date(device.registeredAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Data</label>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <p>
                  {device.lastDataTimestamp 
                    ? new Date(device.lastDataTimestamp).toLocaleDateString()
                    : 'No data yet'
                  }
                </p>
              </div>
            </div>
          </div>

          {device.blockchainTxHash && (
            <>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Blockchain Transaction</label>
                <div className="flex items-center gap-2 mt-1">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <p className="font-mono text-sm">{device.blockchainTxHash}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data History Section */}
      <Card>
        <CardHeader>
          <CardTitle>Data History</CardTitle>
          <CardDescription>
            Recent sensor data submissions from this device
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : dataHistory?.data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No data submissions yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Transaction Hash</TableHead>
                  <TableHead>Data Size</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataHistory?.data.map((data) => (
                  <TableRow key={data._id}>
                    <TableCell>
                      {new Date(data.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {data.txHash.slice(0, 10)}...{data.txHash.slice(-8)}
                    </TableCell>
                    <TableCell>
                      {data.encryptedData.length} bytes
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Activity className="h-3 w-3 mr-1" />
                        Recorded
                      </Badge>
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
```

### 4. Data List View

```typescript
// src/pages/DataList.tsx
import { useState } from 'react';
import { useAllData } from '@/hooks/useData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Download, Calendar } from 'lucide-react';

const DataList = () => {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const { data: dataResponse, isLoading } = useAllData({ page, limit: 20 });

  const filteredData = dataResponse?.data.filter(data => {
    const matchesSearch = searchQuery === '' || 
      data.deviceAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      data.txHash.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = dateFilter === 'all' || 
      (dateFilter === 'today' && new Date(data.timestamp).toDateString() === new Date().toDateString()) ||
      (dateFilter === 'week' && new Date(data.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (dateFilter === 'month' && new Date(data.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    
    return matchesSearch && matchesDate;
  });

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
          <h1 className="text-3xl font-bold tracking-tight">Data</h1>
          <p className="text-muted-foreground">
            View and analyze sensor data from all devices
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
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
                  placeholder="Search by device address or transaction hash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Submissions</CardTitle>
          <CardDescription>
            {filteredData?.length || 0} data points found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Address</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Transaction Hash</TableHead>
                <TableHead>Data Size</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData?.map((data) => (
                <TableRow key={data._id}>
                  <TableCell className="font-mono text-sm">
                    {data.deviceAddress.slice(0, 8)}...{data.deviceAddress.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(data.timestamp).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {data.txHash.slice(0, 10)}...{data.txHash.slice(-8)}
                  </TableCell>
                  <TableCell>{data.encryptedData.length} bytes</TableCell>
                  <TableCell>
                    <Badge variant="outline">Recorded</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, filteredData?.length || 0)} of {filteredData?.length || 0} data points
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!dataResponse?.pagination.hasNextPage}
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

export default DataList;
```

## Layout Component

```typescript
// src/components/layout/Layout.tsx
import { Outlet } from '@tanstack/react-router';
import { Navigation } from './Navigation';
import { Header } from './Header';

const Layout = () => {
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
```

```typescript
// src/components/layout/Navigation.tsx
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Smartphone, 
  Database, 
  Settings,
  LogOut
} from 'lucide-react';
import { useLogout } from '@/hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Devices', href: '/devices', icon: Smartphone },
  { name: 'Data', href: '/data', icon: Database },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Navigation = () => {
  const logout = useLogout();

  return (
    <div className="w-64 bg-card border-r border-border min-h-screen p-4">
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold">IoT Platform</h2>
          <p className="text-sm text-muted-foreground">Device Management</p>
        </div>
        
        <nav className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "text-muted-foreground"
                )}
                activeProps={{
                  className: "bg-accent text-accent-foreground",
                }}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export { Navigation };
```

```typescript
// src/components/layout/Header.tsx
import { Bell, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header = () => {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-6">
        <div className="flex-1">
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search devices, data..."
              className="pl-8"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm">
            <Bell className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export { Header };
```

## App Entry Point

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/router';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
```

## Environment Configuration

```bash
# .env
VITE_API_URL=http://localhost:3000/api
```

## Development Workflow

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

This frontend guide provides a complete React + Vite implementation with TanStack Query, TanStack Router, React Hook Form, and shadcn/ui + Tailwind CSS v4 for the GydPlatform IoT Management system. The implementation includes all four requested views: Dashboard, Device List, Device Detail, and Data List with proper state management, routing, and UI components.