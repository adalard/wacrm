'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, User, Mail, Phone, Trash2, Edit2, Shield, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface AssigneeTeammate {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'sales_rep' | 'support_agent' | 'manager';
  created_at: string;
  invite_token: string | null;
  invite_status: 'invited' | 'active' | null;
}

const ROLE_LABELS = {
  sales_rep: 'Sales Representative',
  support_agent: 'Support Agent',
  manager: 'Workspace Manager',
};

export function TeammatesManager() {
  const supabase = createClient();
  const { user, loading: authLoading, workspaceOwnerId, userRole } = useAuth();

  const [loading, setLoading] = useState(true);
  const [teammates, setTeammates] = useState<AssigneeTeammate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create / Edit modal states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeammate, setEditingTeammate] = useState<AssigneeTeammate | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'sales_rep' | 'support_agent' | 'manager'>('sales_rep');

  // Delete modal states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teammateToDelete, setTeammateToDelete] = useState<AssigneeTeammate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchTeammates(workspaceOwnerId || user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, workspaceOwnerId]);

  async function fetchTeammates(targetUserId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assignees')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTeammates(data || []);
    } catch (err) {
      console.error('[teammates] Fetch error:', err);
      toast.error('Failed to load teammates list');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingTeammate(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole('sales_rep');
    setDialogOpen(true);
  }

  function handleOpenEdit(teammate: AssigneeTeammate) {
    setEditingTeammate(teammate);
    setName(teammate.name);
    setEmail(teammate.email || '');
    setPhone(teammate.phone || '');
    setRole(teammate.role);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Teammate name is required');
      return;
    }

    try {
      setSaving(true);
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const activeOwnerId = workspaceOwnerId || user.id;
      const payload: any = {
        user_id: activeOwnerId,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        role,
        updated_at: new Date().toISOString(),
      };

      if (editingTeammate) {
        // Update operation
        if (email.trim() && editingTeammate.email !== email.trim()) {
          payload.invite_status = 'invited';
        }
        
        const { error } = await supabase
          .from('assignees')
          .update(payload)
          .eq('id', editingTeammate.id);

        if (error) throw error;
        toast.success(`Teammate "${name.trim()}" successfully updated!`);
      } else {
        // Insert operation
        payload.invite_status = email.trim() ? 'invited' : 'active';
        
        const { error } = await supabase
          .from('assignees')
          .insert(payload);

        if (error) throw error;
        toast.success(`Teammate "${name.trim()}" successfully added!`);
      }

      setDialogOpen(false);
      await fetchTeammates(activeOwnerId);
    } catch (err) {
      console.error('[teammates] Save error:', err);
      toast.error('Failed to save teammate details');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(teammate: AssigneeTeammate) {
    setTeammateToDelete(teammate);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!teammateToDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('assignees')
        .delete()
        .eq('id', teammateToDelete.id);

      if (error) throw error;

      toast.success('Teammate successfully removed');
      setTeammates((prev) => prev.filter((t) => t.id !== teammateToDelete.id));
      setDeleteDialogOpen(false);
      setTeammateToDelete(null);
    } catch (err) {
      console.error('[teammates] Delete error:', err);
      toast.error('Failed to remove teammate');
    } finally {
      setDeleting(false);
    }
  }

  const filteredTeammates = teammates.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      (t.phone && t.phone.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Title section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Teammates & Assignees</h2>
          <p className="text-sm text-slate-400">
            Define Sales Representatives and Support Agents to assign conversations and deals to.
          </p>
        </div>
        {(userRole === 'owner' || userRole === 'manager') && (
          <Button
            onClick={handleOpenCreate}
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold self-start"
          >
            <Plus className="size-4 mr-1.5" />
            Add Teammate
          </Button>
        )}
      </div>

      {/* Searchbar */}
      {teammates.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input
            placeholder="Search name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-950 border-slate-800 text-white text-xs placeholder:text-slate-600"
          />
        </div>
      )}

      {/* Teammates List */}
      {teammates.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="bg-slate-800 p-3 rounded-full text-slate-500 shadow-md">
              <User className="size-8" />
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 text-sm font-semibold">No teammates added yet.</p>
              <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
                Add workspace assignees like account reps or helpdesk agents to delegate deals and inbox conversations.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-slate-800 bg-slate-950/20">
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Name</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Role</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Email</TableHead>
                  <TableHead className="text-slate-400 font-semibold px-6 py-4">Status & Invite</TableHead>
                  {(userRole === 'owner' || userRole === 'manager') && (
                    <TableHead className="text-slate-400 font-semibold px-6 py-4 text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeammates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={userRole === 'owner' || userRole === 'manager' ? 5 : 4} className="text-center py-8 text-slate-500 text-xs font-medium">
                      No matching teammates found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeammates.map((teammate) => (
                    <TableRow key={teammate.id} className="border-slate-800/80 hover:bg-slate-800/20 transition-colors">
                      <TableCell className="px-6 py-4">
                        <span className="text-white font-bold block text-sm">{teammate.name}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className={`px-2 py-0.5 text-[10px] ${
                          teammate.role === 'manager'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : teammate.role === 'support_agent'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                              : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                        }`}>
                          {ROLE_LABELS[teammate.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {teammate.email ? (
                          <span className="text-slate-350 text-xs font-medium font-mono flex items-center gap-1.5">
                            <Mail className="size-3.5 text-slate-500" />
                            {teammate.email}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {teammate.email ? (
                          <div className="flex items-center gap-2">
                            {teammate.invite_status === 'active' ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-2 py-0.5 text-[10px]">
                                Active Member
                              </Badge>
                            ) : (
                              <>
                                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-2 py-0.5 text-[10px] animate-pulse">
                                  Pending Invite
                                </Badge>
                                {(userRole === 'owner' || userRole === 'manager') && teammate.invite_token && (
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      if (typeof window !== 'undefined') {
                                        const link = `${window.location.origin}/signup?invite=${teammate.invite_token}`;
                                        navigator.clipboard.writeText(link);
                                        toast.success('Copied invitation link!');
                                      }
                                    }}
                                    className="h-6 border-slate-800 bg-slate-950 text-[10px] text-slate-300 hover:text-white px-2"
                                  >
                                    Copy Link
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <Badge className="bg-slate-800 text-slate-400 border-slate-700 px-2 py-0.5 text-[10px]">
                            Virtual Assignee
                          </Badge>
                        )}
                      </TableCell>
                      {(userRole === 'owner' || userRole === 'manager') && (
                        <TableCell className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              onClick={() => handleOpenEdit(teammate)}
                              className="text-slate-400 hover:text-white p-2 h-auto text-xs"
                            >
                              <Edit2 className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => confirmDelete(teammate)}
                              className="text-red-400 hover:text-red-300 p-2 h-auto text-xs"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="size-5 text-violet-400" />
              {editingTeammate ? 'Edit Teammate Settings' : 'Add New Teammate'}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Fill in teammate parameters. They will appear inside deal assignment menus and message assign lists.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs uppercase font-bold">Teammate Name</Label>
              <Input
                placeholder="e.g. Sarah Jenkins"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-700"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs uppercase font-bold">Role Title</Label>
              <select
                value={role}
                onChange={(e: any) => setRole(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="sales_rep">Sales Representative</option>
                <option value="support_agent">Support Agent</option>
                <option value="manager">Workspace Manager</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs uppercase font-bold">Email Address</Label>
              <Input
                placeholder="e.g. sarah@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-700 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs uppercase font-bold">Phone Number</Label>
              <Input
                placeholder="e.g. +1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-700 font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="bg-slate-900/50 border-slate-800">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-800 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                editingTeammate ? 'Save Changes' : 'Add Teammate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-slate-900 border-slate-700 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-1.5">
              Remove Teammate
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs leading-normal">
              Are you sure you want to remove **{teammateToDelete?.name}**? This will unassign any active conversations or deals assigned to them.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="bg-slate-900/50 border-slate-800 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-slate-800 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-650 hover:bg-red-750 text-white font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                  Removing...
                </>
              ) : (
                'Remove Teammate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
