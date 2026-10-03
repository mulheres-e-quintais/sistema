# Mulheres & Quintais — regras para quem mexe neste repositório

- Depois de mudar qualquer arquivo em `js/`, rode `node ferramentas/montar.js` (gera `js/tudo.js`) e suba o número em `VERSAO` no `sw.js`.
- Antes de enviar: `npm test`.
- **Manuais.** Toda mudança de funcionalidade ou de tela exige atualizar os manuais no mesmo envio:
  ajuste o texto em `ferramentas/manuais/` (ver `LEIA-ME.md` lá) e rode `bash ferramentas/manuais/gerar_tudo.sh`.
  Isso regenera o manual completo, os guias rápidos, o documento do contratante e o manual e o guia de cada perfil
  (pasta `manuais/`, aberta pelo botão de ajuda do sistema). A ajuda dentro do sistema (`js/ajuda.js`) muda junto.
- Outra sessão também envia para este repositório: `git fetch origin main` antes de enviar.
