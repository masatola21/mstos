import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, RefreshCw, Search, Tag, UserRound, Wifi, WifiOff, Pencil, MessageCircle, Mail, Trash2, BookOpen, } from 'lucide-react';
import { fetchTableData, deleteTableRecord } from '../services/dataService';
import { getSupabase } from '../lib/supabaseClient';
import { RecordFormModal } from './RecordFormModal';
import { InlineDeleteButton } from './InlineDeleteButton';
import { UNIFIED_TAG_MASTER } from '../constants/tagMaster';
const statusLabel = {
    active: '友だち',
    blocked: 'ブロック',
    unfollowed: '解除',
    unknown: '未確認',
};
export const ContactsLineHub = ({ initialFilter = 'all', onOpenLineInbox, onOpenEmailSend, }) => {
    const [people, setPeople] = useState([]);
    const [tags, setTags] = useState([]);
    const [selectedPeople, setSelectedPeople] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState(initialFilter);
    const [selectedTagFilter, setSelectedTagFilter] = useState(null);
    const [tagCategoryFilter, setTagCategoryFilter] = useState('all');
    const [newTagName, setNewTagName] = useState('');
    const [topNewTagName, setTopNewTagName] = useState('');
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerCategory, setPickerCategory] = useState('all');
    const [pickerCustomTagName, setPickerCustomTagName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [editingContact, setEditingContact] = useState(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeTagPickerFriendId, setActiveTagPickerFriendId] = useState(null);
    const [deletingTagId, setDeletingTagId] = useState(null);
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
            if (contactResult.error)
                throw new Error(contactResult.error.message);
            const queryError = friendResult.error || tagResult.error || assignmentResult.error;
            if (queryError)
                throw new Error(queryError.message || '連絡先・LINE情報を読み込めませんでした。');
            const rawTags = (tagResult.data || []);
            const masterMap = new Map(UNIFIED_TAG_MASTER.map((m) => [m.name.toLowerCase(), m]));
            const tagList = rawTags.map((t) => {
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
            const tagsByFriend = new Map();
            (assignmentResult.data || []).forEach((assignment) => {
                const tag = tagById.get(assignment.tag_id);
                if (tag) {
                    tagsByFriend.set(assignment.line_friend_id, [
                        ...(tagsByFriend.get(assignment.line_friend_id) || []),
                        { ...tag, assigned_by: assignment.assigned_by || 'operator' },
                    ]);
                }
            });
            const contacts = (contactResult.data || []);
            const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
            const contactByLineId = new Map(contacts
                .filter((contact) => contact.line_user_id)
                .map((contact) => [contact.line_user_id, contact]));
            const friends = (friendResult.data || []).map((friend) => ({
                ...friend,
                tags: tagsByFriend.get(friend.id) || [],
            }));
            const friendsByContact = new Map();
            const unlinkedFriends = [];
            friends.forEach((friend) => {
                const linkedContact = (friend.contact_id ? contactById.get(friend.contact_id) : undefined) ||
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
            const contactPeople = contacts.map((contact) => ({
                id: contact.id,
                contact,
                name: contact.full_name || '名前未登録',
                email: contact.email,
                phone: contact.phone,
                companyName: contact.company?.company_name || null,
                lineFriends: friendsByContact.get(contact.id) || [],
            }));
            const lineOnlyPeople = unlinkedFriends.map((friend) => ({
                id: 'line-' + friend.id,
                name: friend.display_name || 'LINE友だち（連絡先未紐付け）',
                lineFriends: [friend],
            }));
            setPeople([...contactPeople, ...lineOnlyPeople]);
            setTags(tagList);
        }
        catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : '連絡先・LINE情報を読み込めませんでした。');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const tagCounts = useMemo(() => {
        const counts = new Map();
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
        if (!supabase)
            return;
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const existingNames = new Set(tags.map((t) => t.name.toLowerCase()));
            const missingMasterTags = UNIFIED_TAG_MASTER.filter((m) => !existingNames.has(m.name.toLowerCase()));
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
            if (insertErr)
                throw insertErr;
            setNotice(`共通タグ辞書から ${missingMasterTags.length} 件のタグをCRMに同期しました。`);
            await load();
        }
        catch (err) {
            setError('タグ辞書同期エラー: ' + (err.message || '同期に失敗しました'));
        }
        finally {
            setSaving(false);
        }
    };
    const visiblePeople = useMemo(() => {
        const query = search.trim().toLowerCase();
        return people.filter((person) => {
            if (filter === 'line' && !person.lineFriends.length)
                return false;
            if (filter === 'no-line' && person.lineFriends.length)
                return false;
            if (selectedTagFilter) {
                const hasSelectedTag = person.lineFriends.some((f) => f.tags.some((t) => t.id === selectedTagFilter));
                if (!hasSelectedTag)
                    return false;
            }
            if (!query)
                return true;
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
    const togglePerson = (id) => setSelectedPeople((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    const toggleTag = (id) => setSelectedTags((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    const createTagDirect = async (name, color, description) => {
        const trimmed = name.trim();
        if (!trimmed)
            return;
        const supabase = getSupabase();
        if (!supabase)
            return;
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
                throw new Error(insertError.message.includes('duplicate')
                    ? `タグ「${trimmed}」は既に存在します。`
                    : insertError.message);
            }
            setNotice(`タグ「${trimmed}」を作成しました。`);
            await load();
        }
        catch (err) {
            setError(err.message || 'タグ作成に失敗しました。');
        }
        finally {
            setSaving(false);
        }
    };
    const createTag = async (event) => {
        event.preventDefault();
        if (!newTagName.trim())
            return;
        await createTagDirect(newTagName);
        setNewTagName('');
    };
    const handleCreateTagTop = async (event) => {
        event.preventDefault();
        if (!topNewTagName.trim())
            return;
        await createTagDirect(topNewTagName);
        setTopNewTagName('');
    };
    const toggleTagOnFriend = async (friendId, tagId, currentHasTag, assignedBy = 'operator') => {
        const supabase = getSupabase();
        if (!supabase)
            return;
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
                if (delErr)
                    throw delErr;
                setNotice('タグを解除しました。');
            }
            else {
                const { error: insErr } = await supabase.from('line_friend_tags').upsert({ line_friend_id: friendId, tag_id: tagId, assigned_by: assignedBy }, { onConflict: 'line_friend_id,tag_id' });
                if (insErr)
                    throw insErr;
                setNotice('タグを手動付与しました。');
            }
            await load();
        }
        catch (err) {
            setError('タグ操作エラー: ' + (err.message || '処理に失敗しました'));
        }
        finally {
            setSaving(false);
        }
    };
    const assignOrToggleMasterTagToFriend = async (friendId, master) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
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
                if (tagErr)
                    throw tagErr;
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
            if (!targetTag)
                throw new Error('タグの取得に失敗しました。');
            // Check if friend already has this tag
            const friend = people.flatMap((p) => p.lineFriends).find((f) => f.id === friendId);
            const hasTag = friend?.tags.some((t) => t.id === targetTag.id) || false;
            await toggleTagOnFriend(friendId, targetTag.id, hasTag, 'operator');
        }
        catch (err) {
            setError('タグ操作エラー: ' + (err.message || '処理に失敗しました'));
        }
        finally {
            setSaving(false);
        }
    };
    const deleteTag = async (tagId, tagName) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        setSaving(true);
        setError('');
        setNotice('');
        try {
            await supabase.from('line_friend_tags').delete().eq('tag_id', tagId);
            const { error: delErr } = await supabase.from('contact_tags').delete().eq('id', tagId);
            if (delErr)
                throw delErr;
            setNotice(`タグ「${tagName}」を完全に削除しました。`);
            if (selectedTagFilter === tagId)
                setSelectedTagFilter(null);
            setSelectedTags((prev) => prev.filter((id) => id !== tagId));
            setDeletingTagId(null);
            await load();
        }
        catch (err) {
            setError('タグ削除エラー: ' + (err.message || '削除に失敗しました'));
        }
        finally {
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
        if (!supabase)
            return;
        setSaving(true);
        setError('');
        setNotice('');
        const rows = selectedFriends.flatMap((friend) => selectedTags.map((tagId) => ({
            line_friend_id: friend.id,
            tag_id: tagId,
            assigned_by: 'operator',
        })));
        const { error: assignError } = await supabase
            .from('line_friend_tags')
            .upsert(rows, { onConflict: 'line_friend_id,tag_id', ignoreDuplicates: true });
        if (assignError) {
            setError(assignError.message);
        }
        else {
            setNotice(selectedFriends.length + '件のLINE友だちにタグを手動付与しました。');
            setSelectedPeople([]);
            setSelectedTags([]);
            await load();
        }
        setSaving(false);
    };
    const removeTag = async (friendId, tagId) => {
        await toggleTagOnFriend(friendId, tagId, true);
    };
    const changeEmailConsent = async (contact, status) => {
        const currentStatus = String(contact.email_consent_status || 'unknown');
        if (currentStatus === status)
            return;
        const statusLabels = { unknown: '未確認', opted_in: '配信可', opted_out: '配信停止' };
        const supabase = getSupabase();
        if (!supabase)
            return;
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
        }
        else {
            setPeople((current) => current.map((person) => person.contact?.id === contact.id
                ? {
                    ...person,
                    contact: {
                        ...person.contact,
                        email_consent_status: status,
                        email_opted_out_at: optedOutAt,
                        email_opt_out_reason: optedOutReason,
                    },
                }
                : person));
            setNotice(`メール状態を「${statusLabels[status]}」に変更しました。`);
        }
        setSaving(false);
    };
    const deletePerson = async (person) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
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
                        throw new Error(`連絡先「${person.name}」の削除に失敗しました: ${res.error.message || directErr.message}`);
                    }
                }
            }
            setNotice(`「${person.name}」を削除しました。`);
            setSelectedPeople((prev) => prev.filter((id) => id !== person.id));
            await load();
        }
        catch (err) {
            setError(err.message || '削除中にエラーが発生しました。');
        }
        finally {
            setSaving(false);
        }
    };
    const bulkDeleteSelected = async () => {
        const targets = people.filter((p) => selectedPeople.includes(p.id));
        if (!targets.length)
            return;
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
        }
        catch (err) {
            setError('一括削除エラー: ' + (err.message || '処理に失敗しました'));
        }
        finally {
            setSaving(false);
        }
    };
    // Filter tags by category for filter pills
    const filteredTags = useMemo(() => {
        if (tagCategoryFilter === 'all')
            return tags;
        if (tagCategoryFilter === 'custom')
            return tags.filter((t) => t.category === 'custom');
        return tags.filter((t) => t.category === tagCategoryFilter);
    }, [tags, tagCategoryFilter]);
    // Combined master + custom tags for friend inline picker
    const pickerMasterItems = useMemo(() => {
        const query = pickerSearch.trim().toLowerCase();
        const existingMap = new Map(tags.map((t) => [t.name.toLowerCase(), t]));
        const items = [];
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
            if (pickerCategory !== 'all' && item.category !== pickerCategory)
                return false;
            if (!query)
                return true;
            return (item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query));
        });
    }, [tags, pickerSearch, pickerCategory]);
    return (_jsxs("div", { className: "space-y-6", children: [error && (_jsxs("div", { className: "rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center justify-between shadow-2xs", children: [_jsx("span", { children: error }), _jsx("button", { onClick: () => setError(''), className: "text-rose-500 hover:text-rose-700 cursor-pointer", children: "\u00D7" })] })), notice && (_jsxs("div", { className: "rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800 flex items-center justify-between shadow-2xs", children: [_jsx("span", { children: notice }), _jsx("button", { onClick: () => setNotice(''), className: "text-purple-500 hover:text-purple-700 cursor-pointer", children: "\u00D7" })] })), _jsxs("section", { className: "flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u9023\u7D61\u5148\u30FBLINE\u53CB\u3060\u3061\u53F0\u5E33" }), _jsx("span", { className: "rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-700", children: "\u30BF\u30B0\u8F9E\u66F8\u9023\u52D5" })] }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "CRM\u9023\u7D61\u5148\u3068LINE\u516C\u5F0F\u30A2\u30AB\u30A6\u30F3\u30C8\u53CB\u3060\u3061\u3092\u4E00\u5143\u7BA1\u7406\u3002\u30BF\u30B0\u4ED8\u4E0E\u3067\u81EA\u52D5\u914D\u4FE1\u3068\u5546\u8AC7\u9032\u6357\u304C\u9023\u52D5\u3057\u307E\u3059\u3002" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("button", { onClick: () => void syncMasterTags(), disabled: saving, title: "\u30DE\u30FC\u30B1\u30C6\u30A3\u30F3\u30B0\u914D\u4FE1\u5171\u901A\u30BF\u30B0\u8F9E\u66F8\uFF08\u516816\u7A2E\uFF09\u3092\u4E00\u62EC\u540C\u671F\u3057\u307E\u3059", className: "flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer disabled:opacity-40 shadow-2xs", children: [_jsx(BookOpen, { className: "h-3.5 w-3.5" }), _jsxs("span", { children: ["\u30BF\u30B0\u8F9E\u66F8\u5168\u540C\u671F (", tags.length, "/16)"] })] }), _jsxs("button", { onClick: () => setIsCreateOpen(true), className: "flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 transition cursor-pointer shadow-xs", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u9023\u7D61\u5148\u3092\u8FFD\u52A0" })] }), _jsx("button", { onClick: () => void load(), disabled: loading, className: "rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer disabled:opacity-50 shadow-2xs", title: "\u518D\u8AAD\u307F\u8FBC\u307F", children: _jsx(RefreshCw, { className: `h-4 w-4 ${loading ? 'animate-spin' : ''}` }) })] })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white shadow-xs", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-4 rounded-t-2xl", children: [_jsxs("div", { className: "relative min-w-48 flex-1 sm:max-w-xs", children: [_jsx(Search, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" }), _jsx("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "\u6C0F\u540D\u30FB\u4F1A\u793E\u30FB\u30E1\u30FC\u30EB\u30FB\u96FB\u8A71\u30FB\u30BF\u30B0\u3067\u691C\u7D22", className: "w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs placeholder:text-slate-400" })] }), _jsx("div", { className: "flex gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200", children: [
                                    ['all', `すべて (${people.length})`],
                                    [
                                        'line',
                                        `LINE友だちのみ (${people.filter((p) => p.lineFriends.length > 0).length})`,
                                    ],
                                    [
                                        'no-line',
                                        `LINE未連携 (${people.filter((p) => p.lineFriends.length === 0).length})`,
                                    ],
                                ].map(([value, label]) => (_jsx("button", { onClick: () => setFilter(value), className: 'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ' +
                                        (filter === value
                                            ? 'bg-white font-bold text-purple-700 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'), children: label }, value))) })] }), _jsxs("div", { className: "border-b border-slate-200 bg-white px-4 py-2.5 text-xs space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-slate-700 font-semibold shrink-0", children: [_jsx(Tag, { className: "h-3.5 w-3.5 text-purple-600" }), _jsx("span", { children: "\u30BF\u30B0\u8F9E\u66F8\u7D5E\u308A\u8FBC\u307F:" })] }), _jsx("div", { className: "flex flex-wrap items-center gap-1", children: [
                                            { key: 'all', label: 'すべて' },
                                            { key: 'inflow', label: '📌 流入・選択' },
                                            { key: 'action', label: '🚀 行動・進捗' },
                                            { key: 'crm_status', label: '💼 CRM・停止条件' },
                                            { key: 'custom', label: '🏷️ 独自タグ' },
                                        ].map((cat) => (_jsx("button", { type: "button", onClick: () => setTagCategoryFilter(cat.key), className: `px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${tagCategoryFilter === cat.key
                                                ? 'bg-purple-50 text-purple-700 border border-purple-200 font-bold'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`, children: cat.label }, cat.key))) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-1.5 pt-1", children: [_jsxs("button", { type: "button", onClick: () => setSelectedTagFilter(null), className: `rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${selectedTagFilter === null
                                            ? 'bg-purple-600 text-white font-bold shadow-xs'
                                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`, children: ["\u5168\u30BF\u30B0\u8868\u793A (", people.length, ")"] }), filteredTags.map((tag) => {
                                        const count = tagCounts.get(tag.id) || 0;
                                        const isSelected = selectedTagFilter === tag.id;
                                        const isDeleting = deletingTagId === tag.id;
                                        return (_jsxs("div", { className: "inline-flex items-center", children: [_jsxs("button", { type: "button", onClick: () => setSelectedTagFilter(isSelected ? null : tag.id), title: `「${tag.name}」タグで絞り込み ${tag.description ? '— ' + tag.description : ''}`, className: `rounded-l-full border-y border-l px-2.5 py-1 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${isSelected
                                                        ? 'border-purple-300 bg-purple-50 text-purple-800 font-bold shadow-xs'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`, children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full", style: { backgroundColor: tag.color || '#6b46c1' } }), _jsx("span", { children: tag.name }), _jsx("span", { className: `text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected
                                                                ? 'bg-purple-200 text-purple-900'
                                                                : 'bg-slate-100 text-slate-600'}`, children: count })] }), isDeleting ? (_jsxs("div", { className: "inline-flex items-center rounded-r-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-800 gap-1", children: [_jsx("span", { children: "\u524A\u9664?" }), _jsx("button", { type: "button", onClick: () => void deleteTag(tag.id, tag.name), className: "font-bold text-rose-700 hover:underline cursor-pointer", children: "\u306F\u3044" }), _jsx("button", { type: "button", onClick: () => setDeletingTagId(null), className: "text-slate-500 hover:text-slate-800 ml-1 cursor-pointer", children: "\u3044\u3044\u3048" })] })) : (_jsx("button", { type: "button", title: `タグ「${tag.name}」を削除`, onClick: () => setDeletingTagId(tag.id), className: `rounded-r-full border px-1.5 py-1 text-xs transition cursor-pointer ${isSelected
                                                        ? 'border-purple-300 bg-purple-100 text-purple-800 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300'
                                                        : 'border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'}`, children: _jsx(Trash2, { className: "h-3 w-3" }) }))] }, tag.id));
                                    }), _jsxs("form", { onSubmit: handleCreateTagTop, className: "inline-flex items-center gap-1.5 ml-auto", children: [_jsx("input", { value: topNewTagName, onChange: (e) => setTopNewTagName(e.target.value), placeholder: "\uFF0B\u65B0\u898F\u30BF\u30B0\u540D...", className: "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 w-28 sm:w-36 shadow-2xs" }), _jsxs("button", { type: "submit", disabled: saving || !topNewTagName.trim(), className: "rounded-lg bg-purple-600 hover:bg-purple-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer transition flex items-center gap-1 shadow-2xs", children: [_jsx(Plus, { className: "h-3 w-3" }), _jsx("span", { children: "\u4F5C\u6210" })] })] })] })] }), selectedTagFilter && (_jsxs("div", { className: "flex items-center justify-between border-b border-purple-200 bg-purple-50/70 px-4 py-2 text-xs text-purple-900", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "font-bold", children: ["\uD83C\uDFF7\uFE0F \u30BF\u30B0\u300C", tags.find((t) => t.id === selectedTagFilter)?.name, "\u300D\u3067\u7D5E\u308A\u8FBC\u307F\u4E2D:"] }), _jsxs("span", { children: [visiblePeople.length, " \u4EF6\u304C\u8A72\u5F53"] })] }), _jsx("button", { type: "button", onClick: () => setSelectedTagFilter(null), className: "text-xs text-purple-700 hover:text-purple-900 underline cursor-pointer font-medium", children: "\u7D5E\u308A\u8FBC\u307F\u3092\u89E3\u9664" })] })), selectedPeople.length > 0 && (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-purple-50/40 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("span", { className: "text-xs text-slate-800 font-bold", children: [selectedPeople.length, "\u4EBA\u9078\u629E\u4E2D"] }), _jsx("div", { className: "flex flex-wrap gap-2 max-h-24 overflow-y-auto", children: tags.map((tag) => (_jsx("button", { onClick: () => toggleTag(tag.id), className: 'rounded-full border px-2.5 py-1 text-xs cursor-pointer ' +
                                                (selectedTags.includes(tag.id)
                                                    ? 'border-purple-300 bg-purple-100 text-purple-800 font-bold'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'), children: tag.name }, tag.id))) }), _jsx("button", { onClick: () => void assignSelectedTags(), disabled: saving || !selectedTags.length, className: "rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer shadow-xs", children: saving ? '処理中…' : '選択したLINEにタグ付与' })] }), _jsx("div", { children: _jsxs(InlineDeleteButton, { onConfirm: () => void bulkDeleteSelected(), warning: `選択した ${selectedPeople.length} 件のデータ（連絡先・LINE連携）を完全に削除しますか？`, confirmLabel: "\u4E00\u62EC\u524A\u9664\u3092\u5B9F\u884C", className: "rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition flex items-center gap-1.5 cursor-pointer shadow-2xs", children: [_jsx(Trash2, { className: "h-3.5 w-3.5" }), _jsxs("span", { children: ["\u9078\u629E\u3057\u305F ", selectedPeople.length, " \u4EF6\u3092\u4E00\u62EC\u524A\u9664"] })] }) })] })), loading ? (_jsxs("div", { className: "flex items-center justify-center gap-2 p-12 text-sm text-slate-500", children: [_jsx(Loader2, { className: "h-5 w-5 animate-spin text-purple-600" }), _jsx("span", { children: "\u9023\u7D61\u5148\u30FBLINE\u53CB\u3060\u3061\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" })] })) : visiblePeople.length === 0 ? (_jsxs("div", { className: "p-12 text-center space-y-3", children: [_jsx(WifiOff, { className: "mx-auto h-8 w-8 text-slate-400" }), _jsx("p", { className: "text-sm font-bold text-slate-800", children: people.length ? '条件に一致する人はいません' : '連絡先はまだ登録されていません' }), _jsx("p", { className: "text-xs leading-5 text-slate-500 max-w-md mx-auto", children: "\u9023\u7D61\u5148\u306F\u624B\u52D5\u767B\u9332\u3084\u8A3A\u65AD\u30FB\u76F8\u8AC7\u53D7\u4ED8\u30D5\u30A9\u30FC\u30E0\u304B\u3089\u767B\u9332\u3067\u304D\u307E\u3059\u3002LINE\u53CB\u3060\u3061\u306F\u53CB\u3060\u3061\u8FFD\u52A0\u6642\u306B\u81EA\u52D5\u3067\u7D10\u4ED8\u304D\u307E\u3059\u3002" })] })) : (_jsx("div", { className: "divide-y divide-slate-100", children: visiblePeople.map((person) => {
                            const hasActivePicker = person.lineFriends.some((f) => f.id === activeTagPickerFriendId);
                            return (_jsxs("article", { className: `flex flex-wrap items-start gap-3 p-4 transition hover:bg-slate-50/60 ${hasActivePicker ? 'relative z-30 bg-purple-50/30' : 'relative z-0'}`, children: [_jsx("input", { "aria-label": person.name + 'を選択', type: "checkbox", checked: selectedPeople.includes(person.id), onChange: () => togglePerson(person.id), className: "mt-1 accent-purple-600 cursor-pointer" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("h2", { className: "truncate text-sm font-bold text-slate-900", children: person.name }), person.lineFriends.length ? (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700", children: [_jsx(Wifi, { className: "h-3 w-3" }), "LINE\u9023\u643A ", person.lineFriends.length] })) : (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500", children: [_jsx(WifiOff, { className: "h-3 w-3" }), "LINE\u672A\u9023\u643A"] })), person.companyName && (_jsx("span", { className: "rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-medium text-slate-700", children: person.companyName }))] }), _jsxs("div", { className: "mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500", children: [person.email && _jsx("span", { children: person.email }), person.phone && _jsx("span", { children: person.phone })] }), person.contact && (_jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "text-[11px] text-slate-500 font-medium", children: "\u30E1\u30FC\u30EB\u914D\u4FE1\u72B6\u614B:" }), _jsxs("select", { "aria-label": person.name + 'のメール配信状態', value: String(person.contact.email_consent_status || 'unknown'), onChange: (event) => void changeEmailConsent(person.contact, event.target.value), disabled: saving, className: "rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 disabled:opacity-50 outline-none focus:border-purple-500 shadow-2xs cursor-pointer", children: [_jsx("option", { value: "unknown", children: "\u672A\u78BA\u8A8D" }), _jsx("option", { value: "opted_in", children: "\u914D\u4FE1\u53EF" }), _jsx("option", { value: "opted_out", children: "\u914D\u4FE1\u505C\u6B62" })] })] })), person.lineFriends.map((friend) => (_jsxs("div", { className: `mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 transition shadow-2xs ${activeTagPickerFriendId === friend.id ? 'relative z-20 ring-2 ring-purple-500/20 bg-white' : ''}`, children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-bold text-slate-700", children: [_jsx(UserRound, { className: "h-3.5 w-3.5 text-emerald-600" }), "LINE ", statusLabel[friend.status] || friend.status] }), _jsx("span", { className: "text-xs text-slate-900 font-semibold", children: friend.display_name || '名前未取得' })] }), _jsxs(InlineDeleteButton, { onConfirm: async () => {
                                                                    const supabase = getSupabase();
                                                                    if (!supabase)
                                                                        return;
                                                                    setSaving(true);
                                                                    try {
                                                                        await supabase
                                                                            .from('line_friend_tags')
                                                                            .delete()
                                                                            .eq('line_friend_id', friend.id);
                                                                        await supabase.from('line_friends').delete().eq('id', friend.id);
                                                                        setNotice('LINE友だち連携を解除しました。');
                                                                        await load();
                                                                    }
                                                                    catch (e) {
                                                                        setError(e.message || '解除に失敗しました。');
                                                                    }
                                                                    finally {
                                                                        setSaving(false);
                                                                    }
                                                                }, warning: `「${friend.display_name || friend.line_user_id}」のLINE友だち連携を解除しますか？`, confirmLabel: "\u524A\u9664\u78BA\u5B9A", className: "flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer", ariaLabel: "LINE\u53CB\u3060\u3061\u9023\u643A\u3092\u89E3\u9664", children: [_jsx(Trash2, { className: "h-3 w-3" }), _jsx("span", { className: "text-[10px]", children: "LINE\u89E3\u9664" })] })] }), _jsx("p", { className: "mt-1 truncate font-mono text-[10px] text-slate-400", children: friend.line_user_id }), _jsxs("div", { className: "mt-2.5 flex flex-wrap items-center gap-1.5", children: [friend.tags.map((tag) => {
                                                                const isAuto = tag.assigned_by === 'automation' ||
                                                                    tag.assigned_by === 'welcome_choice';
                                                                return (_jsxs("span", { style: { borderColor: tag.color ? `${tag.color}40` : undefined }, className: "inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 text-[11px] text-slate-800 transition shadow-2xs", title: `${tag.name} (${isAuto ? '⚡ 自動配信・ルールにより自動付与' : '👤 手動付与'}) ${tag.description ? '— ' + tag.description : ''}`, children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full shrink-0", style: { backgroundColor: tag.color || '#6b46c1' } }), _jsx("span", { className: "font-semibold text-slate-800", children: tag.name }), _jsx("span", { className: `text-[9px] font-mono px-1 rounded ${isAuto
                                                                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                                                : 'bg-slate-100 text-slate-600'}`, children: isAuto ? '⚡自動' : '👤手動' }), _jsx("button", { type: "button", title: 'タグ「' + tag.name + '」を外す', onClick: () => void removeTag(friend.id, tag.id), className: "text-slate-400 hover:text-rose-600 ml-0.5 cursor-pointer transition text-xs font-bold", children: "\u00D7" })] }, tag.id));
                                                            }), _jsxs("div", { className: `relative ${activeTagPickerFriendId === friend.id ? 'z-30' : ''}`, children: [_jsxs("button", { type: "button", onClick: () => setActiveTagPickerFriendId(activeTagPickerFriendId === friend.id ? null : friend.id), className: "inline-flex items-center gap-1 rounded-full border border-dashed border-purple-300 bg-purple-50/70 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer", children: [_jsx(Tag, { className: "h-2.5 w-2.5" }), _jsx("span", { children: "\uFF0B\u30BF\u30B0\u8FFD\u52A0" })] }), activeTagPickerFriendId === friend.id && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[0.5px]", onClick: () => setActiveTagPickerFriendId(null) }), _jsxs("div", { className: "absolute left-0 top-full z-50 mt-1.5 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl space-y-2.5", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-2", children: [_jsxs("div", { className: "text-xs font-bold text-slate-900 flex items-center gap-1.5", children: [_jsx(Tag, { className: "h-3.5 w-3.5 text-purple-600" }), _jsx("span", { children: "\u4ED8\u4E0E\u3059\u308B\u30BF\u30B0\u3092\u9078\u629E\uFF08\u5171\u901A\u8F9E\u66F8\u9023\u643A\uFF09" })] }), _jsx("button", { type: "button", onClick: () => setActiveTagPickerFriendId(null), className: "text-slate-400 hover:text-slate-700 text-xs cursor-pointer", children: "\u00D7" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("input", { type: "text", value: pickerSearch, onChange: (e) => setPickerSearch(e.target.value), placeholder: "\u30BF\u30B0\u540D\u3084\u8AAC\u660E\u3067\u691C\u7D22...", className: "w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 shadow-inner" }), _jsx("div", { className: "flex flex-wrap gap-1", children: [
                                                                                                    { key: 'all', label: 'すべて' },
                                                                                                    { key: 'inflow', label: '📌 流入・選択' },
                                                                                                    { key: 'action', label: '🚀 行動・進捗' },
                                                                                                    { key: 'crm_status', label: '💼 CRM・停止' },
                                                                                                ].map((cat) => (_jsx("button", { type: "button", onClick: () => setPickerCategory(cat.key), className: `px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition ${pickerCategory === cat.key
                                                                                                        ? 'bg-purple-600 text-white font-bold shadow-xs'
                                                                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`, children: cat.label }, cat.key))) })] }), _jsxs("div", { className: "max-h-56 overflow-y-auto space-y-1 pr-1", children: [pickerMasterItems.map((item) => {
                                                                                                const hasTag = friend.tags.some((t) => t.name.toLowerCase() === item.name.toLowerCase());
                                                                                                return (_jsxs("button", { type: "button", onClick: async () => {
                                                                                                        const master = UNIFIED_TAG_MASTER.find((m) => m.name.toLowerCase() === item.name.toLowerCase());
                                                                                                        if (master) {
                                                                                                            await assignOrToggleMasterTagToFriend(friend.id, master);
                                                                                                        }
                                                                                                        else if (item.dbId) {
                                                                                                            await toggleTagOnFriend(friend.id, item.dbId, hasTag);
                                                                                                        }
                                                                                                    }, className: `w-full text-left p-1.5 rounded-lg text-xs flex items-center justify-between transition cursor-pointer border ${hasTag
                                                                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                                                                        : 'border-slate-100 bg-white text-slate-700 hover:bg-purple-50/50 hover:text-purple-900'}`, children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2 h-2 rounded-full shrink-0", style: { backgroundColor: item.color } }), _jsx("span", { className: "font-bold text-slate-800", children: item.name }), _jsx("span", { className: "text-[9px] px-1 rounded bg-slate-100 text-slate-500", children: item.categoryLabel })] }), item.description && (_jsx("p", { className: "truncate text-[10px] text-slate-500 mt-0.5", children: item.description }))] }), _jsx("div", { className: "shrink-0 ml-2", children: hasTag ? (_jsxs("span", { className: "inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200", children: [_jsx(Check, { className: "h-3 w-3" }), "\u4ED8\u4E0E\u6E08"] })) : (_jsx("span", { className: "text-[10px] font-bold text-purple-600 hover:underline", children: "\uFF0B\u4ED8\u4E0E" })) })] }, item.name));
                                                                                            }), pickerMasterItems.length === 0 && (_jsx("div", { className: "text-center py-4 text-xs text-slate-400", children: "\u4E00\u81F4\u3059\u308B\u30BF\u30B0\u304C\u3042\u308A\u307E\u305B\u3093" }))] }), _jsxs("div", { className: "border-t border-slate-100 pt-2 flex items-center gap-1.5", children: [_jsx("input", { type: "text", value: pickerCustomTagName, onChange: (e) => setPickerCustomTagName(e.target.value), placeholder: "\u65B0\u3057\u3044\u72EC\u81EA\u30BF\u30B0\u3092\u5165\u529B...", className: "flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 shadow-2xs" }), _jsx("button", { type: "button", disabled: !pickerCustomTagName.trim() || saving, onClick: async () => {
                                                                                                    if (!pickerCustomTagName.trim())
                                                                                                        return;
                                                                                                    await createTagDirect(pickerCustomTagName.trim());
                                                                                                    setPickerCustomTagName('');
                                                                                                }, className: "rounded-lg bg-purple-600 hover:bg-purple-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer shadow-2xs", children: "\u4F5C\u6210" })] })] })] }))] })] })] }, friend.id))), !person.contact && (_jsx("p", { className: "mt-2 text-xs text-amber-600 font-medium", children: "\u9023\u7D61\u5148\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u672A\u7D10\u4ED8\u3051" }))] }), _jsxs("div", { className: "flex shrink-0 flex-wrap items-center gap-2", children: [person.contact && person.email && (_jsxs("button", { onClick: () => onOpenEmailSend?.(person.contact.id, person.contact.company_id || undefined), className: "flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer transition shadow-2xs", children: [_jsx(Mail, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u30E1\u30FC\u30EB\u4F5C\u6210" })] })), person.contact &&
                                                person.lineFriends.map((friend) => (_jsxs("button", { onClick: () => onOpenLineInbox?.(person.contact.id, friend.line_user_id), className: "flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 cursor-pointer transition shadow-2xs", children: [_jsx(MessageCircle, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "LINE\u53D7\u4FE1\u7BB1" })] }, friend.id))), person.contact && (_jsxs("button", { onClick: () => setEditingContact(person.contact || null), className: "flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition shadow-2xs", children: [_jsx(Pencil, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u7DE8\u96C6" })] })), _jsxs(InlineDeleteButton, { onConfirm: () => void deletePerson(person), warning: `「${person.name}」を削除しますか？`, confirmLabel: "\u524A\u9664\u78BA\u5B9A", className: "flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs", ariaLabel: `「${person.name}」を削除`, children: [_jsx(Trash2, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u524A\u9664" })] })] })] }, person.id));
                        }) }))] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-bold text-slate-900", children: [_jsx(Tag, { className: "h-4 w-4 text-purple-600" }), _jsx("span", { children: "\u914D\u4FE1\u30FBCRM\u5171\u901A\u30BF\u30B0\u8F9E\u66F8\uFF08UNIFIED_TAG_MASTER\uFF09" })] }), _jsxs("button", { type: "button", onClick: () => void syncMasterTags(), disabled: saving, className: "flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer disabled:opacity-40 shadow-2xs", children: [_jsx(RefreshCw, { className: `h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}` }), _jsx("span", { children: "\u8F9E\u66F8\u516816\u7A2E\u3092\u4E00\u62EC\u540C\u671F" })] })] }), _jsx("p", { className: "text-xs leading-5 text-slate-500", children: "\u30DE\u30FC\u30B1\u30C6\u30A3\u30F3\u30B0\u914D\u4FE1\uFF08\u30B9\u30C6\u30C3\u30D7\u914D\u4FE1\u30FB\u81EA\u52D5\u8FD4\u4FE1\u30FB\u8A3A\u65AD\u30D5\u30A9\u30FC\u30E0\uFF09\u3068\u9023\u7D61\u5148\u53F0\u5E33\u3067\u540C\u3058\u8F9E\u66F8\u3092\u5171\u6709\u3057\u307E\u3059\u3002 \u4E0B\u306E\u5404\u30BF\u30B0\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u9078\u629E\u3057\u3001\u4E0A\u306E\u300C\u9078\u629E\u3057\u305FLINE\u306B\u30BF\u30B0\u4ED8\u4E0E\u300D\u3067\u4E00\u62EC\u53CD\u6620\u3067\u304D\u307E\u3059\u3002" }), _jsx("div", { className: "space-y-3", children: [
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
                                    return (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-bold text-slate-800", children: section.label }), _jsx("span", { className: "text-[10px] text-slate-400 font-medium", children: section.desc })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [sectionTags.map((tag) => (_jsxs("button", { type: "button", onClick: () => toggleTag(tag.id), className: `rounded-full border px-2.5 py-1 text-xs transition cursor-pointer flex items-center gap-1.5 ${selectedTags.includes(tag.id)
                                                            ? 'border-purple-300 bg-purple-100 text-purple-800 font-bold'
                                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`, title: tag.description || '', children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full", style: { backgroundColor: tag.color || '#6b46c1' } }), _jsx("span", { children: tag.name }), tag.isExitConditionDefault && (_jsx("span", { className: "text-[9px] px-1 rounded bg-amber-100 text-amber-800 border border-amber-200 font-semibold", children: "\u505C\u6B62\u6761\u4EF6" }))] }, tag.id))), !sectionTags.length && (_jsx("span", { className: "text-xs text-slate-400 italic", children: "\u672A\u540C\u671F\uFF08\u300C\u8F9E\u66F8\u516816\u7A2E\u3092\u4E00\u62EC\u540C\u671F\u300D\u3092\u62BC\u3059\u3068\u767B\u9332\u3055\u308C\u307E\u3059\uFF09" }))] })] }, section.category));
                                }) }), _jsxs("form", { onSubmit: createTag, className: "flex gap-2 pt-2", children: [_jsx("input", { value: newTagName, onChange: (event) => setNewTagName(event.target.value), maxLength: 40, placeholder: "\u65B0\u3057\u3044\u72EC\u81EA\u30BF\u30B0\u540D\u3092\u5165\u529B", className: "min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs placeholder:text-slate-400" }), _jsx("button", { disabled: saving || !newTagName.trim(), className: "rounded-lg bg-purple-600 hover:bg-purple-700 px-3 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer shadow-2xs transition", children: saving ? _jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : _jsx(Check, { className: "h-4 w-4" }) })] })] }), _jsxs("aside", { className: "rounded-2xl border border-purple-200 bg-purple-50/30 p-5 space-y-4 shadow-xs", children: [_jsx("div", { className: "flex items-center gap-2", children: _jsx("h3", { className: "text-xs font-bold text-purple-900", children: "\u30BF\u30B0\u8F9E\u66F8\u3068\u81EA\u52D5\u914D\u4FE1\u306E\u4ED5\u69D8" }) }), _jsxs("div", { className: "space-y-3 text-xs text-slate-600 leading-relaxed", children: [_jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs", children: [_jsxs("div", { className: "font-bold text-amber-700 flex items-center gap-1", children: [_jsx("span", { children: "\u26A1" }), " \u81EA\u52D5\u914D\u4FE1\u306E\u5F79\u5272"] }), _jsx("p", { className: "text-[11px] text-slate-500", children: "LINE\u767B\u9332\u6642\u3084\u8A3A\u65AD\u56DE\u7B54\u5B8C\u4E86\u6642\u3001\u9078\u629E\u80A2\u30AF\u30EA\u30C3\u30AF\u6642\u306B\u30BF\u30B0\u3092\u81EA\u52D5\u4ED8\u4E0E\u3002 \u300C\u6210\u7D04\u300D\u300C\u4E88\u7D04\u6E08\u300D\u30BF\u30B0\u304C\u4ED8\u3044\u305F\u5834\u5408\u306F\u3001\u30B9\u30C6\u30C3\u30D7\u914D\u4FE1\u3084\u30EA\u30DE\u30A4\u30F3\u30C9\u3092\u81EA\u52D5\u3067\u7D42\u4E86\uFF08Exit\uFF09\u3055\u305B\u307E\u3059\u3002" })] }), _jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs", children: [_jsxs("div", { className: "font-bold text-emerald-700 flex items-center gap-1", children: [_jsx("span", { children: "\uD83D\uDC64" }), " \u53CB\u3060\u3061\u53F0\u5E33\u306E\u5F79\u5272"] }), _jsx("p", { className: "text-[11px] text-slate-500", children: "\u30AA\u30DA\u30EC\u30FC\u30BF\u30FC\u304C\u9867\u5BA2\u3068\u306E\u500B\u5225\u5546\u8AC7\u3084\u30D2\u30A2\u30EA\u30F3\u30B0\u7D50\u679C\u3092\u898B\u3066\u624B\u52D5\u3067\u30BF\u30B0\u4ED8\u3051\u3002 \u624B\u52D5\u3067\u4ED8\u4E0E\u3057\u305F\u30BF\u30B0\u3082\u81EA\u52D5\u914D\u4FE1\u306E\u505C\u6B62\u6761\u4EF6\u306B\u5373\u5EA7\u306B\u53CD\u6620\u3055\u308C\u307E\u3059\u3002" })] }), _jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs", children: [_jsxs("div", { className: "font-bold text-purple-700 flex items-center gap-1", children: [_jsx("span", { children: "\uD83D\uDCD6" }), " \u5171\u901A\u8F9E\u66F8\u306E\u5F79\u5272"] }), _jsx("p", { className: "text-[11px] text-slate-500", children: "\u914D\u4FE1\u5074\u3068\u53F0\u5E33\u5074\u3067\u540C\u3058\u30BF\u30B0\u540D\u30FB\u30AB\u30E9\u30FC\u30FB\u5206\u985E\u3092\u5171\u6709\u3059\u308B\u3053\u3068\u3067\u3001\u8868\u8A18\u63FA\u308C\u3092\u9632\u304E\u3001\u8AB0\u3067\u3082\u8FF7\u308F\u305A\u6B63\u78BA\u306A\u9867\u5BA2\u7BA1\u7406\u30FB\u914D\u4FE1\u30BF\u30FC\u30B2\u30C6\u30A3\u30F3\u30B0\u3092\u884C\u3048\u307E\u3059\u3002" })] })] })] })] }), (isCreateOpen || editingContact) && (_jsx(RecordFormModal, { isOpen: true, tableKey: 'contacts', editRecord: editingContact, onClose: () => {
                    setIsCreateOpen(false);
                    setEditingContact(null);
                }, onSuccess: () => {
                    setIsCreateOpen(false);
                    setEditingContact(null);
                    void load();
                } }))] }));
};
