DROP POLICY IF EXISTS "Acesso backup importacoes" ON public.importacoes_backup;
CREATE POLICY operators_backup_all ON public.importacoes_backup FOR ALL TO authenticated
USING ((SELECT public.is_collection_operator())) WITH CHECK ((SELECT public.is_collection_operator()));