alter table public.email_send_settings
  alter column sender_name set default '有限会社MST｜経営・業務改善支援';

update public.email_send_settings
set sender_name = '有限会社MST｜経営・業務改善支援'
where sender_name = '有限会社MST'
  and sender_email = 'contact@mstcorp.info'
  and reply_to_email = 'mst.shikumikaizen@gmail.com';
