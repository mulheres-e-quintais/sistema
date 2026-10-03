import json,warnings;warnings.filterwarnings('ignore')
from pypdf import PdfReader
r=PdfReader('manual.pdf');ids=json.load(open('ids.json'));nd=r.named_destinations
out={}
for i in ids:
    d=nd.get(i) or nd.get('/'+i)
    if d: out[i]=r.get_destination_page_number(d)+1  # capa não conta
json.dump(out,open('paginas.json','w'));print(len(r.pages),'pág;',len(out),'/',len(ids))
