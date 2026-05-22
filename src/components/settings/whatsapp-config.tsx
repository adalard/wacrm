'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  QrCode,
  Smartphone,
  Server,
  Key,
  Database,
  Unplug,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | 'evolution_api_error' | null;

export function WhatsAppConfig() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Tab State
  const [connectionMethod, setConnectionMethod] = useState<'meta' | 'evolution'>('meta');

  // Meta Params
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  // Evolution Params
  const [evolutionServerUrl, setEvolutionServerUrl] = useState('');
  const [evolutionApiKey, setEvolutionApiKey] = useState('');
  const [evolutionInstanceName, setEvolutionInstanceName] = useState('');
  const [apiKeyEdited, setApiKeyEdited] = useState(false);

  // QR Pairing State
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string>('DISCONNECTED');

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const evolutionWebhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook/evolution`
      : '';

  const fetchConfig = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      // Load form values from Supabase (shows what's in DB)
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load config row:', error);
      }

      if (data) {
        setConfig(data);
        const method = data.connection_method || 'meta';
        setConnectionMethod(method);

        // Load Meta
        setPhoneNumberId(data.phone_number_id || '');
        setWabaId(data.waba_id || '');
        setAccessToken(data.access_token ? MASKED_TOKEN : '');
        setVerifyToken('');
        setTokenEdited(false);

        // Load Evolution
        setEvolutionServerUrl(data.evolution_server_url || '');
        setEvolutionApiKey(data.evolution_api_key ? MASKED_TOKEN : '');
        setEvolutionInstanceName(data.evolution_instance_name || '');
        setApiKeyEdited(false);
      } else {
        setConfig(null);
        setConnectionMethod('meta');
        
        // Reset Meta
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setTokenEdited(false);

        // Reset Evolution
        setEvolutionServerUrl('');
        setEvolutionApiKey('');
        setEvolutionInstanceName('');
        setApiKeyEdited(false);
      }

      // Then verify health via the API (decrypts token + pings appropriate service)
      if (data) {
        try {
          const res = await fetch('/api/whatsapp/config', { method: 'GET' });
          const payload = await res.json();

          if (payload.connected) {
            setConnectionStatus('connected');
            setResetReason(null);
            setStatusMessage('');
          } else {
            setConnectionStatus('disconnected');
            setResetReason(
              payload.needs_reset
                ? 'token_corrupted'
                : payload.reason === 'meta_api_error'
                ? 'meta_api_error'
                : payload.reason === 'evolution_api_error'
                ? 'evolution_api_error'
                : null
            );
            setStatusMessage(payload.message || '');
          }
        } catch (err) {
          console.error('Health check failed:', err);
          setConnectionStatus('disconnected');
        }
      } else {
        setConnectionStatus('disconnected');
        setResetReason(null);
        setStatusMessage('');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // QR Code pairing polling
  const pollConnection = useCallback(async () => {
    if (connectionMethod !== 'evolution' || !config || connectionStatus === 'connected') {
      return;
    }

    try {
      const res = await fetch('/api/whatsapp/connect');
      if (!res.ok) return;
      const data = await res.json();

      if (data.connected) {
        setConnectionStatus('connected');
        setQrCodeBase64(null);
        setQrStatus('CONNECTED');
        toast.success('WhatsApp connected successfully!');
      } else {
        setConnectionStatus('disconnected');
        setQrStatus(data.status || 'DISCONNECTED');
        if (data.base64) {
          setQrCodeBase64(data.base64);
        } else {
          setQrCodeBase64(null);
        }
      }
    } catch (err) {
      console.error('Polling connection failed:', err);
    }
  }, [connectionMethod, config, connectionStatus]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchConfig(user.id);
  }, [authLoading, user, fetchConfig]);

  // QR Poll effect
  useEffect(() => {
    if (connectionMethod !== 'evolution' || !config || connectionStatus === 'connected') {
      setQrCodeBase64(null);
      return;
    }

    // Initial query
    pollConnection();

    const interval = setInterval(pollConnection, 3000);
    return () => clearInterval(interval);
  }, [connectionMethod, config, connectionStatus, pollConnection]);

  async function handleSave() {
    // Validate by method
    if (connectionMethod === 'meta') {
      if (!phoneNumberId.trim()) {
        toast.error('Phone Number ID is required');
        return;
      }
      if (!config && (!accessToken.trim() || !tokenEdited)) {
        toast.error('Access Token is required for initial setup');
        return;
      }
    } else {
      if (!evolutionServerUrl.trim()) {
        toast.error('Evolution Server URL is required');
        return;
      }
      if (!evolutionInstanceName.trim()) {
        toast.error('Instance Name is required');
        return;
      }
      if (!config && (!evolutionApiKey.trim() || !apiKeyEdited)) {
        toast.error('API Key is required for initial setup');
        return;
      }
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        connection_method: connectionMethod,
      };

      if (connectionMethod === 'meta') {
        payload.phone_number_id = phoneNumberId.trim();
        payload.waba_id = wabaId.trim() || null;
        payload.verify_token = verifyToken.trim() || null;

        if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
          payload.access_token = accessToken.trim();
        } else if (config && tokenEdited) {
          toast.error('Please enter a valid Access Token to update changes');
          setSaving(false);
          return;
        } else if (config && !tokenEdited) {
          toast.error('Please re-enter the Access Token to save changes');
          setSaving(false);
          return;
        }
      } else {
        payload.evolution_server_url = evolutionServerUrl.trim();
        payload.evolution_instance_name = evolutionInstanceName.trim();

        if (apiKeyEdited && evolutionApiKey !== MASKED_TOKEN && evolutionApiKey.trim()) {
          payload.evolution_api_key = evolutionApiKey.trim();
        } else if (config && apiKeyEdited) {
          toast.error('Please enter a valid API Key to update changes');
          setSaving(false);
          return;
        } else if (config && !apiKeyEdited) {
          toast.error('Please re-enter the Server API Key to save changes');
          setSaving(false);
          return;
        }
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      toast.success(
        data.phone_info?.verified_name
          ? `Connected to ${data.phone_info.verified_name}`
          : 'Configuration saved successfully'
      );

      if (user) await fetchConfig(user.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        toast.success(
          payload.phone_info?.verified_name
            ? `Connected to ${payload.phone_info.verified_name}`
            : 'API connection successful'
        );
      } else {
        setConnectionStatus('disconnected');
        setResetReason(
          payload.needs_reset
            ? 'token_corrupted'
            : payload.reason === 'meta_api_error'
            ? 'meta_api_error'
            : payload.reason === 'evolution_api_error'
            ? 'evolution_api_error'
            : null
        );
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!confirm('This will delete the current WhatsApp config so you can re-enter it. Continue?')) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to reset configuration');
        return;
      }

      toast.success('Configuration cleared. You can now re-enter your credentials.');
      setConfig(null);
      
      // Reset Meta fields
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setTokenEdited(false);

      // Reset Evolution fields
      setEvolutionServerUrl('');
      setEvolutionApiKey('');
      setEvolutionInstanceName('');
      setApiKeyEdited(false);

      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
      setQrCodeBase64(null);
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  async function handleDisconnectDevice() {
    if (!confirm('Are you sure you want to disconnect this WhatsApp device? This will log out of the active WhatsApp Web session.')) {
      return;
    }

    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to disconnect device');
        return;
      }

      toast.success('WhatsApp device disconnected successfully.');
      setConnectionStatus('disconnected');
      setQrCodeBase64(null);
      setQrStatus('DISCONNECTED');
      if (user) await fetchConfig(user.id);
    } catch (err) {
      console.error('Disconnect error:', err);
      toast.error('Failed to disconnect device');
    } finally {
      setTesting(false);
    }
  }

  function handleCopyWebhookUrl(url: string) {
    navigator.clipboard.writeText(url);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-violet-500" />
      </div>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';

  return (
    <div className="space-y-6 mt-4">
      {/* Dynamic Navigation Tabs */}
      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1 w-fit">
        <button
          onClick={() => setConnectionMethod('meta')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
            connectionMethod === 'meta'
              ? 'bg-violet-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Database className="size-4" />
          Official Meta Cloud API
        </button>
        <button
          onClick={() => setConnectionMethod('evolution')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
            connectionMethod === 'evolution'
              ? 'bg-violet-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="size-4" />
          Evolution WhatsApp Web API
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Main config form */}
        <div className="space-y-6">
          {/* Corrupted-token reset banner */}
          {showResetBanner && (
            <Alert className="bg-amber-950/40 border-amber-600/40">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <AlertTitle className="text-amber-200 mb-1">
                    Stored token/API key can&apos;t be decrypted
                  </AlertTitle>
                  <AlertDescription className="text-amber-100/80 text-sm">
                    {statusMessage}
                  </AlertDescription>
                  <Button
                    onClick={handleReset}
                    disabled={resetting}
                    size="sm"
                    className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {resetting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="size-4" />
                        Reset Configuration
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          {/* Connection Status Card */}
          <Alert className="bg-slate-900 border-slate-700">
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <CheckCircle2 className="size-4 text-violet-500" />
              ) : (
                <XCircle className="size-4 text-red-500" />
              )}
              <AlertTitle className="text-white mb-0">
                {connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
              </AlertTitle>
            </div>
            <AlertDescription className="text-slate-400 mt-1">
              {connectionStatus === 'connected' ? (
                connectionMethod === 'meta' ? (
                  'Your WhatsApp Business API is connected and ready to send/receive messages.'
                ) : (
                  'Your Evolution API session is connected and ready. CRM and WhatsApp Web are completely synchronized!'
                )
              ) : (
                statusMessage ||
                (connectionMethod === 'meta'
                  ? 'Configure your Meta API credentials below to connect your WhatsApp Business account.'
                  : 'Configure your local or VPS Evolution API credentials below to connect your WhatsApp Web account.')
              )}
            </AlertDescription>
          </Alert>

          {/* Interactive QR Code scan box for Evolution API */}
          {connectionMethod === 'evolution' && config && (
            <Card className="bg-slate-900 border-slate-700 overflow-hidden ring-transparent">
              <CardHeader className="bg-slate-950/40 border-b border-slate-800">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <QrCode className="size-5 text-violet-500 animate-pulse" />
                  Evolution WhatsApp Device Link
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Secure pairing mechanism using WhatsApp Web protocol.
                </CardDescription>
              </CardHeader>
              <CardContent className="py-6 flex flex-col items-center justify-center">
                {connectionStatus === 'connected' ? (
                  <div className="text-center space-y-4 max-w-sm">
                    <div className="mx-auto w-16 h-16 rounded-full bg-violet-950/80 border border-violet-500 flex items-center justify-center">
                      <CheckCircle2 className="size-8 text-violet-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-lg">Instance Active</h4>
                      <p className="text-sm text-slate-400 mt-1">
                        Instance <span className="font-mono text-violet-400 font-bold">{evolutionInstanceName}</span> is online and fully linked.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleDisconnectDevice}
                      className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40 w-full"
                    >
                      <Unplug className="size-4 mr-2" />
                      Disconnect WhatsApp Account
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center space-y-6 max-w-md">
                    <div>
                      <h4 className="text-white font-semibold">Pair Your Device</h4>
                      <p className="text-xs text-slate-400 mt-1 px-4">
                        Open WhatsApp on your mobile phone, navigate to <strong className="text-slate-300">Linked Devices</strong>, and scan the QR code below.
                      </p>
                    </div>

                    <div className="relative size-60 rounded-xl border border-slate-700 bg-white p-3 flex items-center justify-center shadow-xl transition-all duration-300 group hover:border-violet-500">
                      {qrCodeBase64 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrCodeBase64}
                          alt="Pairing QR Code"
                          className="size-full rounded-md object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-2 text-slate-500">
                          <Loader2 className="size-8 animate-spin text-violet-500" />
                          <span className="text-xs font-semibold">Awaiting QR Code...</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs bg-slate-950/60 py-1.5 px-3 rounded-full border border-slate-800 text-slate-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                      </span>
                      <span>Session Status: <strong className="text-slate-300 font-bold">{qrStatus}</strong></span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Form for Meta Credentials */}
          {connectionMethod === 'meta' && (
            <Card className="bg-slate-900 border-slate-700 ring-transparent">
              <CardHeader>
                <CardTitle className="text-white">API Credentials</CardTitle>
                <CardDescription className="text-slate-400">
                  Enter your Meta WhatsApp Business API credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Phone Number ID</Label>
                  <Input
                    placeholder="e.g. 100234567890123"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">WhatsApp Business Account ID</Label>
                  <Input
                    placeholder="e.g. 100234567890456"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Permanent Access Token</Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      placeholder="Enter your access token"
                      value={accessToken}
                      onChange={(e) => {
                        setAccessToken(e.target.value);
                        setTokenEdited(true);
                      }}
                      onFocus={() => {
                        if (accessToken === MASKED_TOKEN) {
                          setAccessToken('');
                          setTokenEdited(true);
                        }
                      }}
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {config && !tokenEdited && (
                    <p className="text-xs text-slate-500">
                      Token is hidden for security. Re-enter it to update configuration.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Webhook Verify Token</Label>
                  <Input
                    placeholder="Create a custom verify token"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">
                    A custom string you create. Must match the token you set in Meta webhook settings.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form for Evolution Credentials */}
          {connectionMethod === 'evolution' && (
            <Card className="bg-slate-900 border-slate-700 ring-transparent">
              <CardHeader>
                <CardTitle className="text-white">Evolution API Credentials</CardTitle>
                <CardDescription className="text-slate-400">
                  Connect your Evolution API instance (supports local docker or VPS).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Server className="size-4 text-slate-400" />
                    Server URL
                  </Label>
                  <Input
                    placeholder="e.g. http://localhost:8080 or https://whatsapp.myvps.com"
                    value={evolutionServerUrl}
                    onChange={(e) => setEvolutionServerUrl(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">
                    The endpoint of your running Evolution API server. Ensure no trailing slash.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Smartphone className="size-4 text-slate-400" />
                      Instance Name
                    </Label>
                    <Input
                      placeholder="e.g. my_session"
                      value={evolutionInstanceName}
                      onChange={(e) => setEvolutionInstanceName(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    />
                    <p className="text-xs text-slate-500">
                      The session/device name (alphanumeric, no spaces).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Key className="size-4 text-slate-400" />
                      Server API Key
                    </Label>
                    <div className="relative">
                      <Input
                        type={showToken ? 'text' : 'password'}
                        placeholder="Global API key"
                        value={evolutionApiKey}
                        onChange={(e) => {
                          setEvolutionApiKey(e.target.value);
                          setApiKeyEdited(true);
                        }}
                        onFocus={() => {
                          if (evolutionApiKey === MASKED_TOKEN) {
                            setEvolutionApiKey('');
                            setApiKeyEdited(true);
                          }
                        }}
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {config && !apiKeyEdited && (
                      <p className="text-xs text-slate-500">
                        API Key is hidden. Re-enter it to update configuration.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Webhook URLs Display */}
          <Card className="bg-slate-900 border-slate-700 ring-transparent">
            <CardHeader>
              <CardTitle className="text-white">Webhook Configuration</CardTitle>
              <CardDescription className="text-slate-400">
                Register this webhook callback URL to receive real-time sync of messages and statuses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectionMethod === 'meta' ? (
                <div className="space-y-2">
                  <Label className="text-slate-300">Meta Webhook Callback URL</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={webhookUrl}
                      className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyWebhookUrl(webhookUrl)}
                      className="shrink-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-slate-300">Evolution Webhook URL (Auto-Registered)</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={evolutionWebhookUrl}
                      className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyWebhookUrl(evolutionWebhookUrl)}
                      className="shrink-0 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-violet-400 mt-1">
                    ℹ️ Evolution webhooks are automatically registered on the server upon saving credentials.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !config}
              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {testing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Test Integration
                </>
              )}
            </Button>
            {config && (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={resetting}
                className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
              >
                {resetting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Reset Configuration
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Setup Instructions Sidebar */}
        <div>
          <Card className="bg-slate-900 border-slate-700 ring-transparent">
            <CardHeader>
              <CardTitle className="text-white text-base">Setup Instructions</CardTitle>
              <CardDescription className="text-slate-400">
                {connectionMethod === 'meta'
                  ? 'Follow these steps to connect your WhatsApp Business API.'
                  : 'Follow these steps to connect your Evolution API.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connectionMethod === 'meta' ? (
                <Accordion>
                  <AccordionItem className="border-slate-700">
                    <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">1</span>
                        Create a Meta App
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>Go to <span className="text-violet-400">developers.facebook.com</span></li>
                        <li>Click &quot;My Apps&quot; and then &quot;Create App&quot;</li>
                        <li>Select &quot;Business&quot; as the app type</li>
                        <li>Fill in app details and create</li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem className="border-slate-700">
                    <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">2</span>
                        Add WhatsApp Product
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>In your app dashboard, click &quot;Add Product&quot;</li>
                        <li>Find &quot;WhatsApp&quot; and click &quot;Set Up&quot;</li>
                        <li>Follow the setup wizard to link your business</li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem className="border-slate-700">
                    <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">3</span>
                        Get API Credentials
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>Go to WhatsApp &gt; API Setup</li>
                        <li>Copy your <strong className="text-slate-200">Phone Number ID</strong></li>
                        <li>Copy your <strong className="text-slate-200">WhatsApp Business Account ID</strong></li>
                        <li>Generate a <strong className="text-slate-200">Permanent Access Token</strong> from Business Settings &gt; System Users</li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem className="border-slate-700">
                    <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">4</span>
                        Configure Webhooks
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>Go to WhatsApp &gt; Configuration</li>
                        <li>Click &quot;Edit&quot; on the Webhook section</li>
                        <li>Paste the <strong className="text-slate-200">Webhook Callback URL</strong> from above</li>
                        <li>Enter the same <strong className="text-slate-200">Verify Token</strong> you set here</li>
                        <li>Subscribe to &quot;messages&quot; webhook field</li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : (
                <Accordion>
                  <AccordionItem className="border-slate-700">
                    <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">1</span>
                        Spin Up Evolution API
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
                        <li>Deploy Evolution API using Docker.</li>
                        <li>Make sure PostgreSQL and Redis containers are active.</li>
                        <li>Note down the server port (default <strong className="text-slate-200">8080</strong>) and your security <strong className="text-slate-200">API Key</strong>.</li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem className="border-slate-700">
                    <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">2</span>
                        Enter Credentials
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
                        <li>Fill in the Server URL (e.g. `http://localhost:8080` in local dev).</li>
                        <li>Create a custom Instance Name (e.g. `my_instance`).</li>
                        <li>Enter the global Server API Key.</li>
                        <li>Click <strong className="text-slate-200">Save Configuration</strong>.</li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem className="border-slate-700">
                    <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline">
                      <span className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">3</span>
                        Link WhatsApp Account
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
                        <li>Once saved, the <strong className="text-slate-200">Device Link Card</strong> will appear above.</li>
                        <li>A pairing QR Code will generate automatically.</li>
                        <li>Scan it from your phone's WhatsApp application to activate the connection!</li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              <div className="mt-4 pt-4 border-t border-slate-700">
                {connectionMethod === 'meta' ? (
                  <a
                    href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                    Meta WhatsApp API Docs
                  </a>
                ) : (
                  <a
                    href="https://doc.evolution-api.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                    Evolution API Docs
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
