#!/usr/bin/env python3
"""Gera 05_dados_exemplo.sql: o projeto inteiro preenchido com dados FICTÍCIOS (equipe, 200 quintais,
visitas e diagnósticos), todos registrados na tabela public.exemplo para sumirem da vitrine pública
e serem apagados de uma vez pelo 06_apagar_exemplo.sql.

Uso:  python3 supabase/exemplo/gerar.py   (sempre gera o mesmo conteúdo: semente fixa)
"""
import json, math, random, uuid, datetime as dt, pathlib, re

AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parent
rnd = random.Random(20260928)
MUN = json.loads((AQUI / 'municipios.json').read_text())
UFS = ['AL', 'BA', 'PE', 'PI', 'SE']
DDD = {'AL': ['82'], 'BA': ['74', '75', '77'], 'PE': ['87'], 'PI': ['89', '86'], 'SE': ['79']}

NOMES = ['Maria', 'Francisca', 'Antônia', 'Raimunda', 'Josefa', 'Rita', 'Ana', 'Luzia', 'Edileuza', 'Cícera', 'Marinalva',
         'Gilvânia', 'Rosilene', 'Joelma', 'Valdirene', 'Aparecida', 'Damiana', 'Lucineide', 'Jucileide', 'Erivânia', 'Adriana',
         'Elisângela', 'Terezinha', 'Sebastiana', 'Domingas', 'Joana', 'Iraci', 'Neide', 'Rosângela', 'Edilene', 'Vera Lúcia',
         'Marlene', 'Socorro', 'Conceição', 'Givanilda', 'Eliane', 'Cleonice', 'Zuleide', 'Genilda', 'Jacira', 'Leonice',
         'Irismar', 'Valquíria', 'Edvânia', 'Francineide', 'Rosimeire', 'Luciene', 'Márcia', 'Dalvanira', 'Ivonete']
DUPLOS = ['Maria do Socorro', 'Maria da Conceição', 'Maria José', 'Maria das Graças', 'Ana Paula', 'Maria de Fátima',
          'Maria Aparecida', 'Maria Lúcia', 'Francisca das Chagas', 'Antônia Maria']
SOBRE = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Alves', 'Ferreira', 'Rodrigues', 'Costa', 'Gomes',
         'Nascimento', 'Araújo', 'Barbosa', 'Ribeiro', 'Carvalho', 'Rocha', 'Almeida', 'Batista', 'Moura', 'Nunes', 'Dias',
         'Cavalcante', 'Bezerra', 'Leite', 'Macêdo', 'Feitosa', 'Sampaio', 'Vieira', 'Freitas', 'Monteiro', 'Brito', 'Lopes',
         'Teixeira', 'Soares', 'Pinheiro', 'Coelho', 'Sales', 'Tavares', 'Holanda']
HOMENS = ['José', 'Antônio', 'Francisco', 'João', 'Raimundo', 'Pedro', 'Luiz', 'Manoel', 'Cícero', 'Sebastião', 'Geraldo']
COMUNIDADES = ['Sítio Lagoa do Mato', 'Comunidade Baixa Verde', 'Assentamento Santa Rita', 'Sítio Caldeirão', 'Povoado Barra',
               'Comunidade Quilombola Tapuio', 'Sítio Olho d\'Água', 'Assentamento Novo Horizonte', 'Comunidade Serra Branca',
               'Sítio Riacho Fundo', 'Povoado Malhada Grande', 'Comunidade São Bento', 'Sítio Várzea Comprida', 'Assentamento Terra Livre',
               'Comunidade Lagoa Seca', 'Sítio Pedra Branca', 'Povoado Tanque Novo', 'Comunidade Quilombola Mocambo', 'Sítio Boa Vista',
               'Assentamento Margarida Alves']
ORGS = ['MPA', 'Associação de Mulheres Rurais', 'Sindicato dos Trabalhadores Rurais', 'Cooperativa da Agricultura Familiar', 'MPA – regional']
KIT = [('Caixa d\'água 1.000 L', '1', 'reservar água para irrigar'), ('Kit de gotejamento', '1', 'irrigação econômica'),
       ('Tela de sombreamento 50%', '30 m²', 'proteger os canteiros do sol'), ('Sementes de hortaliças', '10 pacotes', 'plantio dos canteiros'),
       ('Mudas frutíferas', '10', 'pomar do quintal'), ('Esterco curtido', '20 sacos', 'adubação'), ('Ferramentas manuais', '1 kit', 'preparo do solo'),
       ('Tela para galinheiro', '25 m', 'criação de galinhas'), ('Regador e mangueira', '1', 'irrigação')]
DIFIC = ['Falta água na seca', 'Pouco tempo com a casa e os filhos', 'Animais soltos entram no quintal', 'Solo fraco e pedregoso',
         'Não tem cerca', 'Praga nas hortaliças', 'Difícil vender a produção']
SONHOS = ['Ter verdura o ano todo para a família', 'Vender na feira da cidade', 'Criar galinhas para ovos', 'Ter um pomar',
          'Vender para a merenda escolar (PNAE)', 'Plantar ervas medicinais', 'Ter renda própria']
FRASES = ['Ter hortaliças o ano inteiro e vender o que sobrar na feira', 'Garantir alimento para a família e renda com ovos',
          'Produzir verdura sem veneno e vender para o PNAE', 'Montar um pomar e uma horta irrigada']

def cpf():
    while True:
        n = [rnd.randint(0, 9) for _ in range(9)]
        if len(set(n)) == 1: continue
        for k in (10, 11):
            s = sum(d * w for d, w in zip(n, range(k, 1, -1))); r = (s * 10) % 11
            n.append(0 if r == 10 else r)
        return ''.join(map(str, n))
usados = set()
def cpf_unico():
    while True:
        c = cpf()
        if c not in usados: usados.add(c); return c
def nome_mulher():
    base = rnd.choice(DUPLOS) if rnd.random() < .25 else rnd.choice(NOMES)
    s1, s2 = rnd.sample(SOBRE, 2)
    return f'{base} {s1} {s2}' if rnd.random() < .6 else f'{base} {rnd.choice(["de ", "da ", "dos ", ""])}{s1}'.replace('  ', ' ')
def fone(uf): return f'({rnd.choice(DDD[uf])}) 9{rnd.randint(8000, 9999)}-{rnd.randint(1000, 9999)}'
def uid(): return str(uuid.UUID(int=rnd.getrandbits(128), version=4))
def q(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return repr(v)
    if isinstance(v, (dict, list)): return "'" + json.dumps(v, ensure_ascii=False, separators=(',', ':')).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"
def d(x): return x.isoformat()
def entre(a, b): return a if b <= a else a + dt.timedelta(days=rnd.randint(0, (b - a).days))
def sem_acento(t):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')
def email(nome):
    p = sem_acento(nome.lower()).split()
    return f'{p[0]}.{p[-1]}{rnd.randint(1, 99)}@exemplo.invalid'   # domínio reservado: ninguém consegue criar esse e-mail

linhas, ids, grupos = [], [], {}   # ids: (tabela, id) para a tabela exemplo
REGS = {}
def insert(tab, reg):
    REGS.setdefault(tab, []).append({k: v for k, v in reg.items() if not k.startswith('_')})
    cols = tuple(k for k in reg if not k.startswith('_'))
    grupos.setdefault((tab, cols), []).append('(' + ', '.join(q(reg[c]) for c in cols) + ')')
    ids.append((tab, reg['id']))
def despejar():
    ordem = ['equipe', 'fichas', 'visitas', 'diagnosticos']
    for (tab, cols), vals in sorted(grupos.items(), key=lambda g: ordem.index(g[0][0])):
        for k in range(0, len(vals), 100):
            linhas.append(f"insert into public.{tab} ({', '.join(cols)}) values\n" + ',\n'.join(vals[k:k + 100]) + ';')

# ---------------- equipe ----------------
INICIO = dt.date(2026, 10, 1)
def pessoa(papel, uf, hab=True, meta=None):
    nm = nome_mulher() if rnd.random() < .85 else f'{rnd.choice(HOMENS)} {rnd.choice(SOBRE)} {rnd.choice(SOBRE)}'
    mun = rnd.choice(list(MUN[uf])) if uf else 'Apodi/RN'
    r = dict(id=uid(), papel=papel, uf=uf, nome=nm, cpf=cpf_unico(), email=email(nm), telefone=fone(uf or 'PI'), municipio=mun,
             organizacao=rnd.choice(ORGS) if uf else 'MPA – coordenação nacional', data_inicio=d(INICIO), consentimento_lgpd=True, status='ativa')
    if hab:
        r.update(matricula_fic_em=d(entre(dt.date(2026, 10, 2), dt.date(2026, 10, 15))), matricula_fic_numero=f'2026{rnd.randint(1000000, 9999999)}',
                 docs_funcern_em=d(entre(dt.date(2026, 10, 5), dt.date(2026, 10, 20))), termo_assinado_em=d(entre(dt.date(2026, 10, 5), dt.date(2026, 10, 20))),
                 termo_path=None)
    if meta: r.update(meta_diagnosticos=meta[0], meta_quintais=meta[1], meta_visitas=meta[2])
    insert('equipe', r); return r

tec = pessoa('coord_tecnico', None, meta=None)
equipe = {}
for uf in UFS:
    art = pessoa('articulacao', uf, meta=(20, 20, 40)); apo = pessoa('apoio', uf, meta=(20, 20, 40))
    ag1 = pessoa('agente', uf); ag2 = pessoa('agente', uf, hab=rnd.random() < .5)
    equipe[uf] = dict(art=art, apo=apo, ags=[ag1, ag2], campo=[art, apo, ag1] + ([ag2] if ag2.get('termo_assinado_em') else []))

# ---------------- fichas ----------------
def ficha(uf, resultado, situacao='aprovada', pos=None):
    mun = rnd.choice(list(MUN[uf])); lon, lat = MUN[uf][mun]
    ang, raio = rnd.random() * 2 * math.pi, rnd.uniform(.01, .09)
    df = entre(dt.date(2026, 10, 5), dt.date(2026, 11, 20))
    idade = rnd.choice([rnd.randint(19, 29), rnd.randint(30, 49), rnd.randint(30, 49), rnd.randint(50, 72)])
    nasc = dt.date(df.year - idade, rnd.randint(1, 12), rnd.randint(1, 28))
    agua = resultado != 'sem_agua'
    crit = dict(c_agricultora=True, c_maior18=True, c_espaco=True, c_agua=agua, c_disponibilidade=True, c_sem_kit=True, c_sem_parentesco=True, c_casa_unica=True)
    if resultado == 'nao_atende': crit[rnd.choice(['c_espaco', 'c_disponibilidade', 'c_sem_kit'])] = False
    b = rnd.choice([equipe[uf]['art'], equipe[uf]['apo']])
    r = dict(id=uid(), uf=uf, municipio=mun, comunidade=rnd.choice(COMUNIDADES), nome=nome_mulher(), cpf=cpf_unico(), data_nascimento=d(nasc),
             celular=fone(uf) if rnd.random() < .8 else None, endereco=f'{rnd.choice(["Sítio", "Rua", "Travessa", "Estrada"])} {rnd.choice(SOBRE)}, {rnd.randint(1, 350)}',
             ponto_referencia=rnd.choice([None, 'Perto da escola', 'Ao lado da igreja', 'Depois da cisterna comunitária', 'Casa de muro azul']),
             nis=''.join(str(rnd.randint(0, 9)) for _ in range(11)) if rnd.random() < .7 else None, pessoas_familia=rnd.randint(1, 7),
             indicada_por=rnd.choice(['Associação comunitária', 'Sindicato', 'MPA', 'Agente de saúde', 'Grupo de mulheres']),
             autodeclaracao=resultado in ('selecionada', 'lista_espera') or rnd.random() < .7,
             p_sustento=rnd.random() < .55, p_cadunico=rnd.random() < .75, p_sem_ater=rnd.random() < .6, p_raca_povo=rnd.random() < .7,
             p_jovem=idade <= 29, p_grupo=rnd.random() < .4, p_caf=rnd.random() < .5,
             consent_dados=True, consent_imagem=rnd.random() < .85, consent_criancas=rnd.random() < .3, assinatura='assinatura',
             resultado=resultado, posicao_espera=pos, encaminhada_para='Programa Cisternas (ASA) – ' + mun if resultado == 'sem_agua' else None,
             justificativa='Sem água que dure no período seco' if resultado == 'sem_agua' else ('Não atende a critério obrigatório' if resultado == 'nao_atende' else None),
             latitude=round(lat + math.sin(ang) * raio, 6) if rnd.random() < .6 else None, longitude=None,
             situacao=situacao, aprovada_por=tec['id'] if situacao == 'aprovada' else None,
             aprovada_em=d(df + dt.timedelta(days=rnd.randint(1, 6))) + 'T12:00:00-03:00' if situacao == 'aprovada' else None,
             obs_coordenacao='A foto do termo ficou cortada: fotografe de novo.' if situacao == 'devolvida' else None,
             bolsista_id=b['id'], data_ficha=d(df), **crit)
    if r['latitude'] is not None: r['longitude'] = round(lon + math.cos(ang) * raio, 6)
    insert('fichas', r); r['_lonlat'] = (lon, lat); return r

selecionadas = {}
for uf in UFS:
    selecionadas[uf] = [ficha(uf, 'selecionada') for _ in range(40)]
    for i in range(6): ficha(uf, 'lista_espera', pos=i + 1)
    for _ in range(rnd.randint(3, 6)): ficha(uf, 'sem_agua')
    for _ in range(2): ficha(uf, 'nao_atende')
    ficha(uf, 'lista_espera', situacao='aguardando', pos=7); ficha(uf, 'lista_espera', situacao='aguardando', pos=8)
    ficha(uf, 'lista_espera', situacao='devolvida', pos=9)

# ---------------- visitas e diagnósticos ----------------
def visita(f, etapa, quem, dia):
    r = dict(id=uid(), ficha_id=f['id'], uf=f['uf'], etapa=etapa, executor_id=quem['id'], data_prevista=d(dia), data_realizada=d(dia),
             situacao='realizada', criado_por=equipe[f['uf']]['art']['id'])
    insert('visitas', r); return r

def diagnostico(f, v, quem, dia):
    lon, lat = f['_lonlat']; ang, raio = rnd.random() * 2 * math.pi, rnd.uniform(.01, .09)
    tem_gps = rnd.random() < .9
    n_fam = rnd.randint(1, 6)
    familia = [dict(nome=f['nome'].split()[0], idade=None, parentesco='Ela mesma', ocupacao='Agricultora', ajuda=True)] + [
        dict(nome=rnd.choice(NOMES + HOMENS), idade=rnd.randint(1, 80), parentesco=rnd.choice(['Cônjuge/companheiro', 'Filho(a)', 'Filho(a)', 'Neto(a)', 'Pai/mãe']),
             ocupacao=rnd.choice(['Estuda', 'Agricultor(a)', 'Trabalha fora', 'Aposentado(a)', '']), ajuda=rnd.random() < .5) for _ in range(n_fam - 1)]
    prod = {}
    for k in ['hortalicas', 'frutiferas', 'medicinais', 'graos', 'galinhas', 'animais']:
        if rnd.random() < .55:
            prod[k] = dict(qtd=rnd.choice(['2 canteiros', '10 pés', '5 pés', 'meia tarefa', '15 cabeças', '3 cabeças', 'pouco']),
                           consumo=True, venda=rnd.random() < .3, onde=rnd.choice(['', 'Feira da cidade', 'Vizinhos', 'Atravessador']))
    vende = any(x['venda'] for x in prod.values())
    kit = rnd.sample(KIT, rnd.randint(3, 6))
    lote = 1 if dia < dt.date(2026, 12, 15) else 2
    dados = dict(familia=familia, politicas=rnd.sample(['bolsa_familia', 'aposentadoria', 'bpc', 'garantia_safra', 'paa', 'pnae', 'pronaf', 'ater'], rnd.randint(1, 3)),
                 fonte_renda=rnd.choice(['Bolsa Família', 'Aposentadoria', 'Diárias na roça', 'Venda de produção', 'Garantia-Safra']),
                 terra=rnd.choice(['propria', 'propria', 'cedida', 'outra']), cercado=rnd.choice(['sim', 'nao', 'em_parte']),
                 fontes_agua=rnd.sample(['cisterna_consumo', 'cisterna_producao', 'poco', 'acude', 'rede', 'carro_pipa'], rnd.randint(1, 3)),
                 capacidade_litros=rnd.choice([16000, 16000, 52000, 30000]), meses_seca=rnd.randint(3, 8), distancia_m=rnd.randint(5, 150),
                 irrigacao=rnd.choice(['nao', 'regador', 'regador', 'gotejamento']), solo=rnd.choice(['arenoso', 'argiloso', 'pedregoso', 'nao_sabe']),
                 meses_chuva=rnd.choice(['janeiro a abril', 'fevereiro a maio', 'dezembro a março', 'março a junho']),
                 producao=prod, praticas=rnd.sample(['compostagem', 'esterco', 'sementes', 'veneno', 'adubo_quimico', 'cobertura'], rnd.randint(1, 3)),
                 horas_dia=rnd.choice([1, 2, 2, 3, 4]), participa=rnd.sample(['associacao', 'sindicato', 'grupo_mulheres', 'mpa', 'cooperativa'], rnd.randint(0, 2)),
                 dificuldades=rnd.choice(DIFIC), sonhos=rnd.choice(SONHOS),
                 objetivos=rnd.sample(['alimentacao', 'venda', 'animais', 'medicinais'], rnd.randint(1, 3)), frase_objetivo=rnd.choice(FRASES),
                 kit=[dict(item=a, qtd=b, para=c) for a, b, c in kit],
                 cronograma=[dict(oque='Preparar canteiros e cerca', inicio='jan', fim='fev', quem='Ela e a família'),
                             dict(oque='Instalar caixa e gotejamento', inicio='fev', fim='mar', quem='Equipe do projeto'),
                             dict(oque='Plantio e cobertura do solo', inicio='mar', fim='abr', quem='Ela')],
                 compromissos=True)
    r = dict(id=uid(), ficha_id=f['id'], visita_id=v['id'], uf=f['uf'], executor_id=quem['id'], data_visita=d(dia),
             codigo_quintal=f"{f['uf']}-{f['id'][:5].upper()}",
             latitude=round(lat + math.sin(ang) * raio, 6) if tem_gps else None, longitude=round(lon + math.cos(ang) * raio, 6) if tem_gps else None,
             sem_gps_motivo=None if tem_gps else 'Celular sem sinal de GPS no local',
             area_m2=rnd.choice([80, 120, 150, 200, 250, 300, 400, 600]), renda_familiar=rnd.choice([600, 800, 1000, 1200, 1412, 1600, 2000, 2500]),
             renda_quintal=rnd.choice([50, 80, 100, 150, 200, 300]) if vende else 0, agua_seca=rnd.choice(['sim', 'sim', 'as_vezes']),
             sem_agua=False, lote=lote, mes_implantacao='janeiro de 2027' if lote == 1 else 'maio de 2027', dados=dados,
             situacao='aprovado', aprovado_por=tec['id'], aprovado_em=d(dia + dt.timedelta(days=rnd.randint(2, 10))) + 'T12:00:00-03:00')
    insert('diagnosticos', r)

for uf in UFS:
    for f in selecionadas[uf]:
        campo = equipe[uf]['campo']; quem = rnd.choice(campo)
        dd = entre(dt.date(2026, 10, 20), dt.date(2027, 1, 31)); vd = visita(f, 'diagnostico', quem, dd); diagnostico(f, vd, quem, dd)
        di = entre(max(dd + dt.timedelta(days=20), dt.date(2027, 1, 10)), dt.date(2027, 5, 31)); visita(f, 'implantacao', rnd.choice(campo), di)
        a1 = entre(di + dt.timedelta(days=25), di + dt.timedelta(days=60)); visita(f, 'acompanhamento', rnd.choice(campo), a1)
        a2 = entre(a1 + dt.timedelta(days=30), min(a1 + dt.timedelta(days=75), dt.date(2027, 9, 20))); visita(f, 'acompanhamento', rnd.choice(campo), max(a2, a1 + dt.timedelta(days=1)))

# ---------------- montar o script ----------------
quatro = (RAIZ / '04_vitrine_e_custos.sql').read_text()
bloco = quatro[quatro.index('-- >>> dados de exemplo'):quatro.index('-- <<< dados de exemplo')]
por_tab = {}
for t, i in ids: por_tab.setdefault(t, []).append(i)
out = [f"""-- =====================================================================
-- Mulheres & Quintais — Etapa 5: DADOS DE EXEMPLO (fictícios) para testar o sistema cheio
-- Gerado por supabase/exemplo/gerar.py. Rodar DEPOIS de 01 a 04.
--
-- O que entra: coordenação técnica, 10 bolsistas e 10 agentes de campo; {len(por_tab['fichas'])} fichas nos 5 estados
-- (200 selecionadas e aprovadas); {len(por_tab['visitas'])} visitas feitas e {len(por_tab['diagnosticos'])} diagnósticos com plano aprovado.
-- Nomes, CPFs e endereços são inventados. E-mails terminam em @exemplo.invalid (ninguém consegue entrar com eles).
--
-- Todo registro fica anotado na tabela public.exemplo: NÃO aparece na vitrine pública e sai inteiro com
-- 06_apagar_exemplo.sql. Rode o 06 ANTES de cadastrar a equipe e as fichas de verdade.
-- Por segurança, este script para se já houver equipe ou fichas reais no banco.
-- =====================================================================
begin;
do $$ begin
  if to_regclass('public.vitrine_fotos') is null or to_regclass('public.custos_visita') is null or to_regclass('public.visitas') is null then
    raise exception 'Falta instalar as etapas anteriores: rode antes o 03_campo.sql e o 04_vitrine_e_custos.sql (nada mudou).';
  end if;
end $$;
{bloco}
do $$ begin
  if exists (select 1 from public.equipe where papel <> 'coord_geral' and id not in (select id from public.exemplo)) then
    raise exception 'Já há equipe cadastrada de verdade: os dados de exemplo não foram colocados (nada mudou).';
  end if;
  if exists (select 1 from public.fichas where id not in (select id from public.exemplo)) then
    raise exception 'Já há fichas de verdade: os dados de exemplo não foram colocados (nada mudou).';
  end if;
  if exists (select 1 from public.exemplo) then
    raise exception 'Os dados de exemplo já estão no banco. Para recolocar, rode antes o 06_apagar_exemplo.sql.';
  end if;
end $$;

-- as regras do sistema (gatilhos) ficam desligadas só durante a carga, para gravar datas e aprovações de uma vez
alter table public.equipe disable trigger user;
alter table public.fichas disable trigger user;
alter table public.visitas disable trigger user;
alter table public.diagnosticos disable trigger user;
"""]
despejar(); out += linhas
for t, lst in por_tab.items():
    for k in range(0, len(lst), 200):
        out.append(f"insert into public.exemplo (tabela, id) values " + ', '.join(f"('{t}', '{i}')" for i in lst[k:k + 200]) + ';')
out.append("""
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'equipe' and column_name = 'foto_path') then
    execute $q$update public.equipe e set foto_path = 'exemplo:' || case
        when split_part(e.nome, ' ', 1) in ('José','Antônio','Francisco','João','Raimundo','Pedro','Luiz','Manoel','Cícero','Sebastião','Geraldo')
        then (array[6,12,18])[1 + (abs(hashtext(e.id::text)) % 3)]
        else (array[1,2,3,4,5,7,8,9,10,11,13,14,15,16,17])[1 + (abs(hashtext(e.id::text)) % 15)] end
      where e.id in (select id from public.exemplo where tabela = 'equipe')$q$;
  end if;
end $$;
alter table public.equipe enable trigger user;
alter table public.fichas enable trigger user;
alter table public.visitas enable trigger user;
alter table public.diagnosticos enable trigger user;
commit;

select 'Dados de exemplo colocados' as resultado,
  (select count(*) from public.exemplo where tabela = 'equipe') as equipe,
  (select count(*) from public.exemplo where tabela = 'fichas') as fichas,
  (select count(*) from public.exemplo where tabela = 'visitas') as visitas,
  (select count(*) from public.exemplo where tabela = 'diagnosticos') as diagnosticos;
""")
(RAIZ / '05_dados_exemplo.sql').write_text('\n'.join(out) + '\n')
print('ok', {t: len(v) for t, v in por_tab.items()})

# (teste) mesmo conteúdo em JSON, para abrir no modo demonstração e medir a tela cheia
import sys
if '--json' in sys.argv:
    (AQUI / 'dados_teste.json').write_text(json.dumps(REGS, ensure_ascii=False))
