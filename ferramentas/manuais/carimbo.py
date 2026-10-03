import os,sys,warnings;SAIDA=sys.argv[1] if len(sys.argv)>1 else 'Manual_do_Usuario_Mulheres_e_Quintais_v1.0.pdf';warnings.filterwarnings('ignore')
from pypdf import PdfReader,PdfWriter
r=PdfReader('manual.pdf');lg=PdfReader('logo.pdf').pages[0]
w=PdfWriter(clone_from=r)
for i,p in enumerate(w.pages):
    if i: p.merge_page(lg); p.compress_content_streams()
w.add_metadata({'/Title':'Manual do Usuário — Mulheres & Quintais','/Author':'Projeto Quintais Produtivos para Mulheres Rurais — IFRN Campus Apodi','/Subject':'Versão 1.0 — 2026'})
w.write(SAIDA)
r2=PdfReader(SAIDA)
print(len(r2.pages),'pág; marcadores:',len(r2.outline),'; destinos:',len(r2.named_destinations))
