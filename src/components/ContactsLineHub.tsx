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
    let successCount = 0;
    const failedList: string[] = [];
    try {
      for (const person of targets) {
        try {
          await deletePerson(person);
          successCount++;
        } catch (err: any) {
          failedList.push(`${person.name || person.id}: ${err.message || '削除失敗'}`);
        }
      }
      setSelectedPeople([]);
      if (failedList.length > 0) {
        if (successCount > 0) {
          setNotice(`${successCount} 件のデータを削除しました。`);
        }
        setError(`削除できなかったデータ (${failedList.length}件): ${failedList.join('、')}`);
      } else {
        setNotice(`${successCount} 件のデータを完全に削除しました。`);
      }
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center justify-between shadow-2xs">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800 flex items-center justify-between shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-purple-500 hover:text-purple-700 cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* ヘッダー */}
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">連絡先・LINE友だち台帳</h1>
            <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
              タグ辞書連動
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            CRM連絡先とLINE公式アカウント友だちを一元管理。タグ付与で自動配信と商談進捗が連動します。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void syncMasterTags()}
            disabled={saving}
            title="マーケティング配信共通タグ辞書（全16種）を一括同期します"
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer disabled:opacity-40 shadow-2xs"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>タグ辞書全同期 ({tags.length}/16)</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 transition cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>連絡先を追加</span>
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer disabled:opacity-50 shadow-2xs"
            title="再読み込み"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* メイン台帳セクション */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
        {/* 検索・基本フィルター */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-4 rounded-t-2xl">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="氏名・会社・メール・電話・タグで検索"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200">
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
                    ? 'bg-white font-bold text-purple-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 🏷️ タグカテゴリ切替 & 絞り込みバー */}
        <div className="border-b border-slate-200 bg-white px-4 py-2.5 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-700 font-semibold shrink-0">
              <Tag className="h-3.5 w-3.5 text-purple-600" />
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    tagCategoryFilter === cat.key
                      ? 'bg-purple-50 text-purple-700 border border-purple-200 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
              className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                selectedTagFilter === null
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
                        ? 'border-purple-300 bg-purple-50 text-purple-800 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tag.color || '#6b46c1' }}
                    />
                    <span>{tag.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? 'bg-purple-200 text-purple-900'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                  {isDeleting ? (
                    <div className="inline-flex items-center rounded-r-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-800 gap-1">
                      <span>削除?</span>
                      <button
                        type="button"
                        onClick={() => void deleteTag(tag.id, tag.name)}
                        className="font-bold text-rose-700 hover:underline cursor-pointer"
                      >
                        はい
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTagId(null)}
                        className="text-slate-500 hover:text-slate-800 ml-1 cursor-pointer"
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
                          ? 'border-purple-300 bg-purple-100 text-purple-800 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300'
                          : 'border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
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
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 w-28 sm:w-36 shadow-2xs"
              />
              <button
                type="submit"
                disabled={saving || !topNewTagName.trim()}
                className="rounded-lg bg-purple-600 hover:bg-purple-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer transition flex items-center gap-1 shadow-2xs"
              >
                <Plus className="h-3 w-3" />
                <span>作成</span>
              </button>
            </form>
          </div>
        </div>

        {selectedTagFilter && (
          <div className="flex items-center justify-between border-b border-purple-200 bg-purple-50/70 px-4 py-2 text-xs text-purple-900">
            <div className="flex items-center gap-2">
              <span className="font-bold">
                🏷️ タグ「{tags.find((t) => t.id === selectedTagFilter)?.name}」で絞り込み中:
              </span>
              <span>{visiblePeople.length} 件が該当</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTagFilter(null)}
              className="text-xs text-purple-700 hover:text-purple-900 underline cursor-pointer font-medium"
            >
              絞り込みを解除
            </button>
          </div>
        )}

        {/* 一括操作バー */}
        {selectedPeople.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-purple-50/40 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-800 font-bold">
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
                        ? 'border-purple-300 bg-purple-100 text-purple-800 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => void assignSelectedTags()}
                disabled={saving || !selectedTags.length}
                className="rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer shadow-xs"
              >
                {saving ? '処理中…' : '選択したLINEにタグ付与'}
              </button>
            </div>
            <div>
              <InlineDeleteButton
                onConfirm={() => void bulkDeleteSelected()}
                warning={`選択した ${selectedPeople.length} 件のデータ（連絡先・LINE連携）を完全に削除しますか？`}
                confirmLabel="一括削除を実行"
                className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>選択した {selectedPeople.length} 件を一括削除</span>
              </InlineDeleteButton>
            </div>
          </div>
        )}

        {/* 顧客リスト */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
            <span>連絡先・LINE友だちデータを読み込み中…</span>
          </div>
        ) : visiblePeople.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <WifiOff className="mx-auto h-8 w-8 text-slate-400" />
            <p className="text-sm font-bold text-slate-800">
              {people.length ? '条件に一致する人はいません' : '連絡先はまだ登録されていません'}
            </p>
            <p className="text-xs leading-5 text-slate-500 max-w-md mx-auto">
              連絡先は手動登録や診断・相談受付フォームから登録できます。LINE友だちは友だち追加時に自動で紐付きます。
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visiblePeople.map((person) => {
              const hasActivePicker = person.lineFriends.some(
                (f) => f.id === activeTagPickerFriendId
              );

              return (
                <article
                  key={person.id}
                  className={`flex flex-wrap items-start gap-3 p-4 transition hover:bg-slate-50/60 ${
                    hasActivePicker ? 'relative z-30 bg-purple-50/30' : 'relative z-0'
                  }`}
                >
                <input
                  aria-label={person.name + 'を選択'}
                  type="checkbox"
                  checked={selectedPeople.includes(person.id)}
                  onChange={() => togglePerson(person.id)}
                  className="mt-1 accent-purple-600 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-slate-900">{person.name}</h2>
                    {person.lineFriends.length ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Wifi className="h-3 w-3" />
                        LINE連携 {person.lineFriends.length}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                        <WifiOff className="h-3 w-3" />
                        LINE未連携
                      </span>
                    )}
                    {person.companyName && (
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-medium text-slate-700">
                        {person.companyName}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {person.email && <span>{person.email}</span>}
                    {person.phone && <span>{person.phone}</span>}
                  </div>
                  {person.contact && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">メール配信状態:</span>
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
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 disabled:opacity-50 outline-none focus:border-purple-500 shadow-2xs cursor-pointer"
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
                      className={`mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 transition shadow-2xs ${
                        activeTagPickerFriendId === friend.id ? 'relative z-20 ring-2 ring-purple-500/20 bg-white' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                            <UserRound className="h-3.5 w-3.5 text-emerald-600" />
                            LINE {statusLabel[friend.status] || friend.status}
                          </span>
                          <span className="text-xs text-slate-900 font-semibold">
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
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                          ariaLabel="LINE友だち連携を解除"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="text-[10px]">LINE解除</span>
                        </InlineDeleteButton>
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
                        {friend.line_user_id}
                      </p>

                      {/* タグ一覧バッジ（流入／進捗／ステータス別にまとまり、⚡自動 vs 👤手動を一目で識別） */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {(() => {
                          const orderMap = { inflow: 1, action: 2, crm_status: 3, custom: 4 };
                          const getCat = (t: { name: string; category?: string }) => {
                            if (t.name.startsWith('流入:') || ['LINE友だち追加', '選択:診断', '選択:個別相談', 'care:開業相談', '介護保険外開業', '資料請求', 'Web問い合わせ'].includes(t.name) || t.category === 'inflow') return 'inflow';
                            if (['診断受検済み', '診断レポート送付済', '個別相談予約済み', '相談実施済み', '提案書提示済み'].includes(t.name) || t.category === 'action') return 'action';
                            if (['成約・顧問契約', '既存クライアント', '見込み客(Hot)', '配信停止・オプトアウト'].includes(t.name) || t.category === 'crm_status') return 'crm_status';
                            return 'custom';
                          };
                          const sortedTags = [...friend.tags].sort((a, b) => orderMap[getCat(a)] - orderMap[getCat(b)]);

                          return sortedTags.map((tag) => {
                            const isAuto =
                              tag.assigned_by === 'automation' ||
                              tag.assigned_by === 'welcome_choice';
                            const cat = getCat(tag);
                            const catLabel = cat === 'inflow' ? '流入' : cat === 'action' ? '進捗' : cat === 'crm_status' ? '顧客' : '独自';

                            return (
                              <span
                                key={tag.id}
                                style={{ borderColor: tag.color ? `${tag.color}40` : undefined }}
                                className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-800 transition shadow-2xs"
                                title={`${tag.name} [${catLabel}] (${
                                  isAuto ? '⚡ 自動配信・フォーム・ルールにより自動付与' : '👤 手動付与'
                                }) ${tag.description ? '— ' + tag.description : ''}`}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: tag.color || '#6b46c1' }}
                                />
                                <span className="font-semibold text-slate-800">{tag.name}</span>
                                <span
                                  className={`text-[9px] font-mono px-1 rounded ${
                                    isAuto
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {isAuto ? '⚡自動' : '👤手動'}
                                </span>
                                <button
                                  type="button"
                                  title={'タグ「' + tag.name + '」を外す'}
                                  onClick={() => void removeTag(friend.id, tag.id)}
                                  className="text-slate-400 hover:text-rose-600 ml-0.5 cursor-pointer transition text-xs font-bold"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          });
                        })()}

                        {/* 手動タグ追加（主役にせず、例外対応用とわかる控えめな表現） */}
                        <div className={`relative ${activeTagPickerFriendId === friend.id ? 'z-30' : ''}`}>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveTagPickerFriendId(
                                activeTagPickerFriendId === friend.id ? null : friend.id
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100/90 hover:bg-purple-50 hover:border-purple-300 px-2 py-0.5 text-[10px] text-slate-500 hover:text-purple-700 transition cursor-pointer"
                            title="例外対応用：手動でタグを付与"
                          >
                            <Tag className="h-2.5 w-2.5" />
                            <span>＋手動付与（例外用）</span>
                          </button>

                          {activeTagPickerFriendId === friend.id && (
                            <>
                              {/* 画面外クリック検知バックドロップ */}
                              <div
                                className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[0.5px]"
                                onClick={() => setActiveTagPickerFriendId(null)}
                              />
                              <div className="absolute left-0 top-full z-50 mt-1.5 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl space-y-2.5">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    <Tag className="h-3.5 w-3.5 text-purple-600" />
                                    <span>付与するタグを選択（共通辞書連携）</span>
                                  </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveTagPickerFriendId(null)}
                                  className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
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
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 shadow-inner"
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
                                          ? 'bg-purple-600 text-white font-bold shadow-xs'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                          : 'border-slate-100 bg-white text-slate-700 hover:bg-purple-50/50 hover:text-purple-900'
                                      }`}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: item.color }}
                                          />
                                          <span className="font-bold text-slate-800">
                                            {item.name}
                                          </span>
                                          <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-500">
                                            {item.categoryLabel}
                                          </span>
                                        </div>
                                        {item.description && (
                                          <p className="truncate text-[10px] text-slate-500 mt-0.5">
                                            {item.description}
                                          </p>
                                        )}
                                      </div>
                                      <div className="shrink-0 ml-2">
                                        {hasTag ? (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                                            <Check className="h-3 w-3" />
                                            付与済
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold text-purple-600 hover:underline">
                                            ＋付与
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}

                                {pickerMasterItems.length === 0 && (
                                  <div className="text-center py-4 text-xs text-slate-400">
                                    一致するタグがありません
                                  </div>
                                )}
                              </div>

                              {/* 独自タグ作成フォーム */}
                              <div className="border-t border-slate-100 pt-2 flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={pickerCustomTagName}
                                  onChange={(e) => setPickerCustomTagName(e.target.value)}
                                  placeholder="新しい独自タグを入力..."
                                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 shadow-2xs"
                                />
                                <button
                                  type="button"
                                  disabled={!pickerCustomTagName.trim() || saving}
                                  onClick={async () => {
                                    if (!pickerCustomTagName.trim()) return;
                                    await createTagDirect(pickerCustomTagName.trim());
                                    setPickerCustomTagName('');
                                  }}
                                  className="rounded-lg bg-purple-600 hover:bg-purple-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer shadow-2xs"
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
                    <p className="mt-2 text-xs text-amber-600 font-medium">連絡先プロフィール未紐付け</p>
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
                      className="flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer transition shadow-2xs"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>メール作成</span>
                    </button>
                  )}
                  {person.contact &&
                    person.lineFriends.map((friend) => (
                      <button
                        key={friend.id}
                        onClick={() =>
                          onOpenLineInbox?.(person.contact!.id, friend.line_user_id)
                        }
                        className="flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 cursor-pointer transition shadow-2xs"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>LINE受信箱</span>
                      </button>
                    ))}
                  {person.contact && (
                    <button
                      onClick={() => setEditingContact(person.contact || null)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition shadow-2xs"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>編集</span>
                    </button>
                  )}
                  <InlineDeleteButton
                    onConfirm={() => void deletePerson(person)}
                    warning={`「${person.name}」を削除しますか？`}
                    confirmLabel="削除確定"
                    className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
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
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Tag className="h-4 w-4 text-purple-600" />
              <span>配信・CRM共通タグ辞書（UNIFIED_TAG_MASTER）</span>
            </div>
            <button
              type="button"
              onClick={() => void syncMasterTags()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer disabled:opacity-40 shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>辞書全16種を一括同期</span>
            </button>
          </div>

          <p className="text-xs leading-5 text-slate-500">
            マーケティング配信（ステップ配信・自動返信・診断フォーム）と連絡先台帳で同じ辞書を共有します。
            下の各タグをクリックして選択し、上の「選択したLINEにタグ付与」で一括反映できます。
          </p>

          {/* カテゴリ別タグ一覧カード */}
          <div className="space-y-3">
            {[
              {
                category: 'inflow',
                label: '📌 流入・選択タグ（友だち追加・選択肢・UTM）',
                desc: '友だち登録、Flex選択肢タップ、フォーム送信（正規化UTM・認知経路回答）で自動付与',
              },
              {
                category: 'action',
                label: '🚀 行動・進捗タグ（診断・面談予約）',
                desc: '診断・資料請求フォーム回答完了時に自動付与。個別相談予約（TimeRex等）や面談実施はスタッフが手動付与（リマインド停止条件と連動）',
              },
              {
                category: 'crm_status',
                label: '💼 CRMステータス・停止条件タグ',
                desc: '成約・顧問契約・Hot見込み客など、スタッフが商談状況に応じて手動で付与（全追客停止と連動）',
              },
            ].map((section) => {
              const sectionTags = tags.filter((t) => t.category === section.category);
              return (
                <div key={section.category} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{section.label}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{section.desc}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sectionTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition cursor-pointer flex items-center gap-1.5 ${
                          selectedTags.includes(tag.id)
                            ? 'border-purple-300 bg-purple-100 text-purple-800 font-bold'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                        title={tag.description || ''}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: tag.color || '#6b46c1' }}
                        />
                        <span>{tag.name}</span>
                        {tag.isExitConditionDefault && (
                          <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 border border-amber-200 font-semibold">
                            停止条件
                          </span>
                        )}
                      </button>
                    ))}
                    {!sectionTags.length && (
                      <span className="text-xs text-slate-400 italic">
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
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs placeholder:text-slate-400"
            />
            <button
              disabled={saving || !newTagName.trim()}
              className="rounded-lg bg-purple-600 hover:bg-purple-700 px-3 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer shadow-2xs transition"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
          </form>
        </section>

        {/* 右サイド：接続状態＆仕様まとめ */}
        <aside className="rounded-2xl border border-purple-200 bg-purple-50/30 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-purple-900">タグ辞書と自動配信の仕様</h3>
          </div>
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs">
              <div className="font-bold text-amber-700 flex items-center gap-1">
                <span>⚡</span> 自動付与の役割
              </div>
              <p className="text-[11px] text-slate-500">
                LINE登録時、診断フォーム・資料請求フォーム送信時、Flex選択肢クリック時にタグを自動付与。
                「診断受検済み」等の条件タグが付いた場合は、ステップ配信や未受検リマインドを自動で終了（Exit）させます。
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs">
              <div className="font-bold text-emerald-700 flex items-center gap-1">
                <span>👤</span> 手動付与の役割（例外・商談進捗）
              </div>
              <p className="text-[11px] text-slate-500">
                外部カレンダー（TimeRex等）での面談確定時（個別相談予約済み）、面談実施完了、成約・契約締結時はスタッフが手動でタグ付け。
                手動付与したタグも自動配信の停止条件に即座に反映されます。
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs">
              <div className="font-bold text-purple-700 flex items-center gap-1">
                <span>📖</span> 共通辞書の役割
              </div>
              <p className="text-[11px] text-slate-500">
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
