import sys,re
for f in sys.argv[1:]:
    txt=open(f).read().split('\n')
    blocos=[];cur=('SETUP',[])
    for l in txt:
        if l.startswith('== '):
            blocos.append(cur);cur=(l,[])
        else: cur[1].append(l)
    blocos.append(cur)
    ruins=[]; n=0
    for t,ls in blocos:
        erro=[l for l in ls if 'ERROR' in l]
        if any('FALHOU:' in l for l in ls): ruins.append((t,'conferência do valor falhou'))
        up=t.upper()
        esp_erro = '(ERRO' in up or 'ERRO)' in up or re.search(r'\bERRO\b',up) and 'OK' not in up
        esp_ok = '(OK' in up
        if t=='SETUP':
            if erro: ruins.append(('SETUP',erro[0][:160]))
            continue
        n+=1
        misto = esp_ok and ('ERRO' in up)          # bloco com um passo OK e outro que deve dar ERRO
        ignora = 'IGNORA' in up                    # o banco ignora em silêncio (RLS): o teste confere o valor depois
        if ignora: continue
        if misto:
            if not erro: ruins.append((t,'bloco misto sem o ERRO esperado'))
        elif esp_erro and not erro: ruins.append((t,'esperava ERRO e passou'))
        elif esp_ok and erro: ruins.append((t,erro[0][:160]))
    print(f.split('/')[-1], 'blocos',n,'suspeitos',len(ruins))
    for r in ruins: print('   ',r[0][:90],'|',r[1])
