import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RefreshCw, Search, Tag, Users, WifiOff, Trash2 } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { InlineDeleteButton } from '../InlineDeleteButton';

interface LineTag { id: string; name: string; color?: string | null; }
interface Friend {
  id: string;
  contact_id?: string | null;
  line_user_id: string;
  display_name?: string | null;
  status: 'active' | 'blocked' | 'unfollowed' | 'unknown';
  consent_status: string;
  last_message_at?: string | null;
  followed_at?: string | null;
  contact?: { full_name?: string; email?: string | null } | null;
  tags: LineTag[];
}

export const LineFriendManager: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [tags, setTags] = useState<LineTag[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabaseに接続できません。接続設定を確認してください。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const [friendResult, tagResult, assignmentResult] = await Promise.all([
      supabase.from('line_friends').select('*').order('updated_at', { ascending: false }),
      supabase.from('contact_tags').select('*').order('name', { ascending: true }),
      supabase.from('line_friend_tags').select('line_friend_id, tag_id'),
    ]);
    const firstError = friendResult.error || tagResult.error || assignmentResult.error;
    if (firstError) {
      setError(firstError.message || 'LINE友だちデータを読み込めませんでした。PR #21のmigration適用を確認してください。');
      setLoading(false);
      return;
    }
    const rawFriends = friendResult.data || [];
    const contactIds = [...new Set(rawFriends.map((f: any) => f.contact_id).filter(Boolean))];
    const contactResult = contactIds.length
      ? await supabase.from('contacts').select('id, full_name, email').in('id', contactIds)
      : { data: [], error: null };
    if (contactResult.error) {
      setError(contactResult.error.message || '連絡先を読み込めませんでした。');
      setLoading(false);
      return;
    }
    const contactMap = new Map((contactResult.data || []).map((contact: any) => [contact.id, contact]));
    const tagList = (tagResult.data || []) as LineTag[];
    const tagMap = new Map(tagList.map(tag => [tag.id, tag]));
    const byFriend = new Map<string, LineTag[]>();
    (assignmentResult.data || []).forEach((row: any) => {
      const tag = tagMap.get(row.tag_id);
      if (tag) byFriend.set(row.line_friend_id, [...(byFriend.get(row.line_friend_id) || []), tag]);
    });
    setTags(tagList);
    setFriends(rawFriends.map((friend: any) => ({
      ...friend,
      contact: friend.contact_id ? contactMap.get(friend.contact_id) || null : null,
      tags: byFriend.get(friend.id) || [],
    })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleFriends = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter(friend =>
      [friend.display_name, friend.contact?.full_name, friend.contact?.email, friend.line_user_id, ...friend.tags.map(tag => tag.name)]
        .some(value => String(value || '').toLowerCase().includes(query))
    );
  }, [friends, search]);

  const toggleFriend = (id: string) => setSelectedFriends(current =>
    current.includes(id) ? current.filter(item => item !== id) : [...current, id]
  );
  const toggleTag = (id: string) => setSelectedTags(current =>
    current.includes(id) ? current.filter(item => item !== id) : [...current, id]
  );

  const createTag = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newTagName.trim();
    if (!name) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setNotice('');
    const { error: insertError } = await supabase.from('contact_tags').insert({ name });
    if (insertError) setError(insertError.message.includes('duplicate') ? '同じ名前のタグがすでにあります。' : insertError.message);
    else {
      setNewTagName('');
      setNotice('タグを作成しました。');
      await load();
    }
    setSaving(false);
  };

  const assignSelectedTags = async () => {
    if (!selectedFriends.length || !selectedTags.length) {
      setNotice('友だちとタグをそれぞれ選択してください。');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    const rows = selectedFriends.flatMap(lineFriendId => selectedTags.map(tagId => ({
      line_friend_id: lineFriendId,
      tag_id: tagId,
      assigned_by: 'operator',
    })));
    const { error: assignError } = await supabase.from('line_friend_tags')
      .upsert(rows, { onConflict: 'line_friend_id,tag_id', ignoreDuplicates: true });
    if (assignError) setError(assignError.message);
    else {
      setNotice(`${selectedFriends.length}人にタグを付与しました。`);
      setSelectedFriends([]);
      setSelectedTags([]);
      await load();
    }
    setSaving(false);
  };

  const removeTag = async (lineFriendId: string, tagId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error: removeError } = await supabase.from('line_friend_tags')
      .delete().eq('line_friend_id', lineFriendId).eq('tag_id', tagId);
    if (removeError) setError(removeError.message);
    else await load();
  };

  const deleteFriend = async (friendId: string, displayName?: string | null) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await supabase.from('line_friend_tags').delete().eq('line_friend_id', friendId);
      const { error: delErr } = await supabase.from('line_friends').delete().eq('id', friendId);
      if (delErr) throw delErr;
      setNotice(`LINE友だち「${displayName || friendId}」を削除しました。`);
      setSelectedFriends(prev => prev.filter(id => id !== friendId));
      await load();
    } catch (err: any) {
      setError(err.message || '友だちの削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const bulkDeleteSelectedFriends = async () => {
    if (!selectedFriends.length) return;
    const count = selectedFriends.length;
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      for (const friendId of selectedFriends) {
        await supabase.from('line_friend_tags').delete().eq('line_friend_id', friendId);
        await supabase.from('line_friends').delete().eq('id', friendId);
      }
      setNotice(`選択した ${count} 人のLINE友だちを完全削除しました。`);
      setSelectedFriends([]);
      await load();
    } catch (err: any) {
      setError(err.message || '一括削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel: Record<Friend['status'], string> = {
    active: '友だち', blocked: 'ブロック', unfollowed: '解除', unknown: '状態不明',
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">LINE友だち・タグ</h1>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300">受信・送信API未接続</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Webhookから取り込まれた友だちを連絡先に紐付け、タグで分類します。テスト用の友だちデータはいつでも削除できます。
            </p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />更新
          </button>
        </div>
      </section>

      {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-500/30 bg-rose-950/30 text-rose-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>{error || notice}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white"><Users className="h-4 w-4 text-emerald-400" />友だち一覧 <span className="text-xs font-normal text-slate-400">{friends.length}人</span></div>
            <div className="relative min-w-48 flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="名前・メール・タグで検索" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-500" />
            </div>
          </div>

          {selectedFriends.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-300 font-semibold">{selectedFriends.length}人選択</span>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`rounded-full border px-2.5 py-1 text-xs ${selectedTags.includes(tag.id) ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-slate-700 text-slate-400'}`}>{tag.name}</button>)}
                </div>
                <button onClick={() => void assignSelectedTags()} disabled={saving || !selectedTags.length} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{saving ? '処理中…' : '選択したタグを付与'}</button>
              </div>
              <InlineDeleteButton
                onConfirm={() => void bulkDeleteSelectedFriends()}
                warning={`選択した ${selectedFriends.length} 人のLINE友だちデータを完全削除しますか？`}
                confirmLabel="一括削除を実行"
                className="rounded-lg bg-rose-950/60 border border-rose-800/80 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 transition flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>選択した {selectedFriends.length} 人を一括削除</span>
              </InlineDeleteButton>
            </div>
          )}

          {loading ? <div className="flex items-center gap-2 p-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />読み込み中…</div>
            : visibleFriends.length === 0 ? <div className="p-10 text-center">
              <WifiOff className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm font-semibold text-slate-300">{friends.length ? '条件に一致する友だちはいません' : 'LINE友だちはまだ登録されていません'}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">友だち追加イベントの自動取込には、次段階でLINE Messaging APIのWebhookを接続します。</p>
            </div> : <div className="divide-y divide-slate-800">
              {visibleFriends.map(friend => <article key={friend.id} className="flex items-start gap-3 p-4">
                <input aria-label={`${friend.display_name || friend.line_user_id}を選択`} type="checkbox" checked={selectedFriends.includes(friend.id)} onChange={() => toggleFriend(friend.id)} className="mt-1 accent-emerald-500 cursor-pointer" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-white">{friend.contact?.full_name || friend.display_name || '名前未取得'}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${friend.status === 'active' ? 'bg-emerald-500/10 text-emerald-300' : friend.status === 'blocked' ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-800 text-slate-400'}`}>{statusLabel[friend.status]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${friend.consent_status === 'opted_in' ? 'bg-blue-500/10 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>配信同意: {friend.consent_status === 'opted_in' ? 'あり' : friend.consent_status === 'opted_out' ? 'なし' : '未確認'}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{friend.line_user_id}</p>
                  {friend.contact?.email && <p className="mt-1 text-xs text-slate-400">{friend.contact.email}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {friend.tags.map(tag => <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{tag.name}<button title={`タグ「${tag.name}」を外す`} onClick={() => void removeTag(friend.id, tag.id)} className="text-slate-500 hover:text-rose-300">×</button></span>)}
                    {!friend.tags.length && <span className="text-[10px] text-slate-600">タグなし</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden text-right text-[10px] text-slate-500 md:block">
                    <div>追加 {friend.followed_at ? new Date(friend.followed_at).toLocaleDateString() : '—'}</div>
                    <div className="mt-1">最終接触 {friend.last_message_at ? new Date(friend.last_message_at).toLocaleDateString() : '—'}</div>
                  </div>
                  <InlineDeleteButton
                    onConfirm={() => void deleteFriend(friend.id, friend.display_name || friend.line_user_id)}
                    warning={`LINE友だち「${friend.display_name || friend.line_user_id}」を削除しますか？`}
                    confirmLabel="削除確定"
                    className="p-1.5 rounded-lg border border-rose-800/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/50 hover:text-white transition flex items-center gap-1 text-xs"
                    ariaLabel="LINE友だちを削除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">削除</span>
                  </InlineDeleteButton>
                </div>
              </article>)}
            </div>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><Tag className="h-4 w-4 text-emerald-400" />タグ管理</div>
            <form onSubmit={createTag} className="flex gap-2">
              <input value={newTagName} onChange={event => setNewTagName(event.target.value)} maxLength={40} placeholder="新しいタグ名" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" />
              <button disabled={saving || !newTagName.trim()} className="rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map(tag => <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`rounded-full border px-2.5 py-1 text-xs ${selectedTags.includes(tag.id) ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-slate-700 bg-slate-950 text-slate-300'}`}>{tag.name}</button>)}
              {!tags.length && <p className="text-xs text-slate-500">タグはまだありません。</p>}
            </div>
            <p className="mt-4 text-[10px] leading-5 text-slate-500">タグの一括付与には、一覧で友だちを選択してからタグを選んでください。</p>
          </section>
          <section className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
            <h3 className="text-xs font-bold text-amber-200">現在の接続状態</h3>
            <p className="mt-2 text-xs leading-5 text-amber-100/70">この画面はSupabaseの友だち/タグを管理します。LINE webhook、個別チャット、一斉配信、Flex/画像送信、リッチメニューはまだ接続していません。</p>
          </section>
        </aside>
      </div>
    </div>
  );
};
