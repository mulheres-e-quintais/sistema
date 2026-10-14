#!/usr/bin/env python3
# resume os logs por transação do pgbench: TPS, média, p95, p99, erros (geral e por script)
import sys, glob, re, statistics as st
L, nome, c, s, r = sys.argv[1:6]
nomes = ['coord_fichas','coord_visitas','coord_diag','bols_visitas','agente_listas','gravar_visita','gravar_ficha','acomp_dados','auditoria_p1','auditoria_pn']
lat = {}; t0 = None; t1 = None; falhas = 0
for f in glob.glob(L + '/pgbench_log.*'):
    for ln in open(f):
        p = ln.split()
        if len(p) < 6: continue
        if p[2] in ('failed', 'skipped'): falhas += 1; continue
        us = int(p[2]); sc = int(p[3]); ep = int(p[4]) + int(p[5]) / 1e6
        lat.setdefault(sc, []).append(us / 1000.0)
        t0 = ep if t0 is None or ep < t0 else t0; t1 = ep if t1 is None or ep > t1 else t1
saida = open(L + '/saida.txt').read()
abort = len(re.findall(r'aborted in command', saida)); conn = len(re.findall(r'connection to server|too many clients|sorry', saida))
md = re.search(r'number of deadlock failures: (\d+)', saida); dead = int(md.group(1)) if md else 0
dead += len(re.findall(r'deadlock detected', saida))
def pct(v, q):
    v = sorted(v); return v[min(len(v) - 1, int(round(q * (len(v) - 1))))]
todos = [x for v in lat.values() for x in v]
dur = (t1 - t0) if t0 else float(s)
m = re.search(r'tps = ([0-9.]+)', saida)
if todos:
    print(f"RESUMO|{nome}|clientes={c}|dur={s}s|taxa_alvo={r}|tps={len(todos)/dur:.1f}|tps_pgbench={m.group(1) if m else '-'}|n={len(todos)}|media={st.mean(todos):.1f}ms|p95={pct(todos,.95):.1f}ms|p99={pct(todos,.99):.1f}ms|max={max(todos):.1f}ms|falhas={falhas}|clientes_abortados={abort}|erros_conexao={conn}|deadlock={dead}")
else:
    print(f"RESUMO|{nome}|clientes={c}|sem transações|clientes_abortados={abort}|erros_conexao={conn}")
for sc in sorted(lat):
    v = lat[sc]; print(f"  {nomes[sc]:14s} n={len(v):6d} media={st.mean(v):7.1f} p95={pct(v,.95):7.1f} p99={pct(v,.99):7.1f} ms")
for ln in saida.splitlines():
    if 'error' in ln.lower() and 'aborted' not in ln: print('  ERRO:', ln[:200]); break
