# Mulheres & Quintais — regras para quem mexe neste repositório

- Depois de mudar qualquer arquivo em `js/`, rode `node ferramentas/montar.js` (gera `js/tudo.js`, compactado com o esbuild; se faltar, `npm install`) e suba o número em `VERSAO` no `sw.js`.
- Antes de enviar: `npm test`.
- **Manuais.** Toda mudança de funcionalidade ou de tela exige atualizar os manuais no mesmo envio:
  ajuste o texto em `ferramentas/manuais/` (ver `LEIA-ME.md` lá) e rode `bash ferramentas/manuais/gerar_tudo.sh`.
  Isso regenera o manual completo, os guias rápidos, o documento do contratante e o manual e o guia de cada perfil
  (pasta `manuais/`, aberta pelo botão de ajuda do sistema). A ajuda dentro do sistema (`js/ajuda.js`) muda junto.
- Outra sessão também envia para este repositório: `git fetch origin main` antes de enviar.
- **Autoria dos envios:** todo envio sai em nome de `Cleone Lima <38408939+cleonecc@users.noreply.github.com>` (o endereço anônimo do GitHub, para o e-mail não ficar público) (`git config user.name/user.email`),
  sem as linhas `Co-Authored-By`, `Claude-Session` ou "Generated with" na mensagem. O histórico foi reescrito em 13/10/2026:
  quem tinha uma cópia antiga do repositório precisa baixar de novo (`git fetch origin && git reset --hard origin/main`).
- **Celular e tablet:** rode `testes/automaticos/responsividade.js` depois de mexer no CSS (320 a 1024 px, toque, iPhone deitado).
