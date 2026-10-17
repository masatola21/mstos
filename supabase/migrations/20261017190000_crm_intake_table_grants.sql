-- Ensure authenticated CRM workspace clients can access intake and LINE tables through PostgREST.
-- RLS policies remain responsible for row-level access; this grants only table-level API privileges.
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.contacts,
  public.line_friends,
  public.contact_tags,
  public.line_friend_tags,
  public.diagnosis_forms,
  public.diagnosis_submissions,
  public.crm_ingestion_events
TO authenticated;

NOTIFY pgrst, 'reload schema';
