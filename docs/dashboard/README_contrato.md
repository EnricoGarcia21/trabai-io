# Contrato de dados — Data Mart de Suprimentos (Usina Alcar)

Tudo é fictício. Reprodução completa: `python3 etl.py && python3 testes_dw.py && python3 exportar.py` (semente fixa, resultado idêntico a cada execução).

## O que entregar para a tela
- `saida/contrato/dados_alcar.json` — pacote único (≈1 MB) com meta, indicadores, resumo, séries semanais, itens com política e risco, clima e decisões.
- `saida/contrato/csv/*.csv` — uma tabela por arquivo (23 tabelas), UTF-8, vírgula, ponto decimal, datas AAAA-MM-DD, vazio = nulo.
- `saida/contrato/dicionario_dados.md` / `.csv` — descrição de todas as colunas.
- `saida/contrato/er_alcar.png` / `.svg` — diagrama entidade-relacionamento.

## Convenções
- `sk_*` são chaves inteiras; `sk_tempo` e `sk_semana` são datas AAAAMMDD (semana = segunda-feira). Membro 0 = não informado / não se aplica.
- Janela ATUAL = 13 semanas de 20/07 a 18/10/2026; ANTERIOR = as 13 anteriores. Data de posição do estoque: 22/10/2026.
- Os totais são razão de somas (numerador e denominador em `ouro_kpi_semanal`), nunca média de médias.
- As 4 primeiras semanas (`aquecimento = 1`) só iniciam os modelos e ficam fora da acurácia.
- Metas dos indicadores são hipóteses a validar (`dim_indicador`).
- LGPD: requisitante, CPF e CNPJ não existem nesta camada; fornecedor pessoa física aparece como "Fornecedor PF (protegido)".

## Pontos de atenção para a tela
- `fact_decisao` e `vw_kpi_decisao_prazo` vêm vazios: o painel grava as decisões; o "% decidido no prazo" só existe depois disso.
- Cobertura (E2) e itens críticos (O3) são fotografias de 22/10; não há série histórica de saldo. Para tendência, gravar um snapshot por semana.
- `tolerancia_prazo_dias` (em `etl.py`, `PARAMETROS_ETL`) define o prazo do OTIF; com 0 (estrito) o OTIF geral é ≈ 22%.
