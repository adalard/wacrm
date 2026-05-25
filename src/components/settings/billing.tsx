'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  CreditCard,
  Check,
  Loader2,
  Sparkles,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UsageStats {
  contactsCount: number;
  contactsLimit: number;
  broadcastsCount: number;
  broadcastsLimit: number;
  tier: 'free' | 'pro' | 'enterprise';
  status: string;
  currentPeriodEnd: string | null;
  stripeMocked: boolean;
}

export function BillingManager() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadUsageStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function loadUsageStats() {
    try {
      setLoading(true);
      const response = await fetch('/api/billing/stats');
      if (response.ok) {
        const liveStats = await response.json();
        setStats(liveStats);
      } else {
        throw new Error('Failed to retrieve live stats');
      }
    } catch (err) {
      console.warn('Error loading billing info, using local sandbox metrics:', err);
      // Fail gracefully to mock stats
      setStats({
        contactsCount: 12,
        contactsLimit: 100,
        broadcastsCount: 8,
        broadcastsLimit: 50,
        tier: 'free',
        status: 'active',
        currentPeriodEnd: null,
        stripeMocked: true,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(targetTier: 'free' | 'pro' | 'enterprise') {
    try {
      setCheckingOut(targetTier);
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: targetTier }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Checkout session failed');

      if (result.mocked) {
        toast.success(`Successfully activated plan tier "${targetTier}"! (Sandbox Mode)`);
        await loadUsageStats();
        // Force refresh UI state
        window.location.reload();
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize checkout');
    } finally {
      setCheckingOut(null);
    }
  }

  async function handleLaunchPortal() {
    try {
      setOpeningPortal(true);
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Portal session failed');

      if (result.mocked) {
        toast.success('Downgraded account back to Free plan. (Sandbox Mode)');
        await loadUsageStats();
        window.location.reload();
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load billing portal');
    } finally {
      setOpeningPortal(false);
    }
  }

  function formatLocalDate(isoString: string) {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const isPro = stats.tier === 'pro';
  const isEnterprise = stats.tier === 'enterprise';
  const hasUnlimitedUsage = stats.contactsLimit === Infinity;

  // Percentage calculations
  const contactPercentage = hasUnlimitedUsage ? 0 : Math.min(100, (stats.contactsCount / stats.contactsLimit) * 100);
  const broadcastPercentage = hasUnlimitedUsage ? 0 : Math.min(100, (stats.broadcastsCount / stats.broadcastsLimit) * 100);

  return (
    <div className="space-y-6 mt-4 animate-in fade-in duration-300">
      {/* Overview Block */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-white text-base">Subscription Plan Overview</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Manage your billing cycles, Stripe parameters, and usage tiers.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`px-3 py-1 text-xs font-semibold ${
                isPro 
                  ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' 
                  : isEnterprise 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {stats.tier === 'free' ? 'Free Starter' : stats.tier === 'pro' ? 'Professional' : 'Enterprise'}
              </Badge>
              {stats.status && (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-2 py-0.5 text-[10px] uppercase font-bold">
                  {stats.status}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 space-y-4">
          {stats.stripeMocked && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 flex gap-2.5 items-start text-xs text-amber-300 leading-normal">
              <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Billing Sandbox Mode Active</span>
                No Stripe keys are configured in your `.env.local` settings. Billing buttons will instantly upgrade or downgrade your active plan locally without requiring payment cards.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan Info */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-350 font-semibold text-xs uppercase tracking-wider">
                <CreditCard className="size-4 text-violet-400" />
                <span>Plan Details</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 text-[10px] font-medium block">Subscription Period</span>
                {stats.currentPeriodEnd ? (
                  <p className="text-sm font-semibold text-slate-200">
                    Renews on <span className="text-violet-400">{formatLocalDate(stats.currentPeriodEnd)}</span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-slate-400">
                    No active renewal period. Free Forever.
                  </p>
                )}
              </div>
            </div>

            {/* Developer Keys Box */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-350 font-semibold text-xs uppercase tracking-wider">
                  {isPro || isEnterprise ? (
                    <Unlock className="size-4 text-emerald-400" />
                  ) : (
                    <Lock className="size-4 text-slate-550" />
                  )}
                  <span>API Integration</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 text-[10px] font-medium block">REST API & Webhooks Access</span>
                {isPro || isEnterprise ? (
                  <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5" />
                    Unlocked (Professional Scope)
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                    <Lock className="size-3.5" />
                    Locked (Upgrade Required)
                  </p>
                )}
              </div>
            </div>
          </div>

          {stats.tier !== 'free' && (
            <div className="pt-2 flex justify-end">
              <Button
                onClick={handleLaunchPortal}
                disabled={openingPortal}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold shadow text-xs py-1.5 h-auto"
              >
                {openingPortal ? (
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                ) : (
                  <ArrowUpRight className="size-3.5 mr-1.5" />
                )}
                {stats.stripeMocked ? 'Sandbox Downgrade to Free' : 'Manage Subscription & Invoices'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Limits Section */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Usage Limits & Metrics</CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Monitor your monthly data volume cap allocations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Gauge 1: Contacts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-semibold text-slate-300">Contacts Count Cap</span>
              <span className="font-mono text-slate-400">
                {stats.contactsCount} / {hasUnlimitedUsage ? '∞' : stats.contactsLimit}
              </span>
            </div>
            {!hasUnlimitedUsage ? (
              <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-850 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-550 ${
                    contactPercentage >= 90 
                      ? 'bg-red-500' 
                      : contactPercentage >= 70 
                        ? 'bg-yellow-500' 
                        : 'bg-violet-500'
                  }`}
                  style={{ width: `${contactPercentage}%` }}
                />
              </div>
            ) : (
              <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-850 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: '100%' }} />
              </div>
            )}
            <p className="text-[10px] text-slate-500">
              {hasUnlimitedUsage 
                ? 'Your Pro plan supports unlimited CRM contact creation.' 
                : 'Free tier limits you to 100 contacts. Active sync blocks new contact creation if exceeded.'}
            </p>
          </div>

          {/* Gauge 2: Broadcasts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-semibold text-slate-300">Monthly Broadcast Recipients Quota</span>
              <span className="font-mono text-slate-400">
                {stats.broadcastsCount} / {hasUnlimitedUsage ? '∞' : stats.broadcastsLimit}
              </span>
            </div>
            {!hasUnlimitedUsage ? (
              <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-850 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-550 ${
                    broadcastPercentage >= 90 
                      ? 'bg-red-500' 
                      : broadcastPercentage >= 70 
                        ? 'bg-yellow-500' 
                        : 'bg-violet-500'
                  }`}
                  style={{ width: `${broadcastPercentage}%` }}
                />
              </div>
            ) : (
              <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-850 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: '100%' }} />
              </div>
            )}
            <p className="text-[10px] text-slate-500">
              {hasUnlimitedUsage 
                ? 'Your Pro plan supports unlimited broadcast campaigns and recipients.' 
                : 'Free tier permits up to 50 recipients monthly. Resets automatically on the 1st.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upgrades pricing cards inside dashboard settings: Only shown if user is Free */}
      {stats.tier === 'free' && (
        <Card className="bg-slate-900 border-slate-850">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-violet-400">
              <Sparkles className="size-5 animate-pulse" />
              <CardTitle className="text-white text-base">Available SaaS Upgrades</CardTitle>
            </div>
            <CardDescription className="text-slate-450 text-xs">
              Upgrade to unlock unlimited contacts, automated templates, secure REST APIs, and outbound HMAC webhooks.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Inner Pro Card */}
            <div className="bg-slate-950 border border-violet-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg shadow-violet-600/5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">Professional Plan Tier</span>
                  <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/20 text-[9px] font-bold uppercase px-2 py-0.5">
                    14-Day Free Trial
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 max-w-lg leading-normal">
                  Unlock unlimited contact directories, custom template configurations, secure developer access keys (`wac_sec_...`), and outbound webhooks with custom HMAC signatures.
                </p>
                <div className="flex items-baseline text-white pt-1">
                  <span className="text-2xl font-extrabold">$29</span>
                  <span className="text-slate-500 text-xs ml-1">/ month</span>
                </div>
              </div>
              <Button
                onClick={() => handleCheckout('pro')}
                disabled={checkingOut !== null}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow px-6 py-2.5 rounded-xl text-xs shrink-0"
              >
                {checkingOut === 'pro' ? (
                  <>
                    <Loader2 className="size-3 animate-spin mr-1.5" />
                    Connecting...
                  </>
                ) : (
                  'Start 14-Day Free Trial'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
