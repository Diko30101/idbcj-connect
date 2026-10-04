-- Migration: Payagan ang pagbura ng DRAFT na Ambagan/Tulong/Pasalamat records.
--
-- Ang mga "Burahin" button sa portal ay laging nag-e-error ("Hindi nabura. Subukan ulit.")
-- dahil ang RLS ay nag-grant lang ng SELECT, INSERT, UPDATE — walang DELETE.
--
-- Patakaran: ang may access sa local ay puwedeng magbura ng DRAFT na record.
-- Ang naipadala (submitted) o na-void ay hindi puwedeng burahin dito.
-- Ang church-wide Finance ay sakop na rin ng can_access_local.

DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY array['ambagan_records', 'tulong_klase_records', 'pasalamat_records']
  LOOP
    pol := t || '_delete';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = pol
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_access_local(local_id) AND status = ''draft'')',
        pol, t
      );
    END IF;
    EXECUTE format('GRANT DELETE ON public.%I TO authenticated', t);
  END LOOP;
END
$$;
