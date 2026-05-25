'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Key,
  Webhook,
  Plus,
  Trash2,
  Copy,
  Check,
  Play,
  Loader2,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  Terminal,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  event_types: string[];
  is_active: boolean;
  created_at: string;
}

export function DeveloperApiManager() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'keys' | 'webhooks'>('keys');
  const [loading, setLoading] = useState(true);

  // API Keys States
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedRawKey, setRevealedRawKey] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  // Webhooks States
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'message.received',
    'message.sent',
    'message.status',
  ]);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null);
  const [togglingWebhookId, setTogglingWebhookId] = useState<string | null>(null);

  // Live Testing States
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    status?: number;
    statusText?: string;
    responsePreview?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function loadData() {
    try {
      setLoading(true);
      await Promise.all([fetchApiKeys(), fetchWebhooks()]);
    } catch (err) {
      console.error('Error fetching developer API data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchApiKeys() {
    try {
      const response = await fetch('/api/whatsapp/api-keys');
      if (!response.ok) throw new Error();
      const data = await response.json();
      setApiKeys(data || []);
    } catch (err) {
      toast.error('Failed to load API keys');
    }
  }

  async function fetchWebhooks() {
    try {
      const response = await fetch('/api/whatsapp/external-webhooks');
      if (!response.ok) throw new Error();
      const data = await response.json();
      setWebhooks(data || []);
    } catch (err) {
      toast.error('Failed to load webhook configurations');
    }
  }

  // --- API Key Handlers ---

  async function handleGenerateKey() {
    if (!newKeyName.trim()) {
      toast.error('API Key name is required');
      return;
    }

    try {
      setGeneratingKey(true);
      const response = await fetch('/api/whatsapp/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to generate key');

      setRevealedRawKey(result.rawKey);
      setNewKeyName('');
      setKeyDialogOpen(false);
      await fetchApiKeys();
      toast.success('Developer API Key generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create API key');
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleRevokeKey(id: string) {
    try {
      setRevokingKeyId(id);
      const response = await fetch(`/api/whatsapp/api-keys/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error();

      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success('API Key revoked and deleted');
    } catch (err) {
      toast.error('Failed to revoke API key');
    } finally {
      setRevokingKeyId(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('API Key copied to clipboard!');
  }

  // --- Webhook Handlers ---

  function handleEventCheckbox(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function handleAddWebhook() {
    if (!newWebhookUrl.trim() || !newWebhookUrl.startsWith('http')) {
      toast.error('A valid absolute target URL is required');
      return;
    }

    if (selectedEvents.length === 0) {
      toast.error('Subscribe to at least one event type');
      return;
    }

    try {
      setSavingWebhook(true);
      const response = await fetch('/api/whatsapp/external-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newWebhookUrl.trim(),
          event_types: selectedEvents,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create webhook');

      setNewWebhookUrl('');
      setSelectedEvents(['message.received', 'message.sent', 'message.status']);
      setWebhookDialogOpen(false);
      await fetchWebhooks();
      toast.success('Webhook registered successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save webhook');
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleToggleWebhook(id: string, currentStatus: boolean) {
    try {
      setTogglingWebhookId(id);
      const response = await fetch(`/api/whatsapp/external-webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) throw new Error();
      const updated = await response.json();

      setWebhooks((prev) => prev.map((wh) => (wh.id === id ? updated : wh)));
      toast.success(updated.is_active ? 'Webhook subscription enabled' : 'Webhook subscription paused');
    } catch (err) {
      toast.error('Failed to update webhook subscription status');
    } finally {
      setTogglingWebhookId(null);
    }
  }

  async function handleDeleteWebhook(id: string) {
    try {
      setDeletingWebhookId(id);
      const response = await fetch(`/api/whatsapp/external-webhooks/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error();

      setWebhooks((prev) => prev.filter((wh) => wh.id !== id));
      if (testResult?.id === id) setTestResult(null);
      toast.success('Webhook subscription deleted');
    } catch (err) {
      toast.error('Failed to delete webhook subscription');
    } finally {
      setDeletingWebhookId(null);
    }
  }

  async function handleTestWebhook(id: string) {
    try {
      setTestingWebhookId(id);
      setTestResult(null);
      const response = await fetch(`/api/whatsapp/external-webhooks/${id}/test`, {
        method: 'POST',
      });

      const result = await response.json();
      setTestResult({
        id,
        success: result.success,
        status: result.status,
        statusText: result.statusText,
        responsePreview: result.responsePreview,
        error: result.error,
      });

      if (result.success) {
        toast.success('Test ping delivered successfully!');
      } else {
        toast.error('Test delivery failed');
      }
    } catch (err) {
      toast.error('Failed to trigger webhook test');
    } finally {
      setTestingWebhookId(null);
    }
  }

  // Formatting date helper
  function formatLocalDate(isoString: string) {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Sub tabs navigation */}
      <div className="flex border-b border-slate-800 pb-px gap-4">
        <button
          onClick={() => {
            setActiveSubTab('keys');
            setRevealedRawKey(null);
          }}
          className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-all ${
            activeSubTab === 'keys'
              ? 'border-violet-500 text-violet-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="size-4" />
          Developer API Keys
        </button>
        <button
          onClick={() => {
            setActiveSubTab('webhooks');
            setRevealedRawKey(null);
          }}
          className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-all ${
            activeSubTab === 'webhooks'
              ? 'border-violet-500 text-violet-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Webhook className="size-4" />
          Outbound Webhooks
        </button>
      </div>

      {activeSubTab === 'keys' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Developer Access Tokens</h3>
              <p className="text-sm text-slate-400">
                Generate secure bearer tokens to authenticate third-party client integrations.
              </p>
            </div>
            <Button
              onClick={() => {
                setRevealedRawKey(null);
                setKeyDialogOpen(true);
              }}
              className="bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-lg transition-transform active:scale-95 duration-75"
            >
              <Plus className="size-4" />
              Generate Token
            </Button>
          </div>

          {/* Render freshly generated key (ONLY ONCE) */}
          {revealedRawKey && (
            <Card className="bg-emerald-950/20 border-emerald-500/40 animate-in fade-in duration-300">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-300">Save Your Private API Token</h4>
                    <p className="text-xs text-emerald-400/80 mt-1">
                      For high-security compliance, this token is securely hashed in our database. It will be
                      displayed here **only once**! If you lose this key, you must delete and generate a new one.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      readOnly
                      value={revealedRawKey}
                      className="w-full bg-slate-900 border border-emerald-500/30 rounded-md px-3 py-2 text-sm font-mono text-emerald-200 select-all focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <Button
                    onClick={() => copyToClipboard(revealedRawKey)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {copiedKey === revealedRawKey ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copiedKey === revealedRawKey ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {apiKeys.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Key className="size-8 text-slate-600 stroke-[1.5] mb-2" />
                <p className="text-slate-400 text-sm font-medium">No API keys generated yet.</p>
                <p className="text-slate-500 text-xs mt-1">
                  Create a developer token to securely send messages from external apps.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="border-slate-800 hover:bg-transparent">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 font-semibold px-6 py-4">Name/Description</TableHead>
                      <TableHead className="text-slate-400 font-semibold px-6 py-4">Prefix ID</TableHead>
                      <TableHead className="text-slate-400 font-semibold px-6 py-4">Created At</TableHead>
                      <TableHead className="text-slate-400 font-semibold px-6 py-4">Last Active</TableHead>
                      <TableHead className="text-slate-400 font-semibold px-6 py-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id} className="border-slate-800/80 hover:bg-slate-800/20">
                        <TableCell className="text-white font-medium px-6 py-4">{key.name}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-300 px-6 py-4">
                          <span className="bg-slate-800 border border-slate-700/60 rounded px-1.5 py-0.5">
                            {key.key_prefix}...
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-400 px-6 py-4">
                          {formatLocalDate(key.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-400 px-6 py-4">
                          {key.last_used_at ? (
                            <span className="text-emerald-400 font-medium">{formatLocalDate(key.last_used_at)}</span>
                          ) : (
                            <span className="text-slate-500 italic">Never used</span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleRevokeKey(key.id)}
                            disabled={revokingKeyId === key.id}
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/20 p-2 h-auto"
                            title="Revoke and delete API Key"
                          >
                            {revokingKeyId === key.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* API Documentation Reference */}
          <Card className="bg-slate-900 border-slate-800 mt-8 overflow-hidden">
            <CardHeader className="border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2">
                <Terminal className="size-5 text-violet-400" />
                <div>
                  <CardTitle className="text-white text-base">REST API Reference</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Send WhatsApp messages programmatically from Node-red, Zapier, or any custom client.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Endpoint Block */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-200">Endpoint URL</h4>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-md px-3 py-2.5 font-mono text-xs gap-3">
                  <span className="bg-violet-500/10 text-violet-400 font-bold px-2 py-0.5 rounded border border-violet-500/25 uppercase shrink-0">
                    POST
                  </span>
                  <span className="text-slate-300 select-all break-all flex-1">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/v1/whatsapp/send` : '/api/v1/whatsapp/send'}
                  </span>
                </div>
              </div>

              {/* Headers Block */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-200">Required Headers</h4>
                <div className="bg-slate-950 border border-slate-800/80 rounded-md p-3 font-mono text-xs space-y-1.5">
                  <div className="flex">
                    <span className="text-slate-500 w-32 shrink-0">Authorization:</span>
                    <span className="text-slate-300">Bearer wac_sec_YOUR_KEY_HERE</span>
                  </div>
                  <div className="flex">
                    <span className="text-slate-500 w-32 shrink-0">Content-Type:</span>
                    <span className="text-slate-300">application/json</span>
                  </div>
                </div>
              </div>

              {/* Payloads Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Text Message */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Text Message Schema</h4>
                  </div>
                  <pre className="bg-slate-950 border border-slate-800/80 rounded-md p-3 text-[11px] font-mono text-violet-300 overflow-x-auto select-all leading-relaxed">
{`{
  "phone": "+1234567890",
  "message_type": "text",
  "content_text": "Hello world from WACRM API!"
}`}
                  </pre>
                </div>

                {/* Template Message */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Template Schema</h4>
                  </div>
                  <pre className="bg-slate-950 border border-slate-800/80 rounded-md p-3 text-[11px] font-mono text-violet-300 overflow-x-auto select-all leading-relaxed">
{`{
  "phone": "+1234567890",
  "message_type": "template",
  "template_name": "appointment_reminder",
  "template_params": ["John", "10:30 AM", "May 28"]
}`}
                  </pre>
                </div>
              </div>

              {/* Sample Response and CURL */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-slate-800/60">
                {/* HTTP Response */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Response (200 OK)</h4>
                  <pre className="bg-slate-950 border border-slate-800/80 rounded-md p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto select-all leading-relaxed">
{`{
  "success": true,
  "message_id": "a9bc2385-df04-4b53-8f0a-8bf8c8e14aa1",
  "whatsapp_message_id": "wamid.HBgLMjQzODQ2NDY..."
}`}
                  </pre>
                </div>

                {/* Curl Outbound */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Outbound cURL Shell</h4>
                  <pre className="bg-slate-950 border border-slate-800/80 rounded-md p-3 text-[11px] font-mono text-amber-300 overflow-x-auto select-all whitespace-pre-wrap break-all leading-relaxed">
{`curl -X POST \\
  ${typeof window !== 'undefined' ? `${window.location.origin}/api/v1/whatsapp/send` : '/api/v1/whatsapp/send'} \\
  -H "Authorization: Bearer wac_sec_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+1234567890",
    "message_type": "text",
    "content_text": "Hello from WACRM!"
  }'`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSubTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Webhook Subscriptions</h3>
              <p className="text-sm text-slate-400">
                Register external HTTP POST endpoints to receive real-time notification of WhatsApp messages.
              </p>
            </div>
            <Button
              onClick={() => {
                setTestResult(null);
                setWebhookDialogOpen(true);
              }}
              className="bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-lg transition-transform active:scale-95 duration-75"
            >
              <Plus className="size-4" />
              Add Webhook
            </Button>
          </div>

          {webhooks.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Webhook className="size-8 text-slate-600 stroke-[1.5] mb-2" />
                <p className="text-slate-400 text-sm font-medium">No webhooks registered.</p>
                <p className="text-slate-500 text-xs mt-1">
                  Add a webhook target to capture inbound customer messages instantly.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {webhooks.map((wh) => (
                <Card key={wh.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate max-w-md lg:max-w-xl">
                            {wh.url}
                          </span>
                          <Badge
                            className={
                              wh.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }
                          >
                            {wh.is_active ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {wh.event_types.map((ev) => (
                            <span
                              key={ev}
                              className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-0.5 font-medium"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Pause toggle */}
                        <Button
                          variant="outline"
                          onClick={() => handleToggleWebhook(wh.id, wh.is_active)}
                          disabled={togglingWebhookId === wh.id}
                          className="border-slate-800 hover:bg-slate-800 text-slate-300 text-xs py-1 px-3 h-auto"
                        >
                          {togglingWebhookId === wh.id ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : (
                            <Activity className="size-3 mr-1" />
                          )}
                          {wh.is_active ? 'Pause' : 'Activate'}
                        </Button>

                        {/* Test Delivery */}
                        <Button
                          variant="outline"
                          onClick={() => handleTestWebhook(wh.id)}
                          disabled={testingWebhookId === wh.id}
                          className="border-slate-800 hover:bg-slate-800 text-slate-300 text-xs py-1 px-3 h-auto"
                        >
                          {testingWebhookId === wh.id ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : (
                            <Play className="size-3 mr-1" />
                          )}
                          Test Payload
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteWebhook(wh.id)}
                          disabled={deletingWebhookId === wh.id}
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/20 p-2 h-auto"
                        >
                          {deletingWebhookId === wh.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Signing Secret Box */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-md p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block md:inline mr-2">
                          Signing Secret:
                        </span>
                        <code className="text-violet-300 font-mono select-all break-all">{wh.secret}</code>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => copyToClipboard(wh.secret)}
                        className="text-slate-400 hover:text-white p-1 h-auto text-xs shrink-0 self-end md:self-auto"
                      >
                        <Copy className="size-3 mr-1" /> Copy
                      </Button>
                    </div>

                    {/* Render live test results for this webhook */}
                    {testResult && testResult.id === wh.id && (
                      <Card className={`border ${testResult.success ? 'bg-emerald-950/10 border-emerald-500/30' : 'bg-red-950/10 border-red-500/30'} animate-in slide-in-from-top duration-300`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            {testResult.success ? (
                              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="size-4 text-red-400 shrink-0" />
                            )}
                            <h4 className={`text-sm font-semibold ${testResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                              Test Delivery {testResult.success ? 'Successful' : 'Failed'}
                            </h4>
                          </div>

                          {testResult.error ? (
                            <p className="text-xs text-red-400">{testResult.error}</p>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex gap-4 text-xs">
                                <div>
                                  <span className="text-slate-400 mr-1.5 font-medium">Response Status:</span>
                                  <span className={`font-semibold ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {testResult.status} {testResult.statusText}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-slate-400 text-xs font-medium block">Target Server Response Body Preview:</span>
                                <pre className="bg-slate-950 border border-slate-800/80 rounded p-2 text-xs font-mono text-slate-300 select-all overflow-x-auto max-h-32">
                                  {testResult.responsePreview}
                                </pre>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* dialog for API key creation */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Generate Developer API Token</DialogTitle>
            <DialogDescription className="text-slate-400">
              Provide a label/description for this key to identify it in your external systems.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Token Description</Label>
              <Input
                placeholder="e.g. Node-red integration / Zapier outbound"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerateKey();
                }}
              />
            </div>
          </div>

          <DialogFooter className="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setKeyDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateKey}
              disabled={generatingKey}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {generatingKey ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" />
                  Generating...
                </>
              ) : (
                'Generate Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dialog for Webhook registration */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Register Webhook Target</DialogTitle>
            <DialogDescription className="text-slate-400">
              Subscribes an absolute HTTP endpoint to real-time CRM updates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Endpoint Target URL</Label>
              <Input
                placeholder="https://your-api.com/webhooks/whatsapp"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Subscribed Events</Label>
              <div className="space-y-2 bg-slate-950 border border-slate-800/80 rounded p-3 text-sm">
                <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes('message.received')}
                    onChange={() => handleEventCheckbox('message.received')}
                    className="rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-slate-950"
                  />
                  <div>
                    <span className="font-medium block">message.received</span>
                    <span className="text-xs text-slate-500">Triggered whenever a customer sends you a message.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none pt-2 border-t border-slate-900">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes('message.sent')}
                    onChange={() => handleEventCheckbox('message.sent')}
                    className="rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-slate-950"
                  />
                  <div>
                    <span className="font-medium block">message.sent</span>
                    <span className="text-xs text-slate-500">Triggered when you send an outbound message (UI/REST).</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer select-none pt-2 border-t border-slate-900">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes('message.status')}
                    onChange={() => handleEventCheckbox('message.status')}
                    className="rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-slate-950"
                  />
                  <div>
                    <span className="font-medium block">message.status</span>
                    <span className="text-xs text-slate-500">Triggered on delivery/read receipts updates.</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setWebhookDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddWebhook}
              disabled={savingWebhook}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {savingWebhook ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                'Save Webhook'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
