#!/bin/bash
# Gera TODOS os manuais a partir das telas atuais do sistema e publica os de cada perfil em /manuais.
# Rodar sempre que uma funcionalidade ou tela mudar (ver LEIA-ME.md nesta pasta).
#   bash ferramentas/manuais/gerar_tudo.sh
set -e; cd "$(dirname "$0")"; R=$(cd ../.. && pwd)
[ -d node_modules ] || npm install --silent
# 1. servidor de teste (dados fictícios) e capturas das telas, no computador e no celular
curl -s -o /dev/null http://localhost:8766/ || { (cd "$R" && nohup node ferramentas/servidor_teste.js >/dev/null 2>&1 &); sleep 2; }
mkdir -p shots shots_q saida "$R/manuais"
node ic.js >/dev/null 2>&1 || true
node cap.js | grep -c '"postos"' | sed 's/^/telas no computador: /'
CEL=1 node cap.js | grep -c '"postos"' | sed 's/^/telas no celular: /'
python3 - <<'PY'
from PIL import Image
import glob, os
for f in glob.glob('shots/*.png'):   # 256 cores: mesma nitidez, arquivo menor
    Image.open(f).convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save('shots_q/' + os.path.basename(f), optimize=True)
PY
node logo.js
um() {   # um <perfil ou vazio> <arquivo de saída>
  rm -f paginas.json
  for i in 1 2 3; do PERFIL=$1 SHOTS=shots_q python3 gerar.py >/dev/null; node pdf.js; python3 pags.py >/dev/null; done
  python3 carimbo.py "$2" >/dev/null; qpdf --object-streams=generate --recompress-flate "$2" o.pdf; mv o.pdf "$2"
  echo "$2: $(pdfinfo "$2" | awk '/Pages/{print $2}') páginas, $(du -h "$2" | cut -f1)"
}
# 2. manual completo e um por perfil
um "" saida/Manual_do_Usuario_Mulheres_e_Quintais.pdf
for p in geral tecnica bolsista agente professor auxiliar mda mpa; do um $p "$R/manuais/manual-$p.pdf"; done
# 3. guias rápidos (uma folha por perfil) e documento para o contratante
python3 extras.py >/dev/null; node pdf2.js
mv Guias_rapidos_por_perfil_Mulheres_e_Quintais.pdf Por_que_o_sistema_e_essencial_Mulheres_e_Quintais.pdf saida/
i=1; for p in geral tecnica bolsista agente professor auxiliar mda mpa; do qpdf saida/Guias_rapidos_por_perfil_Mulheres_e_Quintais.pdf --pages . $i -- "$R/manuais/guia-$p.pdf"; i=$((i+1)); done
rm -f manual.pdf manual.html essencial.html guias.html logo.pdf
echo "Pronto. Completo, guias e contratante em ferramentas/manuais/saida; os de cada perfil em manuais/ (vão ao ar no próximo envio)."
