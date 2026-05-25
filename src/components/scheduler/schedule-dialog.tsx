'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate, Contact } from '@/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ScheduleDialog({ open, onOpenChange, onSuccess }: ScheduleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Form State
  const [phone, setPhone] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [messageType, setMessageType] = useState<'text' | 'template'>('text');
  const [contentText, setContentText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});

  // Fetch templates and contacts
  useEffect(() => {
    if (!open) return;

    async function fetchConfig() {
      setLoadingConfig(true);
      try {
        const supabase = createClient();
        const [contactsRes, templatesRes] = await Promise.all([
          supabase.from('contacts').select('*').order('name'),
          supabase
            .from('message_templates')
            .select('*')
            .eq('status', 'Approved')
            .order('name'),
        ]);

        setContacts(contactsRes.data ?? []);
        setTemplates(templatesRes.data ?? []);
      } catch (err) {
        console.error('Failed to load scheduler config:', err);
        toast.error('Failed to load contacts or templates.');
      } finally {
        setLoadingConfig(false);
      }
    }

    fetchConfig();
  }, [open]);

  // Parse placeholders e.g., {{1}}, {{2}} from template body
  const placeholders = useMemo(() => {
    if (!selectedTemplate) return [];
    const matches = selectedTemplate.body_text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches)].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''));
      const numB = parseInt(b.replace(/\D/g, ''));
      return numA - numB;
    });
  }, [selectedTemplate]);

  // Clean form state when opened/closed
  useEffect(() => {
    if (open) {
      setPhone('');
      setScheduledFor('');
      setMessageType('text');
      setContentText('');
      setSelectedTemplate(null);
      setTemplateParams({});
    }
  }, [open]);

  // Auto-fill template params map when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const initial: Record<string, string> = {};
      placeholders.forEach((p) => {
        const key = p.replace(/^\{\{|\}\}$/g, '');
        initial[key] = '';
      });
      setTemplateParams(initial);
    } else {
      setTemplateParams({});
    }
  }, [selectedTemplate, placeholders]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Receiver phone number is required.');
      return;
    }
    if (!scheduledFor) {
      toast.error('Scheduled date and time are required.');
      return;
    }

    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      toast.error('Scheduled time must be in the future.');
      return;
    }

    if (messageType === 'text' && !contentText.trim()) {
      toast.error('Message text is required.');
      return;
    }

    if (messageType === 'template' && !selectedTemplate) {
      toast.error('Please select a template.');
      return;
    }

    // Check that all placeholders have values
    if (messageType === 'template' && selectedTemplate) {
      for (const p of placeholders) {
        const key = p.replace(/^\{\{|\}\}$/g, '');
        if (!templateParams[key]?.trim()) {
          toast.error(`Please fill out parameter value for ${p}`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const paramsArray = placeholders.map((p) => {
        const key = p.replace(/^\{\{|\}\}$/g, '');
        return templateParams[key] || '';
      });

      const response = await fetch('/api/whatsapp/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              receiver_phone: phone.trim(),
              message_type: messageType,
              content_text: messageType === 'text' ? contentText : null,
              template_name: messageType === 'template' ? selectedTemplate?.name : null,
              template_language: messageType === 'template' ? (selectedTemplate?.language || 'en_US') : null,
              template_params: messageType === 'template' ? paramsArray : null,
              scheduled_for: scheduledDate.toISOString(),
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to schedule message');
      }

      toast.success('Message scheduled successfully');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  // Handle contact selection auto-fill
  function handleSelectContact(val: string | null) {
    if (!val || val === 'custom') return;
    const selected = contacts.find((c) => c.id === val);
    if (selected) {
      setPhone(selected.phone);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-900 text-slate-100 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-white">Schedule WhatsApp Message</DialogTitle>
        </DialogHeader>

        {loadingConfig ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Quick Contact Selection */}
            {contacts.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="contact-select" className="text-slate-300">
                  Select Contact (Optional)
                </Label>
                <Select onValueChange={handleSelectContact}>
                  <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                    <SelectValue placeholder="Search or select a contact..." />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-800 text-slate-100">
                    <SelectItem value="custom" className="text-slate-400">
                      -- Manual Input / Custom Number --
                    </SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name || contact.phone} ({contact.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Receiver Phone Number */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-slate-300">
                Receiver Phone Number (E.164 format)
              </Label>
              <Input
                id="phone"
                type="text"
                placeholder="e.g. +1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Scheduled For (Date/Time) */}
            <div className="space-y-1.5">
              <Label htmlFor="scheduledFor" className="text-slate-300">
                Schedule Date & Time
              </Label>
              <Input
                id="scheduledFor"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white focus:ring-violet-500"
              />
            </div>

            {/* Message Type */}
            <div className="space-y-1.5">
              <Label className="text-slate-300">Message Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="radio"
                    name="messageType"
                    checked={messageType === 'text'}
                    onChange={() => setMessageType('text')}
                    className="accent-violet-500 h-4 w-4"
                  />
                  Plain Text Message
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="radio"
                    name="messageType"
                    checked={messageType === 'template'}
                    onChange={() => setMessageType('template')}
                    className="accent-violet-500 h-4 w-4"
                  />
                  Approved Template
                </label>
              </div>
            </div>

            {/* Render based on Message Type */}
            {messageType === 'text' ? (
              <div className="space-y-1.5">
                <Label htmlFor="contentText" className="text-slate-300">
                  Message Content
                </Label>
                <Textarea
                  id="contentText"
                  placeholder="Type your message here..."
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  required
                  rows={4}
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:ring-violet-500"
                />
              </div>
            ) : (
              <div className="space-y-4 border-t border-slate-800 pt-3">
                {/* Template Selection */}
                <div className="space-y-1.5">
                  <Label htmlFor="template" className="text-slate-300">
                    Select Template
                  </Label>
                  <Select
                    onValueChange={(val) => {
                      const t = templates.find((x) => x.id === val) || null;
                      setSelectedTemplate(t);
                    }}
                  >
                    <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                      <SelectValue placeholder="Choose an approved template..." />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-800 text-slate-100">
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Template Body Preview */}
                {selectedTemplate && (
                  <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                    <p className="text-xs font-semibold text-violet-400 mb-1">Body Preview:</p>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{selectedTemplate.body_text}</p>
                  </div>
                )}

                {/* Placeholders Mapping Inputs */}
                {selectedTemplate && placeholders.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Template Variables</p>
                    {placeholders.map((p) => {
                      const key = p.replace(/^\{\{|\}\}$/g, '');
                      return (
                        <div key={p} className="space-y-1.5">
                          <Label htmlFor={`param-${key}`} className="text-xs text-slate-300 font-mono">
                            {p} value
                          </Label>
                          <Input
                            id={`param-${key}`}
                            type="text"
                            placeholder={`Value for ${p}...`}
                            value={templateParams[key] || ''}
                            onChange={(e) =>
                              setTemplateParams({ ...templateParams, [key]: e.target.value })
                            }
                            required
                            className="border-slate-700 bg-slate-800 text-white text-xs placeholder:text-slate-500 focus:ring-violet-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  'Schedule Message'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
