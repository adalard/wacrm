'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Users,
  ShieldCheck,
  Zap,
  DollarSign,
  Search,
  Loader2,
  Lock,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Sliders,
  UserCheck,
  CreditCard,
  Settings,
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface AdminStats {
  totalUsers: number;
  activePro: number;
  activeEnterprise: number;
  systemWideMessages: number;
  estimatedMRR: number;
}

interface TenantUser {
  id: string;
  email: string;
  full_name: string;
  tier: 'free' | 'pro' | 'enterprise';
  status: string;
  created_at: string;
  whatsapp_status: string;
  contacts_count: number;
}

interface PackageConfig {
  id: string;
  name: string;
  code: string;
  price_monthly: number;
  price_yearly: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  contact_limit: number;
  broadcast_limit: number;
  has_api_access: boolean;
  has_bulk_sending: boolean;
  has_scheduled_sending: boolean;
}

interface StripeSettings {
  publishableKey: string;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  connected: boolean;
  errorMsg: string | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'analytics' | 'plans' | 'stripe'>('analytics');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Analytics States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [usersList, setUsersList] = useState<TenantUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [overrideTier, setOverrideTier] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [updatingTier, setUpdatingTier] = useState(false);

  // Packages Plan Configuration States
  const [packages, setPackages] = useState<PackageConfig[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageConfig | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Stripe Integration States
  const [stripeConfig, setStripeConfig] = useState<StripeSettings | null>(null);
  const [stripeInputPublishable, setStripeInputPublishable] = useState('');
  const [stripeInputSecret, setStripeInputSecret] = useState('');
  const [stripeInputWebhook, setStripeInputWebhook] = useState('');
  const [showSecretKeys, setShowSecretKeys] = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    verifyAdminRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function verifyAdminRole() {
    try {
      setLoading(true);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error || !profile || profile.role !== 'admin') {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await Promise.all([loadAnalytics(), loadPackages(), loadStripeSettings()]);
      setLoading(false);
    } catch (err) {
      console.error('Error verifying role:', err);
      setIsAdmin(false);
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const statsRes = await fetch('/api/admin/stats');
      const usersRes = await fetch('/api/admin/users');
      if (statsRes.ok && usersRes.ok) {
        setStats(await statsRes.json());
        setUsersList(await usersRes.json());
      } else {
        simulateAnalytics();
      }
    } catch {
      simulateAnalytics();
    }
  }

  async function loadPackages() {
    try {
      const response = await fetch('/api/admin/packages');
      if (response.ok) {
        setPackages(await response.json());
      } else {
        simulatePackages();
      }
    } catch {
      simulatePackages();
    }
  }

  async function loadStripeSettings() {
    try {
      const response = await fetch('/api/admin/stripe');
      if (response.ok) {
        const data = await response.json();
        setStripeConfig(data);
        setStripeInputPublishable(data.publishableKey || '');
      } else {
        setStripeConfig({
          publishableKey: '',
          hasSecretKey: false,
          hasWebhookSecret: false,
          connected: false,
          errorMsg: 'Database keys unconfigured',
        });
      }
    } catch {
      setStripeConfig({
        publishableKey: '',
        hasSecretKey: false,
        hasWebhookSecret: false,
        connected: false,
        errorMsg: 'Database keys unconfigured',
      });
    }
  }

  function simulateAnalytics() {
    setStats({
      totalUsers: 84,
      activePro: 18,
      activeEnterprise: 2,
      systemWideMessages: 8420,
      estimatedMRR: 820,
    });
    setUsersList([
      {
        id: 'user_01',
        email: 'ceo@alphatech.com',
        full_name: 'Sarah Jenkins',
        tier: 'pro',
        status: 'active',
        created_at: '2026-05-22T08:00:00.000Z',
        whatsapp_status: 'connected',
        contacts_count: 42,
      },
      {
        id: 'user_02',
        email: 'admin@wacrm.app',
        full_name: 'Admin Developer',
        tier: 'pro',
        status: 'active',
        created_at: '2026-05-18T12:00:00.000Z',
        whatsapp_status: 'connected',
        contacts_count: 15,
      },
      {
        id: 'user_03',
        email: 'david@millermedia.co',
        full_name: 'David Miller',
        tier: 'free',
        status: 'active',
        created_at: '2026-05-25T01:30:00.000Z',
        whatsapp_status: 'disconnected',
        contacts_count: 4,
      },
    ]);
  }

  function simulatePackages() {
    setPackages([
      {
        id: 'pkg_1',
        name: 'Free Starter',
        code: 'free',
        price_monthly: 0,
        price_yearly: 0,
        stripe_price_id_monthly: null,
        stripe_price_id_yearly: null,
        contact_limit: 100,
        broadcast_limit: 50,
        has_api_access: false,
        has_bulk_sending: false,
        has_scheduled_sending: false,
      },
      {
        id: 'pkg_2',
        name: 'Professional',
        code: 'pro',
        price_monthly: 29,
        price_yearly: 23,
        stripe_price_id_monthly: 'price_pro_monthly_id',
        stripe_price_id_yearly: 'price_pro_yearly_id',
        contact_limit: -1,
        broadcast_limit: -1,
        has_api_access: true,
        has_bulk_sending: true,
        has_scheduled_sending: true,
      },
      {
        id: 'pkg_3',
        name: 'Enterprise',
        code: 'enterprise',
        price_monthly: 149,
        price_yearly: 119,
        stripe_price_id_monthly: 'price_ent_monthly_id',
        stripe_price_id_yearly: 'price_ent_yearly_id',
        contact_limit: -1,
        broadcast_limit: -1,
        has_api_access: true,
        has_bulk_sending: true,
        has_scheduled_sending: true,
      },
    ]);
  }

  async function handleApplyOverride() {
    if (!selectedUser) return;
    try {
      setUpdatingTier(true);
      const response = await fetch('/api/admin/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, tier: overrideTier }),
      });
      if (!response.ok) throw new Error();
      toast.success('Tenant plan override applied!');
      setSelectedUser(null);
      await loadAnalytics();
    } catch {
      toast.error('Failed to override plan level');
    } finally {
      setUpdatingTier(false);
    }
  }

  async function handleSavePackage() {
    if (!selectedPackage) return;
    try {
      setSavingPlan(true);
      const response = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedPackage),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Plan update failed');

      toast.success(`Plan configuration "${selectedPackage.name}" successfully updated!`);
      setSelectedPackage(null);
      await loadPackages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update plan configurations');
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleSaveStripe() {
    try {
      setSavingStripe(true);
      const response = await fetch('/api/admin/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishableKey: stripeInputPublishable,
          secretKey: stripeInputSecret,
          webhookSecret: stripeInputWebhook,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save settings');

      toast.success('Stripe gateway credentials saved and encrypted!');
      setStripeInputSecret('');
      setStripeInputWebhook('');
      await loadStripeSettings();
    } catch (err: any) {
      toast.error(err.message || 'Gateway credentials registration failed');
    } finally {
      setSavingStripe(false);
    }
  }

  function formatLocalDate(isoString: string) {
    try {
      return new Date(isoString).toLocaleDateString();
    } catch {
      return isoString;
    }
  }

  const filteredUsers = usersList.filter((u) => {
    const q = searchQuery.toLowerCase();
    const emailMatch = u.email ? u.email.toLowerCase().includes(q) : false;
    const nameMatch = u.full_name ? u.full_name.toLowerCase().includes(q) : false;
    return emailMatch || nameMatch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 select-none relative overflow-hidden text-slate-100">
        <Card className="max-w-md w-full bg-slate-900 border-red-500/20 text-center shadow-2xl">
          <CardContent className="pt-8 pb-6 space-y-5">
            <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-full text-red-400 inline-flex shadow animate-bounce">
              <Lock className="size-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Access Denied</h1>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
                This administrative console is restricted to system administrators with active role scopes.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold px-5 py-2.5 rounded-xl text-xs transition-colors"
              >
                Return to CRM Dashboard
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="size-6 text-violet-400" />
            Super Admin Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Oversee SaaS metrics, adjust plan boundaries dynamically, and manage Stripe credentials.
          </p>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-slate-800 pb-px gap-4">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'analytics'
              ? 'border-violet-500 text-violet-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="size-4" />
          Analytics & Directory
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'plans'
              ? 'border-violet-500 text-violet-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="size-4" />
          Manage Plans
        </button>
        <button
          onClick={() => setActiveTab('stripe')}
          className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'stripe'
              ? 'border-violet-500 text-violet-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="size-4" />
          Stripe Setup
        </button>
      </div>

      {/* --- TAB 1: ANALYTICS & DIRECTORY --- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-4 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Total Tenants</span>
                  <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-4 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Active Pro</span>
                  <p className="text-2xl font-bold text-white text-violet-450">{stats.activePro}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-4 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Enterprise</span>
                  <p className="text-2xl font-bold text-white text-amber-400">{stats.activeEnterprise}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-4 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Estimated MRR</span>
                  <p className="text-2xl font-bold text-emerald-400">${stats.estimatedMRR}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-4 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">CRM Messages</span>
                  <p className="text-2xl font-bold text-white">{stats.systemWideMessages}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-4 border-b border-slate-800/80">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-white text-base">Tenant Directory</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Search and manually override active plan limitations.
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-655" />
                  <Input
                    placeholder="Search name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="border-slate-800">
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400 font-semibold px-6 py-4">User Details</TableHead>
                    <TableHead className="text-slate-400 font-semibold px-6 py-4">Subscription Plan</TableHead>
                    <TableHead className="text-slate-400 font-semibold px-6 py-4">Created At</TableHead>
                    <TableHead className="text-slate-400 font-semibold px-6 py-4">WhatsApp Status</TableHead>
                    <TableHead className="text-slate-400 font-semibold px-6 py-4">Contacts Count</TableHead>
                    <TableHead className="text-slate-400 font-semibold px-6 py-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((tenant) => (
                    <TableRow key={tenant.id} className="border-slate-800/80 hover:bg-slate-800/20">
                      <TableCell className="px-6 py-4">
                        <span className="text-white font-medium block text-sm">{tenant.full_name || 'Anonymous'}</span>
                        <span className="text-slate-500 font-mono text-xs">{tenant.email}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className={`px-2 py-0.5 text-[10px] ${
                          tenant.tier === 'pro'
                            ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                            : tenant.tier === 'enterprise'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {tenant.tier === 'free' ? 'Free Starter' : tenant.tier === 'pro' ? 'Professional' : 'Enterprise'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 px-6 py-4">
                        {formatLocalDate(tenant.created_at)}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className={`text-xs inline-flex items-center gap-1 font-medium ${
                          tenant.whatsapp_status === 'connected' ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          <span className={`size-1.5 rounded-full ${
                            tenant.whatsapp_status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'
                          }`} />
                          {tenant.whatsapp_status === 'connected' ? 'Connected' : 'Offline'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-350 px-6 py-4">
                        {tenant.contacts_count} / {tenant.tier === 'free' ? '100' : '∞'}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedUser(tenant);
                            setOverrideTier(tenant.tier);
                          }}
                          className="text-violet-400 hover:text-violet-300 p-2 h-auto text-xs font-semibold"
                        >
                          <UserCheck className="size-4 mr-1" />
                          Override
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- TAB 2: MANAGE PLANS --- */}
      {activeTab === 'plans' && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Dynamic Pricing Packages Configuration</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Directly adjust limits, prices, Stripe Price IDs, and checkbox feature toggles for WACRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-slate-800">
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Package Level</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Price (Monthly/Yearly)</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Contact Limit</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Monthly Broadcasts</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Developer REST API</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Bulk Messages</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Scheduled Sending</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow key={pkg.id} className="border-slate-800/80 hover:bg-slate-800/20">
                    <TableCell className="font-bold text-white px-6 py-4">{pkg.name}</TableCell>
                    <TableCell className="px-6 py-4 text-xs font-mono font-medium text-slate-300">
                      ${pkg.price_monthly} / ${pkg.price_yearly}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs">
                      {pkg.contact_limit === -1 ? <span className="text-violet-400 font-semibold">Unlimited (∞)</span> : `${pkg.contact_limit} contacts`}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs">
                      {pkg.broadcast_limit === -1 ? <span className="text-violet-400 font-semibold">Unlimited (∞)</span> : `${pkg.broadcast_limit} rec.`}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs">
                      <Badge className={pkg.has_api_access ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-450'}>
                        {pkg.has_api_access ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs">
                      <Badge className={pkg.has_bulk_sending ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-450'}>
                        {pkg.has_bulk_sending ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs">
                      <Badge className={pkg.has_scheduled_sending ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-450'}>
                        {pkg.has_scheduled_sending ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedPackage({ ...pkg })}
                        className="text-violet-400 hover:text-violet-300 p-2 h-auto text-xs font-semibold"
                      >
                        <Settings className="size-4 mr-1" />
                        Edit Plan
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* --- TAB 3: STRIPE SETUP --- */}
      {activeTab === 'stripe' && stripeConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inputs Panel: 7 cols */}
          <Card className="lg:col-span-7 bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Stripe Account API Integration</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Setup your Stripe keys. Sensitive keys will be AES-255 encrypted at rest.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300 uppercase">Stripe Publishable Key</Label>
                <Input
                  placeholder="pk_test_..."
                  value={stripeInputPublishable}
                  onChange={(e) => setStripeInputPublishable(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white font-mono text-xs placeholder:text-slate-655"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-300 uppercase">Stripe Secret Key</Label>
                  <button
                    onClick={() => setShowSecretKeys(!showSecretKeys)}
                    className="text-[10px] text-slate-400 hover:text-white inline-flex items-center gap-1"
                  >
                    {showSecretKeys ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    {showSecretKeys ? 'Hide' : 'Show'} Key
                  </button>
                </div>
                <Input
                  type={showSecretKeys ? 'text' : 'password'}
                  placeholder={stripeConfig.hasSecretKey ? '••••••••••••••••••••••••••••••••••••••••' : 'sk_test_...'}
                  value={stripeInputSecret}
                  onChange={(e) => setStripeInputSecret(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white font-mono text-xs placeholder:text-slate-655"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300 uppercase">Stripe Webhook Signing Secret</Label>
                <Input
                  type={showSecretKeys ? 'text' : 'password'}
                  placeholder={stripeConfig.hasWebhookSecret ? '••••••••••••••••••••••••••••••••••••••••' : 'whsec_...'}
                  value={stripeInputWebhook}
                  onChange={(e) => setStripeInputWebhook(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white font-mono text-xs placeholder:text-slate-655"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleSaveStripe}
                  disabled={savingStripe}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow shadow-violet-600/10"
                >
                  {savingStripe ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1.5" />
                      Encrypting & Saving...
                    </>
                  ) : (
                    'Save Stripe Settings'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Connection Status Card: 5 cols */}
          <Card className="lg:col-span-5 bg-slate-900 border-slate-800 flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-white text-base">API Connection Status</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Real-time validation indicator for payment gateways.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="flex items-center justify-center py-6">
                {stripeConfig.connected ? (
                  <div className="text-center space-y-2">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-full text-emerald-400 inline-flex shadow animate-pulse">
                      <ShieldCheck className="size-10" />
                    </div>
                    <h4 className="font-bold text-white text-sm">Stripe Account Linked</h4>
                    <p className="text-emerald-400/80 text-xs font-medium">Authentication Ping: 200 OK</p>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-full text-amber-400 inline-flex shadow">
                      <AlertTriangle className="size-10" />
                    </div>
                    <h4 className="font-bold text-white text-sm">Gateway Disconnected</h4>
                    <p className="text-slate-500 text-xs max-w-xs leading-normal">
                      Checkout routes are running in local sandbox mock checkouts.
                    </p>
                  </div>
                )}
              </div>

              {stripeConfig.errorMsg && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-left font-mono text-[10px] text-slate-500 max-h-24 overflow-y-auto">
                  <span className="font-semibold block uppercase tracking-wider text-slate-600 mb-1">Status Message:</span>
                  {stripeConfig.errorMsg}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Override plan Modal */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Sliders className="size-5 text-violet-400" />
                Override Plan Limits
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Manually adjust the subscription tier for **{selectedUser.full_name || selectedUser.email}**. This bypasses active Stripe portals.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Target Pricing Level</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOverrideTier('free')}
                    className={`flex-1 p-3 rounded-xl border text-center transition-all ${
                      overrideTier === 'free'
                        ? 'bg-slate-950 border-slate-700 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    Free
                  </button>
                  <button
                    onClick={() => setOverrideTier('pro')}
                    className={`flex-1 p-3 rounded-xl border text-center transition-all ${
                      overrideTier === 'pro'
                        ? 'bg-violet-950/20 border-violet-500 text-violet-400 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    Pro
                  </button>
                  <button
                    onClick={() => setOverrideTier('enterprise')}
                    className={`flex-1 p-3 rounded-xl border text-center transition-all ${
                      overrideTier === 'enterprise'
                        ? 'bg-amber-950/20 border-amber-500 text-amber-400 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    Enterprise
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter className="bg-slate-900 border-slate-700">
              <Button
                onClick={() => setSelectedUser(null)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApplyOverride}
                disabled={updatingTier}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {updatingTier ? 'Updating...' : 'Apply Override'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit plan details Modal */}
      {selectedPackage && (
        <Dialog open={!!selectedPackage} onOpenChange={() => setSelectedPackage(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-lg overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Sliders className="size-5 text-violet-400" />
                Configure Pricing Package: {selectedPackage.name}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Dynamically adjust limits, pricing metrics, and feature permissions. Changes apply system-wide instantly.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-slate-100 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-slate-355 font-bold uppercase block">Package Name</Label>
                  <Input
                    value={selectedPackage.name}
                    onChange={(e) => setSelectedPackage({ ...selectedPackage, name: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-355 font-bold uppercase block">Package Code (ReadOnly)</Label>
                  <Input
                    readOnly
                    value={selectedPackage.code}
                    className="bg-slate-950/40 border-slate-800 text-slate-500 font-mono text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-slate-355 font-bold uppercase block">Monthly Price ($)</Label>
                  <Input
                    type="number"
                    value={selectedPackage.price_monthly}
                    onChange={(e) => setSelectedPackage({ ...selectedPackage, price_monthly: Number(e.target.value) })}
                    className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-355 font-bold uppercase block">Yearly Price ($)</Label>
                  <Input
                    type="number"
                    value={selectedPackage.price_yearly}
                    onChange={(e) => setSelectedPackage({ ...selectedPackage, price_yearly: Number(e.target.value) })}
                    className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-slate-355 font-bold uppercase block">Stripe Price ID (Monthly)</Label>
                  <Input
                    placeholder="price_..."
                    value={selectedPackage.stripe_price_id_monthly || ''}
                    onChange={(e) => setSelectedPackage({ ...selectedPackage, stripe_price_id_monthly: e.target.value || null })}
                    className="bg-slate-950 border-slate-800 text-white font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-355 font-bold uppercase block">Stripe Price ID (Yearly)</Label>
                  <Input
                    placeholder="price_..."
                    value={selectedPackage.stripe_price_id_yearly || ''}
                    onChange={(e) => setSelectedPackage({ ...selectedPackage, stripe_price_id_yearly: e.target.value || null })}
                    className="bg-slate-950 border-slate-800 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-slate-355 font-bold uppercase block">Contact Count Cap (-1 = Unlimited)</Label>
                  <Input
                    type="number"
                    value={selectedPackage.contact_limit}
                    onChange={(e) => setSelectedPackage({ ...selectedPackage, contact_limit: Number(e.target.value) })}
                    className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-355 font-bold uppercase block">Monthly Broadcasts Cap (-1 = Unlimited)</Label>
                  <Input
                    type="number"
                    value={selectedPackage.broadcast_limit}
                    onChange={(e) => setSelectedPackage({ ...selectedPackage, broadcast_limit: Number(e.target.value) })}
                    className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 bg-slate-950 border border-slate-800/80 rounded-xl p-4 mt-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Feature Permissions Toggles</span>
                
                <div className="flex items-center justify-between py-2 border-b border-slate-900">
                  <div className="space-y-0.5 pr-4">
                    <span className="font-semibold text-slate-200 block text-xs">Developer REST API Keys</span>
                    <span className="text-[10px] text-slate-500">Provides secure tokens (`wac_sec_...`) and webhook triggers.</span>
                  </div>
                  <Switch
                    checked={selectedPackage.has_api_access}
                    onCheckedChange={(checked) => setSelectedPackage({ ...selectedPackage, has_api_access: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-900">
                  <div className="space-y-0.5 pr-4">
                    <span className="font-semibold text-slate-200 block text-xs">Bulk Message Campaigns</span>
                    <span className="text-[10px] text-slate-500">Permits sending multi-recipient Broadcast campaigns.</span>
                  </div>
                  <Switch
                    checked={selectedPackage.has_bulk_sending}
                    onCheckedChange={(checked) => setSelectedPackage({ ...selectedPackage, has_bulk_sending: checked })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5 pr-4">
                    <span className="font-semibold text-slate-200 block text-xs">Scheduled Message Pipelines</span>
                    <span className="text-[10px] text-slate-500">Allows queuing individual or bulk messages for later.</span>
                  </div>
                  <Switch
                    checked={selectedPackage.has_scheduled_sending}
                    onCheckedChange={(checked) => setSelectedPackage({ ...selectedPackage, has_scheduled_sending: checked })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="bg-slate-900 border-slate-700">
              <Button
                onClick={() => setSelectedPackage(null)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePackage}
                disabled={savingPlan}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {savingPlan ? 'Saving Changes...' : 'Save Configuration'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
