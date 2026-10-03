# Gera manual.html (A4, Manrope + Lora) a partir das capturas em shots/ e de shots.json
import json, re, html, os, sys
B = os.path.dirname(os.path.abspath(__file__))
SH = json.load(open(B + '/shots.json')); SH.update(json.load(open(B + '/shots_cel.json')))
IC = json.load(open(B + '/icons.json'))
PAG = json.load(open(B + '/paginas.json')) if os.path.exists(B + '/paginas.json') else {}
FD = B + '/node_modules/'
REPO = os.path.normpath(B + '/../..') + '/'
VER = re.search(r"mq-v(\d+)", open(REPO + 'sw.js', encoding='utf8').read()).group(1)   # versão do sistema: sai do sw.js
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
import datetime
QUANDO = '%s de %d' % (MESES[datetime.date.today().month - 1], datetime.date.today().year)
SAIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-3"/><path d="M4 12h11"/><path d="M11 8l4 4-4 4"/></svg>'

def ic(n):
    if n == 'sair': return '<span class="ic esc">' + SAIR + '</span>'
    if n == 'ajuda': return '<span class="ic esc txt">?</span>'
    s = re.sub(r' (width|height)="\d+"', '', IC[n])
    return '<span class="ic">' + s + '</span>'
def b(t, icone=None): return (ic(icone) if icone else '') + '<b class="bt">' + t + '</b>'

toc = []   # (nivel, id, numero, titulo)
cont = {'c': 0, 's': 0}
ST = {'on': True, 'capon': True, 'secoff': False, 'caps': None, 'semsec': set()}
def cap(titulo, sub=None):
    ST['secoff'] = False
    if ST['caps'] is not None and titulo not in ST['caps']:
        ST['on'] = False; ST['capon'] = False; return ''
    ST['on'] = True; ST['capon'] = True
    cont['c'] += 1; cont['s'] = 0; i = 'c%d' % cont['c']; toc.append((1, i, str(cont['c']), titulo))
    return '<section class="cap"><div class="cap-abre"><span class="cap-n">%d</span><h1 id="%s">%s</h1>%s</div>' % (cont['c'], i, titulo, '<p class="cap-sub">%s</p>' % sub if sub else '')
def fimcap():
    era = ST['capon']; ST['on'] = True; ST['capon'] = True; ST['secoff'] = False
    return '</section>' if era else ''
def sec(titulo):
    if not ST['capon']: return ''
    if titulo in ST['semsec']:
        ST['on'] = False; ST['secoff'] = True; return ''
    ST['on'] = True; ST['secoff'] = False
    cont['s'] += 1; n = '%d.%d' % (cont['c'], cont['s']); i = 's' + n.replace('.', '_'); toc.append((2, i, n, titulo))
    return '<h2 id="%s"><span class="n">%s</span>%s</h2>' % (i, n, titulo)
def h3(t): return '<h3>%s</h3>' % t
def p(t): return '<p>%s</p>' % t
def serve(t): return '<div class="rot">Para que serve</div><p>%s</p>' % t
def acesso(caminho, quem): return '<div class="rot">Como acessar</div><p class="caminho">%s</p><p class="quem"><b>Quem tem acesso:</b> %s</p>' % (' <span class="seta">›</span> '.join('<span>%s</span>' % x for x in caminho), quem)
def passos(titulo, itens, resultado=None):
    h = '<div class="tarefa"><div class="rot">Como utilizar%s</div><ol class="passos">%s</ol>' % (': ' + titulo if titulo else '', ''.join('<li>%s</li>' % x for x in itens))
    if resultado: h += '<p class="res"><b>Resultado esperado:</b> %s</p>' % resultado
    return h + '</div>'
def caixa(tipo, t):
    nome = {'atencao': 'Atenção', 'importante': 'Importante', 'dica': 'Dica', 'exemplo': 'Exemplo'}[tipo]
    return '<div class="cx %s"><span class="cx-t">%s</span><p>%s</p></div>' % (tipo, nome, t)
def tabela(cab, linhas, cls=''):
    return '<table class="%s"><thead><tr>%s</tr></thead><tbody>%s</tbody></table>' % (cls, ''.join('<th>%s</th>' % c for c in cab), ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % c for c in l) for l in linhas))
nfig = [0]
def tela(idt, legenda, elementos, estreita=False):
    s = SH.get(idt)
    if not s or not ST['on']: return ''
    nfig[0] += 1
    larg = 'est' if s['w'] < 900 else ''
    if idt.endswith('_cel'):
        ls = [(n, e, f) for (n, e, f) in elementos if n in s['postos']]
        return '<div class="lado"><figure class="tela cel"><img src="SHOTS/%s.png" alt="%s"><figcaption>Figura %d. %s, no celular</figcaption></figure><div><div class="rot">Elementos da tela</div>%s</div></div>' % (idt, html.escape(legenda), nfig[0], legenda, tabela(['Nº', 'Elemento', 'Função'], [['<span class="num">%d</span>' % n, '<b>%s</b>' % e, f] for (n, e, f) in ls], 'elem'))
    h = '<figure class="tela %s"><img src="SHOTS/%s.png" alt="%s"><figcaption>Figura %d. %s</figcaption></figure>' % (larg, idt, html.escape(legenda), nfig[0], legenda)
    ls = [(n, e, f) for (n, e, f) in elementos if n in s['postos']]
    if ls: h += '<div class="rot">Elementos da tela</div>' + tabela(['Nº', 'Elemento', 'Função'], [['<span class="num">%d</span>' % n, '<b>%s</b>' % e, f] for (n, e, f) in ls], 'elem')
    return h

# ---------- diagramas (vetoriais) ----------
def fluxo(titulo, caixas, linhas=2, laco=None, notas=(), W=150, G=22):
    # caixas: [(quem, acao, destaque)] ; desenha em fila única ou em duas fileiras (cobra)
    H = 52
    if not ST['on']: return ''
    n = len(caixas); porlin = n if linhas == 1 else (n + 1) // 2
    larg = porlin * W + (porlin - 1) * G; x0 = (720 - larg) / 2
    pos = []
    for i in range(n):
        if linhas == 1 or i < porlin: pos.append((x0 + i * (W + G), 44))
        else: pos.append((x0 + (porlin - 1 - (i - porlin)) * (W + G), 44 + H + 46))
    alt = 44 + H + (H + 46 if linhas == 2 else 0) + (44 if laco else 0) + 16 + 15 * len(notas)
    o = ['<svg class="fluxo" viewBox="0 0 720 %d" role="img" aria-label="%s"><defs><marker id="s%d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8A7968"/></marker></defs>' % (alt, html.escape(titulo), nfig[0])]
    o.append('<text x="0" y="18" class="ft">%s</text>' % titulo)
    for i in range(n - 1):
        (x, y), (x2, y2) = pos[i], pos[i + 1]
        if y == y2:
            if x2 > x: o.append('<path d="M%d %d H%d" class="fl" marker-end="url(#s%d)"/>' % (x + W, y + H / 2, x2 - 2, nfig[0]))
            else: o.append('<path d="M%d %d H%d" class="fl" marker-end="url(#s%d)"/>' % (x, y + H / 2, x2 + W + 2, nfig[0]))
        else: o.append('<path d="M%d %d V%d" class="fl" marker-end="url(#s%d)"/>' % (x + W / 2, y + H, y2 - 2, nfig[0]))
    if laco:
        de, para, txt = laco; yb = 44 + H + 26
        o.append('<path d="M%d %d V%d H%d V%d" class="fl tr" marker-end="url(#s%d)"/>' % (pos[de][0] + W / 2, 44 + H, yb, pos[para][0] + W / 2, 44 + H + 2, nfig[0]))
        o.append('<text x="%d" y="%d" class="fq" text-anchor="middle">%s</text>' % ((pos[de][0] + pos[para][0]) / 2 + W / 2, yb + 15, txt))
    for (x, y), (quem, acao, dest) in zip(pos, caixas):
        o.append('<rect x="%d" y="%d" width="%d" height="%d" rx="9" class="fb%s"/>' % (x, y, W, H, ' d' if dest else ''))
        o.append('<text x="%d" y="%d" class="fq" text-anchor="middle">%s</text>' % (x + W / 2, y + 20, quem))
        o.append('<text x="%d" y="%d" class="fa" text-anchor="middle">%s</text>' % (x + W / 2, y + 38, acao))
    yn = alt - 15 * len(notas) + 8
    for k, t in enumerate(notas): o.append('<text x="0" y="%d" class="fq">%s</text>' % (yn + 15 * k, t))
    o.append('</svg>')
    nfig[0] += 1
    return '<figure class="dia">%s<figcaption>Figura %d. %s</figcaption></figure>' % (''.join(o), nfig[0], titulo)

