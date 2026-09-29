// Mulheres & Quintais — Edge Function "organizar-texto"
// Recebe o texto ditado ou digitado por quem está no campo e devolve uma proposta de texto
// organizado, para a pessoa conferir e aceitar (ou não). Nada é gravado aqui.
//
// Como instalar (Supabase > Edge Functions > Deploy a new function > Via Editor):
//   nome da função: organizar-texto  → cole este arquivo inteiro → Deploy function.
// Segredo necessário (Edge Functions > Secrets): ANTHROPIC_API_KEY = sua chave da API da Anthropic.
// SUPABASE_URL e SUPABASE_ANON_KEY já existem por padrão em toda Edge Function.

import { createClient } from "npm:@supabase/supabase-js@2";

const MODELO = "claude-haiku-4-5";
const MAX_CARACTERES = 6000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const TIPOS: Record<string, string> = {
  relato: "relato de uma visita a um quintal produtivo",
  observacao: "observação de campo sobre um quintal produtivo",
  relatorio: "relatório mensal de atividades de uma bolsista",
  geral: "anotação de trabalho de campo",
};

// segunda barreira de privacidade (a primeira é no aparelho): tira CPF, telefone e e-mail
function limpar(t: string) {
  return t
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, "[telefone]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);

  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) return resposta({ erro: "A organização de texto ainda não foi configurada (falta a chave no Supabase)." }, 503);

  // só quem é da equipe ativa usa
  const auth = req.headers.get("Authorization") ?? "";
  const chavePublica = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, chavePublica, {
    global: { headers: { Authorization: auth } },
  });
  const { data: eu, error: eErr } = await sb.rpc("vincular_conta");
  if (eErr || !eu || !eu.id) return resposta({ erro: "Entre no sistema para usar esta função." }, 401);

  // limite de uso por pessoa (evita gasto sem controle)
  const { data: pode, error: lErr } = await sb.rpc("registrar_uso_ia");
  if (lErr) return resposta({ erro: "Falta instalar o controle de uso (20_organizar_texto.sql)." }, 500);
  if (pode !== true) return resposta({ erro: "Limite de textos organizados nas últimas 24 horas atingido. Tente amanhã." }, 429);

  let corpo: { texto?: string; tipo?: string };
  try { corpo = await req.json(); } catch { return resposta({ erro: "Pedido inválido." }, 400); }
  const texto = limpar(String(corpo.texto ?? "").trim()).slice(0, MAX_CARACTERES);
  if (texto.length < 20) return resposta({ erro: "Texto muito curto para organizar." }, 400);
  const tipo = TIPOS[String(corpo.tipo ?? "")] ?? TIPOS.geral;

  const sistema = `Você ajuda a equipe de campo do projeto Mulheres & Quintais (quintais produtivos de mulheres rurais no Nordeste) a transformar anotações faladas em texto escrito.
Reescreva o texto recebido como um ${tipo}, em português do Brasil, claro, correto e objetivo.
Regras obrigatórias:
- Não invente nada: use só as informações do texto. Não acrescente números, datas, nomes, quantidades ou conclusões que não estejam lá.
- Não tire nenhuma informação importante; junte repetições e corrija gramática, pontuação e palavras que o ditado entendeu errado quando for óbvio pelo contexto.
- Mantenha a pessoa do discurso de quem escreveu (se falou "eu visitei", continue em primeira pessoa).
- Não escreva nome de pessoa, CPF, telefone ou endereço; se aparecerem, use "a agricultora", "a família" etc.
- Linguagem simples, sem jargão. Pode usar parágrafos curtos. Não use títulos, listas com marcadores, negrito ou emojis.
- Responda só com o texto final, sem explicação antes ou depois.`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 1500,
      system: sistema,
      messages: [{ role: "user", content: `Texto a organizar:\n"""\n${texto}\n"""` }],
    }),
  });
  if (!r.ok) {
    const det = await r.text();
    console.error("anthropic", r.status, det.slice(0, 500));
    return resposta({ erro: r.status === 401 ? "Chave da API inválida. Confira o segredo ANTHROPIC_API_KEY." : "O serviço de texto não respondeu agora. Tente de novo em instantes." }, 502);
  }
  const j = await r.json();
  const proposta = (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("").trim();
  if (!proposta) return resposta({ erro: "Não veio texto. Tente de novo." }, 502);
  return resposta({ proposta });
});
