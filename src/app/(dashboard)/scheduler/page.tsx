'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ScheduledMessage } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Upload,
  Calendar,
  Play,
  Trash2,
  Loader2,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { ScheduleDialog } from '@/components/scheduler/schedule-dialog';
import { CSVImportDialog } from '@/components/scheduler/csv-import-dialog';
import { toast } from 'sonner';

export default function SchedulerPage() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Dialog states
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  // Fetch all scheduled messages
  async function fetchScheduledMessages() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setMessages(data ?? []);
    } catch (err: any) {
      console.error('Error fetching scheduled messages:', err);
      toast.error('Failed to load scheduled messages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchScheduledMessages();
  }, []);

  // Filter messages based on search query and status filter
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const matchesSearch =
        m.receiver_phone.includes(searchQuery) ||
        (m.content_text && m.content_text.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.template_name && m.template_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [messages, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = messages.length;
    const pending = messages.filter((m) => m.status === 'pending' || m.status === 'processing').length;
    const sent = messages.filter((m) => m.status === 'sent').length;
    const failed = messages.filter((m) => m.status === 'failed').length;
    return { total, pending, sent, failed };
  }, [messages]);

  // Execute Immediate Send
  async function handleSendNow(id: string) {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/whatsapp/scheduled/${id}/send`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send scheduled message');
      }

      toast.success('Message sent successfully!');
      fetchScheduledMessages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message.');
      fetchScheduledMessages();
    } finally {
      setProcessingId(null);
    }
  }

  // Cancel/Delete Scheduled Message
  async function handleCancel(id: string) {
    if (!confirm('Are you sure you want to cancel and delete this scheduled message?')) return;

    try {
      const response = await fetch(`/api/whatsapp/scheduled?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete message');
      }

      toast.success('Message cancelled successfully');
      fetchScheduledMessages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel message.');
    }
  }

  // Format date helper
  function formatDateTime(isoString: string) {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Message Scheduler</h1>
          <p className="mt-1 text-sm text-slate-400">
            Schedule text or template campaigns to individual numbers, or bulk-import via CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setCsvOpen(true)}
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
            variant="outline"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button
            onClick={() => setScheduleOpen(true)}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            Schedule Message
          </Button>
        </div>
      </div>

      {/* Metrics Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Scheduled</span>
            <Calendar className="h-4 w-4 text-violet-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending Execution</span>
            <Clock className="h-4 w-4 text-yellow-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.pending}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Succeeded</span>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.sent}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Failed</span>
            <AlertCircle className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.failed}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by phone, template name, message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('sent')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === 'sent'
                  ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              Sent
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === 'failed'
                  ? 'bg-rose-600/30 text-rose-400 border border-rose-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              Failed
            </button>
          </div>

          <Button
            size="icon"
            variant="outline"
            onClick={fetchScheduledMessages}
            disabled={loading}
            className="h-9 w-9 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Messages Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
          <Calendar className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm font-medium text-white">No scheduled messages</p>
          <p className="mt-1 text-xs text-slate-400">
            Create a scheduled task or upload a CSV to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Receiver</TableHead>
                <TableHead className="text-slate-400">Type</TableHead>
                <TableHead className="text-slate-400">Content / Template Detail</TableHead>
                <TableHead className="text-slate-400">Scheduled Time</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.map((msg) => {
                const isFailed = msg.status === 'failed';
                const isPending = msg.status === 'pending';
                const isProcessing = msg.status === 'processing';
                const isSent = msg.status === 'sent';

                return (
                  <TableRow
                    key={msg.id}
                    className="border-slate-800 hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Receiver */}
                    <TableCell className="font-semibold text-white whitespace-nowrap">
                      {msg.receiver_phone}
                    </TableCell>

                    {/* Message Type */}
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          msg.message_type === 'template'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                        }`}
                      >
                        {msg.message_type}
                      </span>
                    </TableCell>

                    {/* Content Preview */}
                    <TableCell className="max-w-[280px]">
                      {msg.message_type === 'text' ? (
                        <p className="truncate text-xs text-slate-300" title={msg.content_text}>
                          {msg.content_text}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-mono text-xs font-semibold text-white">
                            {msg.template_name}
                          </p>
                          {msg.template_params && msg.template_params.length > 0 && (
                            <p className="text-[10px] text-slate-400 truncate">
                              Params: {JSON.stringify(msg.template_params)}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Time */}
                    <TableCell className="text-xs text-slate-300 whitespace-nowrap">
                      {formatDateTime(msg.scheduled_for)}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <div className="relative group inline-block">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium cursor-default ${
                            isSent
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isFailed
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : isProcessing
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          }`}
                        >
                          {(isPending || isProcessing) && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isProcessing ? 'bg-blue-400' : 'bg-yellow-400'}`} />
                              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isProcessing ? 'bg-blue-400' : 'bg-yellow-400'}`} />
                            </span>
                          )}
                          {isProcessing ? 'processing' : msg.status}
                        </span>

                        {/* Error Tooltip on Hover */}
                        {isFailed && msg.error_message && (
                          <div className="pointer-events-none absolute left-0 bottom-full z-10 mb-2 w-48 rounded-lg bg-slate-950 p-2 text-[10px] text-rose-300 shadow-md border border-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-pre-wrap">
                            {msg.error_message}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Send Now */}
                        {(isPending || isFailed) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSendNow(msg.id)}
                            disabled={processingId === msg.id}
                            title="Send Immediately"
                            className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80"
                          >
                            {processingId === msg.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                            ) : (
                              <Play className="h-4 w-4 fill-current" />
                            )}
                          </Button>
                        )}

                        {/* Delete / Cancel */}
                        {(isPending || isFailed) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCancel(msg.id)}
                            title="Cancel & Delete"
                            className="h-8 w-8 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Schedule Dialog Modal */}
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSuccess={fetchScheduledMessages}
      />

      {/* CSV Import Dialog Modal */}
      <CSVImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        onSuccess={fetchScheduledMessages}
      />
    </div>
  );
}
