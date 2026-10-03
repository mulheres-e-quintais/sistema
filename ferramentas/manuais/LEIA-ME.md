# Manuais em PDF

Tudo aqui gera os manuais do sistema a partir das **telas reais** (modo de demonstração, dados fictícios).

## Regra

**Toda vez que uma funcionalidade ou tela mudar, os manuais são gerados de novo e publicados junto com a mudança.**
São nove arquivos, e todos saem do mesmo comando:

| Arquivo | Onde fica | Para quem |
|---|---|---|
| Manual completo | `ferramentas/manuais/saida/` | coordenação (referência) |
| Guias rápidos, 6 folhas num arquivo | `ferramentas/manuais/saida/` | impressão |
| Por que o sistema é essencial | `ferramentas/manuais/saida/` | contratante |
| `manual-<perfil>.pdf` (6) | `manuais/` | cada perfil, pelo botão de ajuda do sistema |
| `guia-<perfil>.pdf` (6) | `manuais/` | cada perfil, pelo botão de ajuda do sistema |

Perfis: `geral`, `tecnica`, `bolsista`, `agente`, `professor`, `auxiliar`.

## Como gerar

```
bash ferramentas/manuais/gerar_tudo.sh
```

Leva uns 5 minutos. Precisa de Node com Playwright (Chromium), Python 3 com Pillow e pypdf, e `qpdf`.
A versão do sistema impressa nos manuais sai sozinha do `sw.js`: gere **depois** de subir a versão.

## Onde mexer no texto

| O que mudou | Arquivo |
|---|---|
| Passo a passo de uma tela, capítulos | `gerar.py` |
| Quem faz o quê, cores, ciclo do mês, LGPD, mensagens do sistema | `novo.py` |
| Guias rápidos e documento do contratante | `extras.py` |
| Que telas são capturadas e onde ficam os marcadores numerados | `cap.js` |
| Aparência | `manual.css` |

Se um botão mudar de nome, o marcador da captura some: confira a tabela "Elementos da tela" da figura.

## Como o sistema usa

O painel de ajuda (botão **?**) mostra, para quem entrou, os links do guia rápido e do manual do próprio perfil
(`js/ajuda.js`). Os PDFs só são baixados quando a pessoa toca no link e não ficam guardados no aparelho
(`sw.js` deixa a pasta `manuais/` de fora).
