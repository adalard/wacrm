'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedRow {
  index: number;
  phone: string;
  scheduled_for: string;
  message_type: 'text' | 'template';
  content_text?: string;
  template_name?: string;
  params?: string[];
  isValid: boolean;
  error?: string;
}

export function CSVImportDialog({ open, onOpenChange, onSuccess }: CSVImportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear state when closed/opened
  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) {
      setParsedRows([]);
      setHeaders([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Basic CSV Parser that handles split by comma, respecting quotes
  const parseCSVLine = (text: string): string[] => {
    const result = [];
    let startValueIdx = 0;
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        let val = text.substring(startValueIdx, i).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        result.push(val);
        startValueIdx = i + 1;
      }
    }
    let lastVal = text.substring(startValueIdx).trim();
    if (lastVal.startsWith('"') && lastVal.endsWith('"')) {
      lastVal = lastVal.substring(1, lastVal.length - 1);
    }
    result.push(lastVal);
    return result;
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error('Failed to read the file.');
        return;
      }

      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
      if (lines.length < 2) {
        toast.error('The CSV must contain a header and at least one row.');
        return;
      }

      // Headers (case-insensitive mapping)
      const rawHeaders = parseCSVLine(lines[0]);
      setHeaders(rawHeaders);

      const headerMap: Record<string, number> = {};
      rawHeaders.forEach((h, idx) => {
        headerMap[h.toLowerCase().trim()] = idx;
      });

      // Match key columns
      const getColIdx = (aliases: string[]) => {
        for (const alias of aliases) {
          if (headerMap[alias] !== undefined) return headerMap[alias];
        }
        return -1;
      };

      const phoneCol = getColIdx(['phone', 'receiver_phone', 'number', 'to']);
      const timeCol = getColIdx(['scheduled_for', 'scheduled_at', 'time', 'datetime']);
      const typeCol = getColIdx(['message_type', 'type']);
      const contentCol = getColIdx(['content_text', 'message', 'content', 'text']);
      const templateCol = getColIdx(['template_name', 'template']);

      // Check required columns
      if (phoneCol === -1 || timeCol === -1 || typeCol === -1) {
        toast.error('CSV missing required headers: phone, scheduled_for, message_type.');
        return;
      }

      const rows: ParsedRow[] = [];
      const now = new Date();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = parseCSVLine(line);
        if (values.length === 0 || (values.length === 1 && !values[0])) continue;

        const phone = values[phoneCol] || '';
        const rawTime = values[timeCol] || '';
        const rawType = (values[typeCol] || '').toLowerCase().trim();
        const content_text = contentCol !== -1 ? values[contentCol] : '';
        const template_name = templateCol !== -1 ? values[templateCol] : '';

        // Extract parameters (param1, param2...)
        const params: string[] = [];
        rawHeaders.forEach((h, idx) => {
          if (h.toLowerCase().startsWith('param') || h.startsWith('{{')) {
            params.push(values[idx] || '');
          }
        });

        // Validation
        let isValid = true;
        let error = '';

        if (!phone) {
          isValid = false;
          error = 'Phone number is missing.';
        } else if (!rawTime) {
          isValid = false;
          error = 'Schedule time is missing.';
        } else {
          try {
            const dateVal = new Date(rawTime);
            if (isNaN(dateVal.getTime())) {
              isValid = false;
              error = 'Invalid date format.';
            } else if (dateVal <= now) {
              isValid = false;
              error = 'Schedule time must be in the future.';
            }
          } catch {
            isValid = false;
            error = 'Invalid date/time.';
          }
        }

        if (isValid) {
          if (rawType !== 'text' && rawType !== 'template') {
            isValid = false;
            error = "Type must be 'text' or 'template'.";
          } else if (rawType === 'text' && !content_text) {
            isValid = false;
            error = "Message content missing for 'text' type.";
          } else if (rawType === 'template' && !template_name) {
            isValid = false;
            error = "Template name missing for 'template' type.";
          }
        }

        rows.push({
          index: i,
          phone,
          scheduled_for: rawTime,
          message_type: rawType as 'text' | 'template',
          content_text: rawType === 'text' ? content_text : undefined,
          template_name: rawType === 'template' ? template_name : undefined,
          params: rawType === 'template' ? params : undefined,
          isValid,
          error,
        });
      }

      setParsedRows(rows);
      if (rows.filter((r) => !r.isValid).length > 0) {
        toast.warning('Some rows have validation errors. Please review.');
      } else {
        toast.success(`Successfully parsed ${rows.length} rows.`);
      }
    };
    reader.readAsText(file);
  };

  async function handleImport() {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid rows to schedule.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: validRows.map((r) => ({
            receiver_phone: r.phone,
            message_type: r.message_type,
            content_text: r.content_text,
            template_name: r.template_name,
            template_language: 'en_US',
            template_params: r.params,
            scheduled_for: new Date(r.scheduled_for).toISOString(),
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import scheduled messages');
      }

      toast.success(`Bulk-scheduled ${validRows.length} messages successfully.`);
      onSuccess();
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during import.');
    } finally {
      setLoading(false);
    }
  }

  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-900 text-slate-100 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-white">Import CSV to Schedule Messages</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {/* Instructions */}
          <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <p className="font-semibold text-white">CSV Guidelines & Template:</p>
            <p>Your CSV file should have a header row and include these exact columns:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li><strong className="text-slate-300">phone:</strong> Recipient phone (e.g. +1234567890)</li>
              <li><strong className="text-slate-300">scheduled_for:</strong> Date and time (e.g. YYYY-MM-DD HH:MM in future)</li>
              <li><strong className="text-slate-300">message_type:</strong> Must be either <code className="text-violet-400 font-mono">text</code> or <code className="text-violet-400 font-mono">template</code></li>
              <li><strong className="text-slate-300">content_text:</strong> Message body (required for text messages)</li>
              <li><strong className="text-slate-300">template_name:</strong> WhatsApp template name (required for templates)</li>
              <li><strong className="text-slate-300">param1, param2...:</strong> (Optional) Variable values in template</li>
            </ul>
            <div className="bg-slate-900 p-2 rounded mt-2 border border-slate-800 font-mono text-[10px] whitespace-pre overflow-x-auto text-slate-300">
{`phone,scheduled_for,message_type,content_text,template_name,param1
+1234567890,2026-06-01 10:00,text,Hello from CSV!,,
+1987654321,2026-06-02 15:30,template,,welcome_message,John`}
            </div>
          </div>

          {/* File Upload Drag & Drop Area */}
          {parsedRows.length === 0 ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                dragActive
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-slate-700 bg-slate-950 hover:border-slate-500 hover:bg-slate-900/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="h-10 w-10 text-slate-500 mb-3" />
              <p className="text-sm font-semibold text-white text-center">Drag and drop your CSV file here</p>
              <p className="text-xs text-slate-500 text-center mt-1">or click to browse from files</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Parse Status Snippet */}
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-violet-400" />
                  <div>
                    <p className="text-sm font-medium text-white">Parsed File Contents</p>
                    <p className="text-xs text-slate-500">{parsedRows.length} total rows parsed</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {validCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>{validCount} ready</span>
                    </div>
                  )}
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{invalidCount} invalid</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable Preview Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 max-h-[220px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold">
                      <th className="p-2 border-r border-slate-800 text-center w-10">Row</th>
                      <th className="p-2 border-r border-slate-800">Phone</th>
                      <th className="p-2 border-r border-slate-800">Scheduled Time</th>
                      <th className="p-2 border-r border-slate-800">Type</th>
                      <th className="p-2 border-r border-slate-800">Content / Template</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row) => (
                      <tr
                        key={row.index}
                        className={`border-b border-slate-850 hover:bg-slate-900/50 ${
                          !row.isValid ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="p-2 border-r border-slate-800 text-slate-500 text-center">{row.index}</td>
                        <td className="p-2 border-r border-slate-800 font-medium text-white">{row.phone}</td>
                        <td className="p-2 border-r border-slate-800 text-slate-300">{row.scheduled_for}</td>
                        <td className="p-2 border-r border-slate-800 text-slate-400 capitalize">{row.message_type}</td>
                        <td className="p-2 border-r border-slate-800 text-slate-300 truncate max-w-[150px]">
                          {row.message_type === 'text' ? row.content_text : row.template_name}
                        </td>
                        <td className={`p-2 text-xs ${row.isValid ? 'text-emerald-400 font-medium' : 'text-amber-400'}`}>
                          {row.isValid ? 'Valid' : row.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setParsedRows([]);
                    setHeaders([]);
                  }}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white flex-1"
                >
                  Clear & Choose Another File
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={loading || parsedRows.length === 0 || validCount === 0}
            className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling Bulk Messages...
              </>
            ) : (
              `Schedule ${validCount} Messages`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
