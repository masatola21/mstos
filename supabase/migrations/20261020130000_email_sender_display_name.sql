alter table public.email_send_settings
  alter column sender_name set default '有限会社MST｜経営の仕組化×利益改善';

update public.email_send_settings
set sender_name = '有限会社MST｜経営の仕組化×利益改善'
where sender_name = '有限会社MST'
  and sender_email = 'contact@mstcorp.info'
  and reply_to_email = 'mst.shikumikaizen@gmail.com';
