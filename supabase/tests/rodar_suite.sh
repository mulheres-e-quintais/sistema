#!/bin/bash
DB=$1; cd /home/claude/sistema/supabase
L="cadastro_equipe correcoes_auditoria_2 fila_celular desligamento_59 passagens_eventos tetos lgpd_equipe planilha_mpa auditoria_campo auditoria_qa regras_decididas $2 novo_acesso ultimos_acessos revisao_seguranca seguranca_revisao fic_encontros validacao_diagnostico desde_o_inicio agua venda execucao execucao_planilhas desligamento conferencia_auxiliar"
A=""; for t in $L; do A="$A -f tests/test_$t.sql"; done
sudo -u postgres psql -X -q -d $DB $A > /tmp/suite_$DB.out 2>&1
grep -c "PASSOU" /tmp/suite_$DB.out; grep -c "FALHOU" /tmp/suite_$DB.out; grep -c "ERROR" /tmp/suite_$DB.out
