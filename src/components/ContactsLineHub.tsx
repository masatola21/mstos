import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Users,
  UserRound,
  Wifi,
  WifiOff,
  Pencil,
  MessageCircle,
  Mail,
  Trash2,
  Zap,
  BookOpen,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { Contact, TableKey } from '../types/database';
import { fetchTableData, deleteTableRecord } from '../services/dataService';
import { getSupabase } from '../lib/supabaseClient';
import { RecordFormModal } from './RecordFormModal';
import { InlineDeleteButton } from './InlineDeleteButton';
import { UNIFIED_TAG_MASTER, TAG_CATEGORIES, MasterTag } from '../constants/tagMaster';

export interface LineTag {
  id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  category?: 'inflow' | 'action' | 'crm_status' | 'special' | 'custom';
  categoryLabel?: string;
  isExitConditionDefault?: boolean;
}

export interface FriendTagWithMeta extends LineTag {
  assigned_by?: 'automation' | 'operator' | 'welcome_choice' | string;
}

interface LineFriend {
  id: string;
  contact_id?: string | null;
  line_user_id: string;
  display_name?: string | null;
  status: 'active' | 'blocked' | 'unfollowed' | 'unknown';
  consent_status: string;
  last_message_at?: string | null;
  followed_at?: string | null;
  tags: FriendTagWithMeta[];
}

interface PersonRow {
  id: string;
  contact?: Contact;
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  lineFriends: LineFriend[];
}

type FilterMode = 'all' | 'line' | 'no-line';

interface Props {
  initialFilter?: FilterMode;
  onOpenLineInbox?: (contactId: string, lineUserId: string) => void;
  onOpenEmailSend?: (contactId: string, companyId?: string) => void;
}

const statusLabel: Record<string, string> = {
  active: '友だち',
  blocked: 'ブロック',
  unfollowed: '解除',
  unknown: '未確認',
};

export const ContactsLineHub: React.FC<Props> = ({
  initialFilter = 'all',
  onOpenLineInbox,
  onOpenEmailSend,
}) => {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [tags, setTags] = useState<LineTag[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>(initialFilter);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [tagCategoryFilter, setTagCategoryFilter] = useState<string>('all');
  const [newTagName, setNewTagName] = useState('');
  const [topNewTagName, setTopNewTagName] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState<string>('all');
  const [pickerCustomTagName, setPickerCustomTagName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTagPickerFriendId, setActiveTagPickerFriendId] = useState<string | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
    }
  }, [initialFilter]);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabaseに接続できません。接続設定を確認してください。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [contactResult, friendResult, tagResult, assignmentResult] = await Promise.all([
        fetchTableData('contacts'),
        supabase.from('line_friends').select('*').order('updated_at', { ascending: false }),
        supabase.from('contact_tags').select('*').order('name', { ascending: true }),
        supabase.from('line_friend_tags').select('line_friend_id, tag_id, assigned_by'),
      ]);

      if (contactResult.error) throw new Error(contactResult.error.message);
      const queryError = friendResult.error || tagResult.error || assignmentResult.error;
      if (queryError) throw new Error(queryError.message || '連絡先・LINE情報を読み込めませんでした。');

      const rawTags = (tagResult.data || []) as { id: string; name: string; color?: string | null; description?: string | null }[];
      const masterMap = new Map(UNIFIED_TAG_MASTER.map((m) => [m.name.toLowerCase(), m]));

      const tagList: LineTag[] = rawTags.map((t) => {
        const master = masterMap.get(t.name.toLowerCase());
        return {
          id: t.id,
          name: t.name,
          color: t.color || master?.color || '#3b82f6',
          description: t.description || master?.description || '',
          category: master?.category || 'custom',
          categoryLabel: master?.categoryLabel || '独自タグ',
          isExitConditionDefault: master?.isExitConditionDefault,
        };
      });

      const tagById = new Map(tagList.map((tag) => [tag.id, tag]));
      const tagsByFriend = new Map<string, FriendTagWithMeta[]>();
      (assignmentResult.data || []).forEach((assignment: any) => {
        const tag = tagById.get(assignment.tag_id);
        if (tag) {
          tagsByFriend.set(assignment.line_friend_id, [
            ...(tagsByFriend.get(assignment.line_friend_id) || []),
            { ...tag, assigned_by: assignment.assigned_by || 'operator' },
          ]);
        }
      });

      const contacts = (contactResult.data || []) as Contact[];
      const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
      const contactByLineId = new Map(
        contacts
          .filter((contact) => contact.line_user_id)
          .map((contact) => [contact.line_user_id as string, contact])
      );
      const friends = ((friendResult.data || []) as Omit<LineFriend, 'tags'>[]).map((friend) => ({
        ...friend,
        tags: tagsByFriend.get(friend.id) || [],
      }));
      const friendsByContact = new Map<string, LineFriend[]>();
      const unlinkedFriends: LineFriend[] = [];

      friends.forEach((friend) => {
        const linkedContact =
          (friend.contact_id ? contactById.get(friend.contact_id) : undefined) ||
          contactByLineId.get(friend.line_user_id);
        if (!linkedContact) {
          unlinkedFriends.push(friend);
          return;
        }
        friendsByContact.set(linkedContact.id, [
          ...(friendsByContact.get(linkedContact.id) || []),
          friend,
        ]);
      });

      const contactPeople: PersonRow[] = contacts.map((contact) => ({
        id: contact.id,
        contact,
        name: contact.full_name || '名前未登録',
        email: contact.email,
        phone: contact.phone,
        companyName: contact.company?.company_name || null,
        lineFriends: friendsByContact.get(contact.id) || [],
      }));
      const lineOnlyPeople: PersonRow[] = unlinkedFriends.map((friend) => ({
        id: 'line-' + friend.id,
        name: friend.display_name || 'LINE友だち（連絡先未紐付け）',
        lineFriends: [friend],
      }));

      setPeople([...contactPeople, ...lineOnlyPeople]);
      setTags(tagList);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : '連絡先・LINE情報を読み込めませんでした。'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    people.forEach((p) => {
      const friendTags = new Set(p.lineFriends.flatMap((f) => f.tags.map((t) => t.id)));
      friendTags.forEach((tagId) => {
        counts.set(tagId, (counts.get(tagId) || 0) + 1);
      });
    });
    return counts;
  }, [people]);

  // Sync missing Master Tags into DB contact_tags table
  const syncMasterTags = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const existingNames = new Set(tags.map((t) => t.name.toLowerCase()));
      const missingMasterTags = UNIFIED_TAG_MASTER.filter(
        (m) => !existingNames.has(m.name.toLowerCase())
      );
      if (!missingMasterTags.length) {
        setNotice('共通タグ辞書（全16種）はすべて登録済みです。');
        return;
      }
      const inserts = missingMasterTags.map((m) => ({
        name: m.name,
        color: m.color,
        description: m.description,
      }));
      const { error: insertErr } = await supabase.from('contact_tags').insert(inserts);
      if (insertErr) throw insertErr;
      setNotice(`共通タグ辞書から ${missingMasterTags.length} 件のタグをCRMに同期しました。`);
      await load();
    } catch (err: any) {
      setError('タグ辞書同期エラー: ' + (err.message || '同期に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  const visiblePeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return people.filter((person) => {
      if (filter === 'line' && !person.lineFriends.length) return false;
      if (filter === 'no-line' && person.lineFriends.length) return false;
      if (selectedTagFilter) {
        const hasSelectedTag = person.lineFriends.some((f) =>
          f.tags.some((t) => t.id === selectedTagFilter)
        );
        if (!hasSelectedTag) return false;
      }
      if (!query) return true;
      const values = [
        person.name,
        person.email,
        person.phone,
        person.companyName,
        ...person.lineFriends.flatMap((friend) => [
          friend.line_user_id,
          friend.display_name,
          ...friend.tags.map((tag) => tag.name),
        ]),
      ];
      return values.some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [people, search, filter, selectedTagFilter]);

  const togglePerson = (id: string) =>
    setSelectedPeople((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  const toggleTag = (id: string) =>
    setSelectedTags((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  const createTagDirect = async (name: string, color?: string, description?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { error: insertError } = await supabase.from('contact_tags').insert({
        name: trimmed,
        color: color || '#3b82f6',
        description: description || '',
      });
      if (insertError) {
        throw new Error(
          insertError.message.includes('duplicate')
            ? `タグ「${trimmed}」は既に存在します。`
            : insertError.message
        );
      }
      setNotice(`タグ「${trimmed}」を作成しました。`);
      await load();
    } catch (err: any) {
      setError(err.message || 'タグ作成に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const createTag = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTagName.trim()) return;
    await createTagDirect(newTagName);
    setNewTagName('');
  };

  const handleCreateTagTop = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!topNewTagName.trim()) return;
    await createTagDirect(topNewTagName);
    setTopNewTagName('');
  };

  const toggleTagOnFriend = async (
    friendId: string,
    tagId: string,
    currentHasTag: boolean,
    assignedBy: string = 'operator'
  ) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (currentHasTag) {
        const { error: delErr } = await supabase
          .from('line_friend_tags')
          .delete()
          .eq('line_friend_id', friendId)
          .eq('tag_id', tagId);
        if (delErr) throw delErr;
        setNotice('タグを解除しました。');
      } else {
        const { error: insErr } = await supabase.from('line_friend_tags').upsert(
          { line_friend_id: friendId, tag_id: tagId, assigned_by: assignedBy },
          { onConflict: 'line_friend_id,tag_id' }
        );
        if (insErr) throw insErr;
        setNotice('タグを手動付与しました。');
      }
      await load();
    } catch (err: any) {
      setError('タグ操作エラー: ' + (err.message || '処理に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  const assignOrToggleMasterTagToFriend = async (friendId: string, master: MasterTag) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      // Find or create in contact_tags
      let targetTag = tags.find((t) => t.name.toLowerCase() === master.name.toLowerCase());
      if (!targetTag) {
        const { data: createdTag, error: tagErr } = await supabase
          .from('contact_tags')
          .insert({
            name: master.name,
            color: master.color,
            description: master.description,
          })
          .select('id, name, color, description')
          .single();
        if (tagErr) throw tagErr;
        targetTag = {
          id: createdTag.id,
          name: createdTag.name,
          color: createdTag.color,
          description: createdTag.description,
          category: master.category,
          categoryLabel: master.categoryLabel,
          isExitConditionDefault: master.isExitConditionDefault,
        };
      }

      if (!targetTag) throw new Error('タグの取得に失敗しました。');

      // Check if friend already has this tag
      const friend = people.flatMap((p) => p.lineFriends).find((f) => f.id === friendId);
      const hasTag = friend?.tags.some((t) => t.id === targetTag.id) || false;

      await toggleTagOnFriend(friendId, targetTag.id, hasTag, 'operator');
    } catch (err: any) {
      setError('タグ操作エラー: ' + (err.message || '処理に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  const deleteTag = async (tagId: string, tagName: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await supabase.from('line_friend_tags').delete().eq('tag_id', tagId);
      const { error: delErr } = await supabase.from('contact_tags').delete().eq('id', tagId);
      if (delErr) throw delErr;
      setNotice(`タグ「${tagName}」を完全に削除しました。`);
      if (selectedTagFilter === tagId) setSelectedTagFilter(null);
      setSelectedTags((prev) => prev.filter((id) => id !== tagId));
      setDeletingTagId(null);
      await load();
    } catch (err: any) {
      setError('タグ削除エラー: ' + (err.message || '削除に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  const assignSelectedTags = async () => {
    const selectedFriends = people
      .filter((person) => selectedPeople.includes(person.id))
      .flatMap((person) => person.lineFriends);
    if (!selectedFriends.length || !selectedTags.length) {
      setNotice('LINE友だちがいる連絡先とタグを選択してください。');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    const rows = selectedFriends.flatMap((friend) =>
      selectedTags.map((tagId) => ({
        line_friend_id: friend.id,
        tag_id: tagId,
        assigned_by: 'operator',
      }))
    );
    const { error: assignError } = await supabase
      .from('line_friend_tags')
      .upsert(rows, { onConflict: 'line_friend_id,tag_id', ignoreDuplicates: true });
    if (assignError) {
      setError(assignError.message);
    } else {
      setNotice(selectedFriends.length + '件のLINE友だちにタグを手動付与しました。');
      setSelectedPeople([]);
      setSelectedTags([]);
      await load();
    }
    setSaving(false);
  };

  const removeTag = async (friendId: string, tagId: string) => {
    await toggleTagOnFriend(friendId, tagId, true);
  };

  const changeEmailConsent = async (
    contact: Contact,
    status: 'unknown' | 'opted_in' | 'opted_out'
  ) => {
    const currentStatus = String(contact.email_consent_status || 'unknown');
    if (currentStatus === status) return;
    const statusLabels = { unknown: '未確認', opted_in: '配信可', opted_out: '配信停止' };
    const supabase = getSupabase();
    if (!supabase) return;
    const optedOutAt = status === 'opted_out' ? new Date().toISOString() : null;
    const optedOutReason = status === 'opted_out' ? '手動で停止' : null;
    setSaving(true);
    setError('');
    setNotice('');
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        email_consent_status: status,
        email_opted_out_at: optedOutAt,
        email_opt_out_reason: optedOutReason,
      })
      .eq('id', contact.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setPeople((current) =>
        current.map((person) =>
          person.contact?.id === contact.id
            ? {
                ...person,
                contact: {
                  ...person.contact,
                  email_consent_status: status,
                  email_opted_out_at: optedOutAt,
                  email_opt_out_reason: optedOutReason,
                },
              }
            : person
        )
      );
      setNotice(`メール状態を「${statusLabels[status]}」に変更しました。`);
    }
    setSaving(false);
  };

  const deletePerson = async (person: PersonRow) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      for (const friend of person.lineFriends) {
        await supabase.from('line_friend_tags').delete().eq('line_friend_id', friend.id);
        await supabase.from('line_friends').delete().eq('id', friend.id);
      }
      if (person.contact) {
        const res = await deleteTableRecord('contacts', person.contact, { force: true });
        if (res.error) {
          const { error: directErr } = await supabase
            .from('contacts')
            .delete()
            .eq('id', person.contact.id);
          if (directErr) {
            throw new Error(
              `連絡先「${person.name}」の削除に失敗しました: ${res.error.message || directErr.message}`
            );
          }
        }
      }
      setNotice(`「${person.name}」を削除しました。`);
      setSelectedPeople((prev) => prev.filter((id) => id !== person.id));
      await load();
    } catch (err: any) {
      setError(err.message || '削除中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const bulkDeleteSelected = async () => {
    const targets = people.filter((p) => selectedPeople.includes(p.id));
    if (!targets.length) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      for (const person of targets) {
        await deletePerson(person);
      }
      setSelectedPeople([]);
      setNotice(`${targets.length} 件のデータを削除しました。`);
      await load();
    } catch (err: any) {
      setError('一括削除エラー: ' + (err.message || '処理に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  // Filter tags by category for filter pills
  const filteredTags = useMemo(() => {
    if (tagCategoryFilter === 'all') return tags;
    if (tagCategoryFilter === 'custom') return tags.filter((t) => t.category === 'custom');
    return tags.filter((t) => t.category === tagCategoryFilter);
  }, [tags, tagCategoryFilter]);

  // Combined master + custom tags for friend inline picker
  const pickerMasterItems = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    const existingMap = new Map(tags.map((t) => [t.name.toLowerCase(), t]));

    const items: Array<{
      id: string;
      name: string;
      category: string;
      categoryLabel: string;
      color: string;
      description: string;
      isDbRegistered: boolean;
      dbId?: string;
    }> = [];

    // Master tags
    UNIFIED_TAG_MASTER.forEach((m) => {
      const dbTag = existingMap.get(m.name.toLowerCase());
      items.push({
        id: dbTag?.id || m.id,
        name: m.name,
        category: m.category,
        categoryLabel: m.categoryLabel,
        color: m.color,
        description: m.description,
        isDbRegistered: Boolean(dbTag),
        dbId: dbTag?.id,
      });
    });

    // Custom tags that are not in UNIFIED_TAG_MASTER
    tags.forEach((t) => {
      if (t.category === 'custom') {
        items.push({
          id: t.id,
          name: t.name,
          category: 'custom',
          categoryLabel: '独自タグ',
          color: t.color || '#64748b',
          description: t.description || '',
          isDbRegistered: true,
          dbId: t.id,
        });
      }
    });

    return items.filter((item) => {
      if (pickerCategory !== 'all' && item.category !== pickerCategory) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
      );
    });
  }, [tags, pickerSearch, pickerCategory]);

  return (
    <div className="space-y-6">
      {/* 告知・エラーバナー */}
      {error && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/60 p-3 text-xs text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-200">
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-blue-800 bg-blue-950/60 p-3 text-xs text-blue-200 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-blue-400 hover:text-blue-200">
            ×
          </button>
        </div>
      )}

      {/* ヘッダー */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">連絡先・LINE友だち台帳（タグ管理）</h1>
            <span className="rounded-full bg-blue-900/40 border border-blue-700/60 px-2.5 py-0.5 text-[10px] font-bold text-blue-300">
              配信共通タグ辞書 連携中
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            CRM連絡先とLINE公式アカウントの友だち情報を一元統合管理します。配信シナリオでの自動付与（⚡自動）と、スタッフによる商談進捗の手動付与（👤手動）が同一のタグ辞書で完全連動します。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void syncMasterTags()}
            disabled={saving}
            title="マーケティング配信シナリオで使われている共通タグ辞書（全16種）をCRMタグ台帳に一括同期します"
            className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-900/50 transition cursor-pointer disabled:opacity-40"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>辞書タグ全同期 ({tags.length}/16)</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>連絡先を追加</span>
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer disabled:opacity-50"
            title="再読み込み"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* 💡 配信・友だちタグ連携の解説カード（ユーザーの疑問を解消） */}
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-blue-950/30 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2 border border-blue-500/20 text-blue-400 shrink-0 mt-0.5">
            <Zap className="h-4 w-4" />
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">
                💡 自動配信と友だち台帳のタグ連携仕様について
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.2 rounded-full">
                正常連携
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-slate-300 leading-relaxed text-[11px] pt-1">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5 space-y-1">
                <div className="font-bold text-blue-300 flex items-center gap-1.5">
                  <span className="text-amber-400">⚡</span> 自動配信（シナリオ・自動返信・診断）
                </div>
                <p className="text-slate-400">
                  友だち追加、診断回答完了、面談予約、選択肢タップ時にトリガーで<span className="text-amber-300 font-semibold">「⚡自動付与」</span>されます。また「成約」「予約済」タグが付いた際は、シナリオ配信が<span className="text-emerald-300 font-semibold">自動停止</span>します。
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="text-emerald-400">👤</span> 連絡先・友だち台帳（この画面）
                </div>
                <p className="text-slate-400">
                  面談や商談の進捗に応じて、オペレーターが<span className="text-emerald-300 font-semibold">「👤手動付与」</span>します。同じ共通タグ辞書を使っているため、手動で「成約」や「相談済」を付与した場合も自動配信は即時停止します。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* メイン台帳セクション */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        {/* 検索・基本フィルター */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 p-4 rounded-t-2xl">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="氏名・会社・メール・電話・タグで検索"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-950 p-1">
            {(
              [
                ['all', `すべて (${people.length})`],
                [
                  'line',
                  `LINE友だちのみ (${people.filter((p) => p.lineFriends.length > 0).length})`,
                ],
                [
                  'no-line',
                  `LINE未連携 (${people.filter((p) => p.lineFriends.length === 0).length})`,
                ],
              ] as [FilterMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ' +
                  (filter === value
                    ? 'bg-blue-600 font-semibold text-white shadow-sm'
                    : 'text-slate-400 hover:text-white')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 🏷️ タグカテゴリ切替 & 絞り込みバー */}
        <div className="border-b border-slate-800 bg-slate-950/40 px-4 py-2.5 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold shrink-0">
              <Tag className="h-3.5 w-3.5 text-blue-400" />
              <span>タグ辞書絞り込み:</span>
            </div>
            {/* カテゴリタブ */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { key: 'all', label: 'すべて' },
                { key: 'inflow', label: '📌 流入・選択' },
                { key: 'action', label: '🚀 行動・進捗' },
                { key: 'crm_status', label: '💼 CRM・停止条件' },
                { key: 'custom', label: '🏷️ 独自タグ' },
              ].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setTagCategoryFilter(cat.key)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    tagCategoryFilter === cat.key
                      ? 'bg-blue-600/40 text-blue-200 border border-blue-500/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* タグ一覧ピル */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setSelectedTagFilter(null)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                selectedTagFilter === null
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-600'
              }`}
            >
              全タグ表示 ({people.length})
            </button>
            {filteredTags.map((tag) => {
              const count = tagCounts.get(tag.id) || 0;
              const isSelected = selectedTagFilter === tag.id;
              const isDeleting = deletingTagId === tag.id;

              return (
                <div key={tag.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setSelectedTagFilter(isSelected ? null : tag.id)}
                    title={`「${tag.name}」タグで絞り込み ${tag.description ? '— ' + tag.description : ''}`}
                    className={`rounded-l-full border-y border-l px-2.5 py-1 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-600 text-white font-bold shadow-sm'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tag.color || '#3b82f6' }}
                    />
                    <span>{tag.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? 'bg-blue-800 text-blue-100'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                  {isDeleting ? (
                    <div className="inline-flex items-center rounded-r-full border border-rose-600 bg-rose-950 px-2 py-0.5 text-[10px] text-rose-200 gap-1">
                      <span>削除?</span>
                      <button
                        type="button"
                        onClick={() => void deleteTag(tag.id, tag.name)}
                        className="font-bold text-rose-400 hover:text-white underline cursor-pointer"
                      >
                        はい
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTagId(null)}
                        className="text-slate-400 hover:text-white ml-1 cursor-pointer"
                      >
                        いいえ
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      title={`タグ「${tag.name}」を削除`}
                      onClick={() => setDeletingTagId(tag.id)}
                      className={`rounded-r-full border px-1.5 py-1 text-xs transition cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-700 text-blue-200 hover:bg-rose-600 hover:text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-500 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-700'
                      }`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* 新規タグクイック作成フォーム */}
            <form onSubmit={handleCreateTagTop} className="inline-flex items-center gap-1.5 ml-auto">
              <input
                value={topNewTagName}
                onChange={(e) => setTopNewTagName(e.target.value)}
                placeholder="＋新規タグ名..."
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 w-28 sm:w-36"
              />
              <button
                type="submit"
                disabled={saving || !topNewTagName.trim()}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer transition flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>作成</span>
              </button>
            </form>
          </div>
        </div>

        {selectedTagFilter && (
          <div className="flex items-center justify-between border-b border-blue-900/40 bg-blue-950/30 px-4 py-2 text-xs text-blue-200">
            <div className="flex items-center gap-2">
              <span className="font-bold">
                🏷️ タグ「{tags.find((t) => t.id === selectedTagFilter)?.name}」で絞り込み中:
              </span>
              <span>{visiblePeople.length} 件が該当</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTagFilter(null)}
              className="text-xs text-blue-300 hover:text-white underline cursor-pointer"
            >
              絞り込みを解除
            </button>
          </div>
        )}

        {/* 一括操作バー */}
        {selectedPeople.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-300 font-semibold">
                {selectedPeople.length}人選択中
              </span>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={
                      'rounded-full border px-2.5 py-1 text-xs cursor-pointer ' +
                      (selectedTags.includes(tag.id)
                        ? 'border-blue-400 bg-blue-500/20 text-blue-200'
                        : 'border-slate-700 text-slate-400')
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => void assignSelectedTags()}
                disabled={saving || !selectedTags.length}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer"
              >
                {saving ? '処理中…' : '選択したLINEにタグ付与'}
              </button>
            </div>
            <div>
              <InlineDeleteButton
                onConfirm={() => void bulkDeleteSelected()}
                warning={`選択した ${selectedPeople.length} 件のデータ（連絡先・LINE連携）を完全に削除しますか？`}
                confirmLabel="一括削除を実行"
                className="rounded-lg bg-rose-950/60 border border-rose-800/80 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>選択した {selectedPeople.length} 件を一括削除</span>
              </InlineDeleteButton>
            </div>
          </div>
        )}

        {/* 顧客リスト */}
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中…
          </div>
        ) : visiblePeople.length === 0 ? (
          <div className="p-10 text-center">
            <WifiOff className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-300">
              {people.length ? '条件に一致する人はいません' : '連絡先はまだ登録されていません'}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              連絡先は手動登録や診断・相談から登録できます。LINE友だちはWebhook接続後に自動で連絡先に紐付きます。
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {visiblePeople.map((person) => {
              const hasActivePicker = person.lineFriends.some(
                (f) => f.id === activeTagPickerFriendId
              );

              return (
                <article
                  key={person.id}
                  className={`flex flex-wrap items-start gap-3 p-4 transition ${
                    hasActivePicker ? 'relative z-30 bg-slate-900/90' : 'relative z-0'
                  }`}
                >
                <input
                  aria-label={person.name + 'を選択'}
                  type="checkbox"
                  checked={selectedPeople.includes(person.id)}
                  onChange={() => togglePerson(person.id)}
                  className="mt-1 accent-blue-500 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-white">{person.name}</h2>
                    {person.lineFriends.length ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        <Wifi className="h-3 w-3" />
                        LINE連携 {person.lineFriends.length}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                        <WifiOff className="h-3 w-3" />
                        LINE未連携
                      </span>
                    )}
                    {person.companyName && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {person.companyName}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    {person.email && <span>{person.email}</span>}
                    {person.phone && <span>{person.phone}</span>}
                  </div>
                  {person.contact && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-400">メール配信状態</span>
                      <select
                        aria-label={person.name + 'のメール配信状態'}
                        value={String(person.contact.email_consent_status || 'unknown')}
                        onChange={(event) =>
                          void changeEmailConsent(
                            person.contact!,
                            event.target.value as 'unknown' | 'opted_in' | 'opted_out'
                          )
                        }
                        disabled={saving}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-50"
                      >
                        <option value="unknown">未確認</option>
                        <option value="opted_in">配信可</option>
                        <option value="opted_out">配信停止</option>
                      </select>
                    </div>
                  )}

                  {/* LINE友だち情報 & タグ表示 */}
                  {person.lineFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className={`mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 transition ${
                        activeTagPickerFriendId === friend.id ? 'relative z-20 ring-1 ring-blue-500/30' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-200">
                            <UserRound className="h-3.5 w-3.5 text-emerald-400" />
                            LINE {statusLabel[friend.status] || friend.status}
                          </span>
                          <span className="text-xs text-white font-medium">
                            {friend.display_name || '名前未取得'}
                          </span>
                        </div>
                        <InlineDeleteButton
                          onConfirm={async () => {
                            const supabase = getSupabase();
                            if (!supabase) return;
                            setSaving(true);
                            try {
                              await supabase
                                .from('line_friend_tags')
                                .delete()
                                .eq('line_friend_id', friend.id);
                              await supabase.from('line_friends').delete().eq('id', friend.id);
                              setNotice('LINE友だち連携を解除しました。');
                              await load();
                            } catch (e: any) {
                              setError(e.message || '解除に失敗しました。');
                            } finally {
                              setSaving(false);
                            }
                          }}
                          warning={`「${friend.display_name || friend.line_user_id}」のLINE友だち連携を解除しますか？`}
                          confirmLabel="削除確定"
                          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-400 hover:border-rose-700 hover:bg-rose-950/60 hover:text-rose-300 transition"
                          ariaLabel="LINE友だち連携を解除"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="text-[10px]">LINE削除</span>
                        </InlineDeleteButton>
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
                        {friend.line_user_id}
                      </p>

                      {/* タグ一覧バッジ（⚡自動 vs 👤手動の表示） */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {friend.tags.map((tag) => {
                          const isAuto =
                            tag.assigned_by === 'automation' ||
                            tag.assigned_by === 'welcome_choice';
                          return (
                            <span
                              key={tag.id}
                              style={{ borderColor: tag.color ? `${tag.color}50` : undefined }}
                              className="inline-flex items-center gap-1.5 rounded-full border bg-slate-900/90 px-2.5 py-0.5 text-[11px] text-slate-200 transition"
                              title={`${tag.name} (${
                                isAuto ? '⚡ 自動配信・ルールにより自動付与' : '👤 手動付与'
                              }) ${tag.description ? '— ' + tag.description : ''}`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: tag.color || '#3b82f6' }}
                              />
                              <span className="font-medium">{tag.name}</span>
                              <span
                                className={`text-[9px] font-mono px-1 rounded ${
                                  isAuto
                                    ? 'bg-amber-950/70 text-amber-300 border border-amber-800/40'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {isAuto ? '⚡自動' : '👤手動'}
                              </span>
                              <button
                                type="button"
                                title={'タグ「' + tag.name + '」を外す'}
                                onClick={() => void removeTag(friend.id, tag.id)}
                                className="text-slate-500 hover:text-rose-300 ml-0.5 cursor-pointer transition text-xs font-bold"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}

                        {/* ＋タグ追加 ドロップダウンピッカー（辞書連動） */}
                        <div className={`relative ${activeTagPickerFriendId === friend.id ? 'z-30' : ''}`}>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveTagPickerFriendId(
                                activeTagPickerFriendId === friend.id ? null : friend.id
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-dashed border-blue-500/50 bg-blue-950/20 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300 hover:bg-blue-900/40 transition cursor-pointer"
                          >
                            <Tag className="h-2.5 w-2.5" />
                            <span>＋タグ追加</span>
                          </button>

                          {activeTagPickerFriendId === friend.id && (
                            <>
                              {/* 画面外クリック検知バックドロップ（最前面レイヤー） */}
                              <div
                                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[0.5px]"
                                onClick={() => setActiveTagPickerFriendId(null)}
                              />
                              <div className="absolute left-0 top-full z-50 mt-1.5 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-700 bg-slate-900 p-3.5 shadow-2xl space-y-2.5">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <Tag className="h-3.5 w-3.5 text-blue-400" />
                                    <span>付与するタグを選択（共通辞書連携）</span>
                                  </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveTagPickerFriendId(null)}
                                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                                >
                                  ×
                                </button>
                              </div>

                              {/* 検索 & カテゴリタブ */}
                              <div className="space-y-1.5">
                                <input
                                  type="text"
                                  value={pickerSearch}
                                  onChange={(e) => setPickerSearch(e.target.value)}
                                  placeholder="タグ名や説明で検索..."
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                                />
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    { key: 'all', label: 'すべて' },
                                    { key: 'inflow', label: '📌 流入・選択' },
                                    { key: 'action', label: '🚀 行動・進捗' },
                                    { key: 'crm_status', label: '💼 CRM・停止' },
                                  ].map((cat) => (
                                    <button
                                      key={cat.key}
                                      type="button"
                                      onClick={() => setPickerCategory(cat.key)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition ${
                                        pickerCategory === cat.key
                                          ? 'bg-blue-600 text-white font-bold'
                                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                      }`}
                                    >
                                      {cat.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* タグ候補一覧 */}
                              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                                {pickerMasterItems.map((item) => {
                                  const hasTag = friend.tags.some(
                                    (t) => t.name.toLowerCase() === item.name.toLowerCase()
                                  );

                                  return (
                                    <button
                                      key={item.name}
                                      type="button"
                                      onClick={async () => {
                                        const master = UNIFIED_TAG_MASTER.find(
                                          (m) => m.name.toLowerCase() === item.name.toLowerCase()
                                        );
                                        if (master) {
                                          await assignOrToggleMasterTagToFriend(friend.id, master);
                                        } else if (item.dbId) {
                                          await toggleTagOnFriend(friend.id, item.dbId, hasTag);
                                        }
                                      }}
                                      className={`w-full text-left p-1.5 rounded-lg text-xs flex items-center justify-between transition cursor-pointer border ${
                                        hasTag
                                          ? 'border-emerald-600/40 bg-emerald-950/30 text-emerald-200'
                                          : 'border-slate-800/80 bg-slate-950/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                                      }`}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: item.color }}
                                          />
                                          <span className="font-semibold text-white">
                                            {item.name}
                                          </span>
                                          <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">
                                            {item.categoryLabel}
                                          </span>
                                        </div>
                                        {item.description && (
                                          <p className="truncate text-[10px] text-slate-400 mt-0.5">
                                            {item.description}
                                          </p>
                                        )}
                                      </div>
                                      <div className="shrink-0 ml-2">
                                        {hasTag ? (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/50">
                                            <Check className="h-3 w-3" />
                                            付与済
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-blue-400 hover:underline">
                                            ＋付与
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}

                                {pickerMasterItems.length === 0 && (
                                  <div className="text-center py-4 text-xs text-slate-500">
                                    一致するタグがありません
                                  </div>
                                )}
                              </div>

                              {/* 独自タグ作成フォーム */}
                              <div className="border-t border-slate-800 pt-2 flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={pickerCustomTagName}
                                  onChange={(e) => setPickerCustomTagName(e.target.value)}
                                  placeholder="新しい独自タグを入力..."
                                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  disabled={!pickerCustomTagName.trim() || saving}
                                  onClick={async () => {
                                    if (!pickerCustomTagName.trim()) return;
                                    await createTagDirect(pickerCustomTagName.trim());
                                    setPickerCustomTagName('');
                                  }}
                                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer"
                                >
                                  作成
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!person.contact && (
                    <p className="mt-2 text-xs text-amber-300">連絡先プロフィール未紐付け</p>
                  )}
                </div>

                {/* アクションボタン */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {person.contact && person.email && (
                    <button
                      onClick={() =>
                        onOpenEmailSend?.(
                          person.contact!.id,
                          person.contact!.company_id || undefined
                        )
                      }
                      className="flex items-center gap-1 rounded-lg bg-indigo-700/30 px-2.5 py-1.5 text-xs text-indigo-200 hover:bg-indigo-700/60 cursor-pointer transition"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      メール作成
                    </button>
                  )}
                  {person.contact &&
                    person.lineFriends.map((friend) => (
                      <button
                        key={friend.id}
                        onClick={() =>
                          onOpenLineInbox?.(person.contact!.id, friend.line_user_id)
                        }
                        className="flex items-center gap-1 rounded-lg bg-emerald-700/30 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-700/60 cursor-pointer transition"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        LINE受信箱
                      </button>
                    ))}
                  {person.contact && (
                    <button
                      onClick={() => setEditingContact(person.contact || null)}
                      className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer transition"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      編集
                    </button>
                  )}
                  <InlineDeleteButton
                    onConfirm={() => void deletePerson(person)}
                    warning={`「${person.name}」を削除しますか？`}
                    confirmLabel="削除確定"
                    className="flex items-center gap-1 rounded-lg border border-rose-800/60 bg-rose-950/30 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-900/50 hover:text-white transition cursor-pointer"
                    ariaLabel={`「${person.name}」を削除`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>削除</span>
                  </InlineDeleteButton>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 下部：配信・CRM共通タグ辞書 ＆ マスタ一覧セクション */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Tag className="h-4 w-4 text-blue-400" />
              <span>配信・CRM共通タグ辞書（UNIFIED_TAG_MASTER）</span>
            </div>
            <button
              type="button"
              onClick={() => void syncMasterTags()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-950/40 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-900/40 transition cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>辞書全16種を一括同期</span>
            </button>
          </div>

          <p className="text-xs leading-5 text-slate-400">
            マーケティング配信（ステップ配信・自動返信・診断フォーム）と連絡先台帳で同じ辞書を共有します。
            下の各タグをクリックして選択し、上の「選択したLINEにタグ付与」で一括反映できます。
          </p>

          {/* カテゴリ別タグ一覧カード */}
          <div className="space-y-3">
            {[
              {
                category: 'inflow',
                label: '📌 流入・選択タグ（友だち追加・選択肢）',
                desc: '友だち登録やFlex選択肢タップで自動付与',
              },
              {
                category: 'action',
                label: '🚀 行動・進捗タグ（診断・面談予約）',
                desc: 'フォーム回答や面談完了で自動付与（リマインド停止条件と連動）',
              },
              {
                category: 'crm_status',
                label: '💼 CRMステータス・停止条件タグ',
                desc: '成約・契約済・Hot見込み客など、スタッフ手動付与が主で全追客停止と連動',
              },
            ].map((section) => {
              const sectionTags = tags.filter((t) => t.category === section.category);
              return (
                <div key={section.category} className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{section.label}</span>
                    <span className="text-[10px] text-slate-400">{section.desc}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sectionTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition cursor-pointer flex items-center gap-1.5 ${
                          selectedTags.includes(tag.id)
                            ? 'border-blue-400 bg-blue-500/20 text-blue-200 font-bold'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                        }`}
                        title={tag.description || ''}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: tag.color || '#3b82f6' }}
                        />
                        <span>{tag.name}</span>
                        {tag.isExitConditionDefault && (
                          <span className="text-[9px] px-1 rounded bg-amber-950/70 text-amber-300 border border-amber-800/40">
                            停止条件
                          </span>
                        )}
                      </button>
                    ))}
                    {!sectionTags.length && (
                      <span className="text-xs text-slate-500 italic">
                        未同期（「辞書全16種を一括同期」を押すと登録されます）
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={createTag} className="flex gap-2 pt-2">
            <input
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
              maxLength={40}
              placeholder="新しい独自タグ名を入力"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
            />
            <button
              disabled={saving || !newTagName.trim()}
              className="rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
          </form>
        </section>

        {/* 右サイド：接続状態＆仕様まとめ */}
        <aside className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-blue-200">タグ辞書と自動配信の仕様</h3>
          </div>
          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
              <div className="font-bold text-amber-300 flex items-center gap-1">
                <span>⚡</span> 自動配信の役割
              </div>
              <p className="text-[11px] text-slate-400">
                LINE登録時や診断回答完了時、選択肢クリック時にタグを自動付与。
                「成約」「予約済」タグが付いた場合は、ステップ配信やリマインドを自動で終了（Exit）させます。
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
              <div className="font-bold text-emerald-300 flex items-center gap-1">
                <span>👤</span> 友だち台帳の役割
              </div>
              <p className="text-[11px] text-slate-400">
                オペレーターが顧客との個別商談やヒアリング結果を見て手動でタグ付け。
                手動で付与したタグも自動配信の停止条件に即座に反映されます。
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
              <div className="font-bold text-blue-300 flex items-center gap-1">
                <span>📖</span> 共通辞書の役割
              </div>
              <p className="text-[11px] text-slate-400">
                配信側と台帳側で同じタグ名・カラー・分類を共有することで、表記揺れを防ぎ、誰でも迷わず正確な顧客管理・配信ターゲティングを行えます。
              </p>
            </div>
          </div>
        </aside>
      </div>

      {(isCreateOpen || editingContact) && (
        <RecordFormModal
          isOpen={true}
          tableKey={'contacts' as TableKey}
          editRecord={editingContact}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingContact(null);
          }}
          onSuccess={() => {
            setIsCreateOpen(false);
            setEditingContact(null);
            void load();
          }}
        />
      )}
    </div>
  );
};
