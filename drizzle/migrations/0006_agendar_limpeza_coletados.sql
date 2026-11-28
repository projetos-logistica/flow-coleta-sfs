CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('limpeza-coletados-expirados', '0 3 * * *', $cron$
WITH del AS (
  DELETE FROM public.pedidos p
  WHERE p.status_coleta = 'Coletado' AND p.coletado_at IS NOT NULL
    AND (SELECT count(*) FROM generate_series(date_trunc('day', p.coletado_at) + interval '1 day', date_trunc('day', now()), interval '1 day') d(d) WHERE extract(isodow FROM d.d) < 6) >= 2
  RETURNING p.numero_pedido
)
INSERT INTO public.historico_alteracoes (numero_pedido, usuario, campo, valor_anterior, valor_novo)
SELECT numero_pedido, 'Automação (limpeza)', 'Registro', 'Coletado', 'Excluído automaticamente (2 dias úteis coletado)' FROM del;
$cron$);