"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag, PipelineStage } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { DealForm } from "@/components/pipelines/deal-form";

interface ContactSidebarProps {
  contact: Contact | null;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Tags & deals management
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [dealFormOpen, setDealFormOpen] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, tags, and all available tags in parallel
    const [dealsRes, notesRes, tagsRes, allTagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
      supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true }),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (allTagsRes.data) setAllTags(allTagsRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: any) => ct.tags)
        .map((ct: any) => {
          const tagObj = Array.isArray(ct.tags) ? ct.tags[0] : ct.tags;
          return {
            ...(tagObj as Tag),
            contact_tag_id: ct.id as string,
          };
        });
      setTags(mapped);
    }
  }, [contact]);

  // Load on contact change
  useEffect(() => {
    fetchContactData();
  }, [fetchContactData]);

  // Load pipeline stages once on mount
  useEffect(() => {
    const loadPipeline = async () => {
      const supabase = createClient();
      const { data: pipelines } = await supabase
        .from("pipelines")
        .select("*")
        .order("created_at")
        .limit(1);

      if (pipelines && pipelines.length > 0) {
        const activePipelineId = pipelines[0].id;
        setPipelineId(activePipelineId);

        const { data: stages } = await supabase
          .from("pipeline_stages")
          .select("*")
          .eq("pipeline_id", activePipelineId)
          .order("position");

        if (stages) {
          setPipelineStages(stages);
        }
      }
    };
    loadPipeline();
  }, []);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote]);

  const handleToggleTag = useCallback(async (tagId: string) => {
    if (!contact) return;

    const supabase = createClient();
    const assignedTag = tags.find((t) => t.id === tagId);

    if (assignedTag) {
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contact.id)
        .eq("tag_id", tagId);

      if (!error) {
        setTags((prev) => prev.filter((t) => t.id !== tagId));
      }
    } else {
      const { data, error } = await supabase
        .from("contact_tags")
        .insert({
          contact_id: contact.id,
          tag_id: tagId,
        })
        .select("id, tag_id, tags(*)")
        .single();

      if (!error && data && data.tags) {
        const tagObj = Array.isArray(data.tags) ? data.tags[0] : data.tags;
        setTags((prev) => [
          ...prev,
          {
            ...(tagObj as Tag),
            contact_tag_id: data.id,
          },
        ]);
      }
    }
  }, [contact, tags]);

  const handleDealSaved = useCallback(() => {
    setDealFormOpen(false);
    fetchContactData();
  }, [fetchContactData]);

  if (!contact) {
    return (
      <div className="flex h-full w-70 items-center justify-center border-l border-slate-800 bg-slate-900">
        <p className="text-sm text-slate-500">Select a conversation</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-70 flex-col border-l border-slate-800 bg-slate-900">
      <ScrollArea className="flex-1">
        <div className="p-4 pb-12">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700 text-lg font-semibold text-white">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-slate-400">{contact.company}</p>
            )}
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <Phone className="h-4 w-4 text-slate-500" />
              <span className="flex-1 text-left">{contact.phone}</span>
              {copied ? (
                <Check className="h-3 w-3 text-violet-400" />
              ) : (
                <Copy className="h-3 w-3 text-slate-600" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-slate-800" />

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <div className="flex items-center gap-2">
                <TagIcon className="h-3 w-3" />
                Tags
              </div>
              <button
                onClick={() => setIsManagingTags(!isManagingTags)}
                className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold normal-case tracking-normal hover:underline cursor-pointer"
              >
                {isManagingTags ? "Done" : "Manage"}
              </button>
            </div>
            
            {isManagingTags ? (
              <div className="mt-2 rounded-lg bg-slate-800/50 p-2 space-y-2 border border-slate-800">
                <p className="text-[10px] text-slate-400 px-1">
                  Click a tag to assign/remove:
                </p>
                {allTags.length === 0 ? (
                  <p className="text-xs text-slate-500 px-1">
                    No tags available. Go to Settings to create tags.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 p-1">
                    {allTags.map((tag) => {
                      const isSelected = tags.some((t) => t.id === tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => handleToggleTag(tag.id)}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer",
                            isSelected
                              ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-slate-900"
                              : "opacity-45 hover:opacity-85"
                          )}
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {isSelected && "✓ "}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.length === 0 ? (
                  <p className="px-1 text-xs text-slate-600">No tags</p>
                ) : (
                  tags.map((tag) => (
                    <span
                      key={tag.contact_tag_id}
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-slate-800" />

          {/* Active Deals */}
          <div>
            <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <div className="flex items-center gap-2">
                <DollarSign className="h-3 w-3" />
                Active Deals
              </div>
              {pipelineId && pipelineStages.length > 0 && (
                <button
                  onClick={() => setDealFormOpen(true)}
                  className="text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
                  title="Create Deal"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-slate-600">No deals</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg bg-slate-800 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-white">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {pipelineId && pipelineStages.length > 0 && (
            <DealForm
              open={dealFormOpen}
              onOpenChange={setDealFormOpen}
              pipelineId={pipelineId}
              stages={pipelineStages}
              defaultContactId={contact.id}
              onSaved={handleDealSaved}
            />
          )}

          {/* Divider */}
          <div className="my-4 border-t border-slate-800" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <StickyNote className="h-3 w-3" />
              Notes
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-violet-600 px-2 hover:bg-violet-500"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-slate-800 px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-slate-300">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
