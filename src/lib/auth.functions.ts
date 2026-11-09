import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const verificarEmailExiste = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    if (!/^[^@]+@(somagrupo\.com\.br|usereserva\.com)$/i.test(data.email)) throw new Error("E-mail corporativo obrigatório.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existe, error } = await supabaseAdmin.rpc("email_existe", { _email: data.email });
    if (error) throw new Error("Não foi possível verificar o cadastro.");
    return { existe: Boolean(existe) };
  });
