ALTER TABLE public.importacoes_backup ADD COLUMN IF NOT EXISTS dados_snapshot_json json;
ALTER TABLE public.importacoes_backup ALTER COLUMN dados_snapshot SET DEFAULT '[]'::jsonb;
CREATE OR REPLACE FUNCTION public.criar_backup_importacao(p_criado_por text, p_nome_arquivo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_collection_operator() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  INSERT INTO public.importacoes_backup(criado_por, nome_arquivo, total_pedidos, dados_snapshot, dados_snapshot_json)
  SELECT COALESCE(NULLIF(p_criado_por,''),'Sistema'), p_nome_arquivo, count(*), '[]'::jsonb, COALESCE(json_agg(p), '[]'::json)
  FROM public.pedidos p
  RETURNING id INTO v_id;
  DELETE FROM public.importacoes_backup
  WHERE id NOT IN (SELECT id FROM public.importacoes_backup ORDER BY created_at DESC LIMIT 2);
  RETURN v_id;
END;
$$;