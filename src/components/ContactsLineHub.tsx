import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, RefreshCw, Search, Tag, Users, UserRound, Wifi, WifiOff, Pencil } from 'lucide-react';
import { Contact, TableKey } from '../types/database';
import { fetchTableData } from '../services/dataService';
import { getSupabase } from '../lib/supabaseClient';
import { RecordFormModal } from './RecordFormModal';

interface LineTag { id: string; name: string; color?: string | null; }
interface LineFriend {
  id: string;
  contact_id?: string | null;
  line_user_id: string;
  display_name?: string | null;
  status: 'active' | 'blocked' | 'unfollowed' | 'unknown';
  consent_status: string;
  last_message_at?: string | null;
  followed_at?: string | null;
  tags: LineTag[];
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

export const ContactsLineHub: React.FC = () => {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [tags, setTags] = useState<LineTag[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
        supabase.from('line_friend_tags').select('line_friend_id, tag_id'),
      ]);

      if (contactResult.error) throw new Error(contactResult.error.message);
      const queryError = friendResult.error || tagResult.error || assignmentResult.error;
      if (queryError) throw new Error(queryError.message || '連絡先・LINE情報を読み込めませんでした。');

      const tagList = (tagResult.data || []) as LineTag[];
      const tagById = new Map(tagList.map((tag) => [tag.id, tag]));
      const tagsByFriend = new Map<string, LineTag[]>();
      (assignmentResult.data || []).forEach((assignment: any) => {
        const tag = tagById.get(assignment.tag_id);
        if (tag) tagsByFriend.set(assignment.line_friend_id, [...(tagsByFriend.get(assignment.line_friend_id) || []), tag]);
      });

      const contacts = (contactResult.data || []) as Contact[];
      const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
      const contactByLineId = new Map(contacts.filter((contact) => contact.line_user_id).map((contact) => [contact.line_user_id as string, contact]));
      const friends = ((friendResult.data || []) as Omit<LineFriend, 'tags'>[]).map((friend) => ({
        ...friend,
        tags: tagsByFriend.get(friend.id) || [],
      }));
      const friendsByContact = new Map<string, LineFriend[]>();
      const unlinkedFriends: LineFriend[] = [];

      friends.forEach((friend) => {
        const linkedContact = (friend.contact_id ? contactById.get(friend.contact_id) : undefined)
          || contactByLineId.get(friend.line_user_id);
        if (!linkedContact) {
          unlinkedFriends.push(friend);
          return;
        }
        friendsByContact.set(linkedContact.id, [...(friendsByContact.get(linkedContact.id) || []), friend]);
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
      setError(loadError instanceof Error ? loadError.message : '連絡先・LINE情報を読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visiblePeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return people.filter((person) => {
      if (filter === 'line' && !person.lineFriends.length) return false;
      if (filter === 'no-line' && person.lineFriends.length) return false;
      if (!query) return true;
      const values = [
        person.name, person.email, person.phone, person.companyName,
        ...person.lineFriends.flatMap((friend) => [friend.line_user_id, friend.display_name, ...friend.tags.map((tag) => tag.name)]),
      ];
      return values.some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [people, search, filter]);

  const togglePerson = (id: string) => setSelectedPeople((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  );
  const toggleTag = (id: string) => setSelectedTags((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  );

  const createTag = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newTagName.trim();
    if (!name) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    const { error: insertError } = await supabase.from('contact_tags').insert({ name });
    if (insertError) {
      setError(insertError.message.includes('duplicate') ? '同じ名前のタグがすでにあります。' : insertError.message);
    } else {
      setNewTagName('');
      setNotice('タグを作成しました。LINE友だちを選んで付与できます。');
      await load();
    }
    setSaving(false);
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
    const rows = selectedFriends.flatMap((friend) => selectedTags.map((tagId) => ({
      line_friend_id: friend.id,
      tag_id: tagId,
      assigned_by: 'operator',
    })));
    const { error: assignError } = await supabase.from('line_friend_tags')
      .upsert(rows, { onConflict: 'line_friend_id,tag_id', ignoreDuplicates: true });
    if (assignError) {
      setError(assignError.message);
    } else {
      setNotice(selectedFriends.length + '件のLINE友だちにタグを付与しました。');
      setSelectedPeople([]);
      setSelectedTags([]);
      await load();
    }
    setSaving(false);
  };

  const removeTag = async (friendId: string, tagId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error: removeError } = await supabase.from('line_friend_tags')
      .delete().eq('line_friend_id', friendId).eq('tag_id', tagId);
    if (removeError) setError(removeError.message);
    else await load();
  };

  const changeEmailConsent = async (contact: Contact, status: 'unknown' | 'opted_in' | 'opted_out') => {
    const currentStatus = String(contact.email_consent_status || 'unknown');
    if (currentStatus === status) return;
    const statusLabels = { unknown: '未確認', opted_in: '配信可', opted_out: '配信停止' };
    if (!window.confirm(`この連絡先のメール状態を「${statusLabels[status]}」に変更しますか？${status === 'opted_out' ? '\n営業・案内メールを送信しない状態になります。' : ''}`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const optedOutAt = status === 'opted_out' ? new Date().toISOString() : null;
    const optedOutReason = status === 'opted_out' ? '手動で停止' : null;
    setSaving(true);
    setError('');
    setNotice('');
    const { error: updateError } = await supabase.from('contacts').update({
      email_consent_status: status,
      email_opted_out_at: optedOutAt,
      email_opt_out_reason: optedOutReason,
    }).eq('id', contact.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setPeople((current) => current.map((person) => person.contact?.id === contact.id
        ? { ...person, contact: { ...person.contact, email_consent_status: status, email_opted_out_at: optedOutAt, email_opt_out_reason: optedOutReason } }
        : person));
      setNotice(`メール状態を「${statusLabels[status]}」に変更しました。`);
    }
    setSaving(false);
  };

  const statusLabel: Record<LineFriend['status'], string> = {
    active: '友だち',
    blocked: 'ブロック',
    unfollowed: '解除',
    unknown: '状態不明',
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-950/20 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">連絡先・LINE</h1>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300">配信・個別チャット未実装</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              人の基本情報とLINE上の状態を同じ一覧で管理します。LINE友だち追加だけではリードになりません。
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
              <Plus className="h-4 w-4" />連絡先を追加
            </button>
            <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50">
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />更新
            </button>
          </div>
        </div>
      </section>

      {(error || notice) && (
        <div className={'rounded-xl border px-4 py-3 text-sm ' + (error ? 'border-rose-500/30 bg-rose-950/30 text-rose-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200')}>
          {error || notice}
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Users className="h-4 w-4 text-blue-400" />一覧 <span className="text-xs font-normal text-slate-400">{visiblePeople.length}人</span>
          </div>
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="氏名・会社・メール・電話・タグで検索" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-950 p-1">
            {([
              ['all', 'すべて'],
              ['line', 'LINEあり'],
              ['no-line', 'LINE未連携'],
            ] as [FilterMode, string][]).map(([value, label]) => (
              <button key={value} onClick={() => setFilter(value)} className={'rounded-md px-2.5 py-1.5 text-xs ' + (filter === value ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {selectedPeople.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/70 p-4">
            <span className="text-xs text-slate-300">{selectedPeople.length}人選択</span>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => <button key={tag.id} onClick={() => toggleTag(tag.id)} className={'rounded-full border px-2.5 py-1 text-xs ' + (selectedTags.includes(tag.id) ? 'border-blue-400 bg-blue-500/20 text-blue-200' : 'border-slate-700 text-slate-400')}>{tag.name}</button>)}
            </div>
            <button onClick={() => void assignSelectedTags()} disabled={saving || !selectedTags.length} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{saving ? '処理中…' : '選択した人のLINEにタグ付与'}</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />読み込み中…</div>
        ) : visiblePeople.length === 0 ? (
          <div className="p-10 text-center">
            <WifiOff className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-300">{people.length ? '条件に一致する人はいません' : '連絡先はまだ登録されていません'}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">連絡先は手動登録や診断・相談から登録できます。LINE友だちはWebhook接続後に自動で連絡先に紐付きます。</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {visiblePeople.map((person) => (
              <article key={person.id} className="flex flex-wrap items-start gap-3 p-4">
                <input aria-label={person.name + 'を選択'} type="checkbox" checked={selectedPeople.includes(person.id)} onChange={() => togglePerson(person.id)} disabled={!person.lineFriends.length} className="mt-1 accent-blue-500 disabled:opacity-25" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-white">{person.name}</h2>
                    {person.lineFriends.length ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300"><Wifi className="h-3 w-3" />LINE連携 {person.lineFriends.length}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400"><WifiOff className="h-3 w-3" />LINE未連携</span>
                    )}
                    {person.companyName && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{person.companyName}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    {person.email && <span>{person.email}</span>}
                    {person.phone && <span>{person.phone}</span>}
                  </div>
                  {person.contact && <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-400">メール配信状態</span>
                    <select aria-label={person.name + 'のメール配信状態'} value={String(person.contact.email_consent_status || 'unknown')} onChange={(event) => void changeEmailConsent(person.contact!, event.target.value as 'unknown' | 'opted_in' | 'opted_out')} disabled={saving} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-50">
                      <option value="unknown">未確認</option>
                      <option value="opted_in">配信可</option>
                      <option value="opted_out">配信停止</option>
                    </select>
                  </div>}
                  {person.lineFriends.map((friend) => (
                    <div key={friend.id} className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-200"><UserRound className="h-3.5 w-3.5 text-emerald-400" />LINE {statusLabel[friend.status] || friend.status}</span>
                        <span className="text-[10px] text-slate-500">配信同意: {friend.consent_status === 'opted_in' ? 'あり' : friend.consent_status === 'opted_out' ? 'なし' : '未確認'}</span>
                        {friend.last_message_at && <span className="text-[10px] text-slate-500">最終接触 {new Date(friend.last_message_at).toLocaleDateString()}</span>}
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{friend.line_user_id}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {friend.tags.map((tag) => <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{tag.name}<button title={'タグ「' + tag.name + '」を外す'} onClick={() => void removeTag(friend.id, tag.id)} className="text-slate-500 hover:text-rose-300">×</button></span>)}
                        {!friend.tags.length && <span className="text-[10px] text-slate-600">タグなし</span>}
                      </div>
                    </div>
                  ))}
                  {!person.contact && <p className="mt-2 text-xs text-amber-300">連絡先プロフィール未紐付け</p>}
                </div>
                {person.contact && <button onClick={() => setEditingContact(person.contact || null)} className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"><Pencil className="h-3.5 w-3.5" />編集</button>}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-white"><Tag className="h-4 w-4 text-blue-400" />タグ</div>
          <p className="text-xs leading-5 text-slate-400">タグはLINE友だちに付与されます。LINE未連携の連絡先には付与できません。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => <button key={tag.id} onClick={() => toggleTag(tag.id)} className={'rounded-full border px-2.5 py-1 text-xs ' + (selectedTags.includes(tag.id) ? 'border-blue-400 bg-blue-500/20 text-blue-200' : 'border-slate-700 bg-slate-950 text-slate-300')}>{tag.name}</button>)}
            {!tags.length && <span className="text-xs text-slate-500">タグはまだありません。</span>}
          </div>
          <form onSubmit={createTag} className="mt-4 flex gap-2">
            <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} maxLength={40} placeholder="新しいLINEタグ名" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-blue-500" />
            <button disabled={saving || !newTagName.trim()} className="rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
          </form>
        </section>
        <aside className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
          <h3 className="text-xs font-bold text-amber-200">LINE接続状態</h3>
          <p className="mt-2 text-xs leading-5 text-amber-100/70">友だちのWebhook取込とタグ管理に対応しています。個別チャット、一斉配信、Flex/画像送信、リッチメニューはまだ利用できません。</p>
        </aside>
      </div>

      {(isCreateOpen || editingContact) && (
        <RecordFormModal
          isOpen={true}
          tableKey={'contacts' as TableKey}
          editRecord={editingContact}
          onClose={() => { setIsCreateOpen(false); setEditingContact(null); }}
          onSuccess={() => { setIsCreateOpen(false); setEditingContact(null); void load(); }}
        />
      )}
    </div>
  );
};

