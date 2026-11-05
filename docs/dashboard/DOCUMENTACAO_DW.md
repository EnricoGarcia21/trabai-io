# Documentação técnica — Data Mart de Suprimentos (Usina Alcar)

Todos os dados são fictícios. Reprodução completa, com semente fixa: `python3 gerar_fontes.py && python3 etl.py && python3 testes_dw.py && python3 exportar.py`.

## 1. Visão geral
Fontes (SAP, manutenção/PCM, formulário de ruptura, calendário da safra, clima do INMET) → **bronze** (cópia fiel) → **prata** (limpa, com regras de negócio e quarentena) → **ouro** (modelo estrela + modelos de previsão e política de estoque) → **indicadores** → **contrato de dados** (JSON e CSV) consumido pela tela. Tecnologia: Python 3 + SQL (SQLite com funções de janela). A escolha do SQLite é de portabilidade: o mesmo SQL roda em PostgreSQL ou no Power BI com ajustes de dialeto.

| Camada | Tabelas | Papel |
|---|---|---|
| Bronze | `bronze_*` (13) | texto como veio + `_arquivo_origem`, `_data_carga`, `_linha` |
| Prata | `prata_*` (14, incluindo `prata_quarentena`), `stg_*` (2 visões) | tipos, datas, códigos e regras |
| Ouro | 7 dimensões, 6 fatos | esquema estrela de Suprimentos |
| Indicadores | `ouro_kpi_*`, `vw_kpi_*`, `ouro_estoque_familia`, `ouro_ruptura_causa`, `ouro_otif_sensibilidade`, `ouro_clima_atual` | os 6 indicadores |

## 2. Fontes
| Fonte | Arquivo | Conteúdo | Volume |
|---|---|---|---|
| SAP MM | `SAP_MARA`, `SAP_T023T`, `SAP_MARD` | cadastro, famílias, saldo (22/10) | 200 itens, 8 famílias |
| SAP MM | `SAP_MSEG` | movimentos 201 (saída), 202 (estorno), 101 (recebimento) | 14.368 |
| SAP MM | `SAP_EBAN`, `SAP_EKKO`, `SAP_EKPO`, `SAP_LFA1` | requisição, pedido, item do pedido, fornecedor | 1.602 pedidos, 12 fornecedores |
| PCM | `PCM_EQUIPAMENTOS`, `PCM_ORDENS` | equipamentos e ordens de manutenção | 30 e 6.344 |
| Formulário | `FORM_RUPTURAS` | faltas informadas, causa em texto livre | 376 |
| Planilha | `CALENDARIO_SAFRA_2026` | safra, entressafra, paradas | 5 |
| Externa | 2 arquivos horários INMET (A707, A718) | chuva, temperatura, umidade (simulados) | 8.760 horas cada |

## 3. Regras do ETL
| Regra | O que faz | Onde |
|---|---|---|
| R01 | remove duplicatas (mantém a carga mais recente) | prata |
| R02 | padroniza código do material (`AL-nnnnnn`, sem espaços, maiúsculas) | `norm_cod` |
| R03 | converte datas (AAAAMMDD, DD.MM.AAAA, DD/MM/AAAA) e números (vírgula decimal) | `dt_iso`, `num_br` |
| R04 | chave ou data nula vai para a quarentena | `prata_quarentena` |
| R05 | estorno 202 anula a saída 201, com competência na data da saída original | `prata_movimento` |
| R06 | integridade referencial (material, fornecedor, equipamento existentes) | prata |
| R07 | coerência de datas (liberação ≥ requisição; recebimento ≥ pedido) | `stg_pedido` |
| R08 | tempo de aprovação = liberação − requisição; lead time = recebimento − pedido | `prata_pedido` |
| R09 | clima: hora UTC → local (UTC−3) → diário → semanal; descarta o posterior a 22/10 | `prata_clima_*` |
| R10 | causa de ruptura em texto livre → 5 categorias | `cat_causa` |
| R11 | LGPD: requisitante e CPF/CNPJ não passam; fornecedor PF pseudonimizado (sha256 com sal) | `pseudo` |
| R12 | cenário climático: chuvoso (≥ 30 mm ou ≥ 4 dias de chuva em 7) prevalece; seco (≥ 5 dias seguidos sem chuva); normal | `prata_clima_semanal` |
| D05 | consumo sem ordem de manutenção vai ao equipamento 0 "NÃO INFORMADO" | `dim_equipamento` |

Resultado da carga de 23/10: 32 linhas em quarentena (12 sem material, 5 material inexistente, 6 recebimento antes do pedido, 4 liberação antes da requisição, 5 formulário sem data) e 4 formulários duplicados. O log completo (`saida/etl_log.csv`) reconcilia entrada e saída de cada etapa.

## 4. Modelo dimensional
Diagrama: `er_alcar.png`. Grãos: `fact_consumo` item × dia × equipamento × tipo de manutenção; `fact_pedido` linha de pedido; `fact_ruptura` falta informada (item × semana); `fact_previsao` item × semana; `fact_politica_estoque` item na data de posição; `fact_decisao` decisão do usuário (vazia na carga). `dim_tempo` é usada em papéis: requisição, liberação, pedido, prevista, recebimento e competência. Dicionário de 229 colunas em `dicionario_dados.md`.

## 5. Modelos analíticos (`modelos.py`)
- **Classificação da demanda** (Syntetos-Boylan-Croston): ADI (intervalo médio entre demandas) e CV². Itens com ADI ≥ 1,32 usam Croston/SBA (α = 0,1); os demais, suavização exponencial simples (α = 0,3). Resultado: 84 intermitentes (SBA) e 116 suaves (SES). A média móvel de 4 semanas é calculada como referência.
- **Aquecimento:** as 4 primeiras semanas iniciam os modelos e ficam fora da acurácia.
- **Política de estoque:** `L = Lf + La`; `SS = z·√((R+L)·σd² + d̄²·σL²)`; `PP = d̄·(R+L) + SS`; `lote = máx(3, ⌈30·d̄⌉)`; R = 7 dias, z = 1,645 (95%), janela de 13 semanas. Lf e σLf vêm dos pedidos realizados do fornecedor principal; La e σLa, do tempo de aprovação. Risco: **crítico** se a ruptura projetada cai dentro de L; **atenção** se a posição (saldo + trânsito) ≤ PP.

## 6. Indicadores
| Código | Indicador | Fórmula | Meta (hipótese) | Valor 22/10 |
|---|---|---|---|---|
| E1 | Nível de serviço | 1 − itens-semana com ruptura ÷ itens-semana | ≥ 95% | 95,5% |
| E2 | Cobertura de estoque | Σ saldo×custo ÷ Σ demanda diária×custo | 30–45 dias | 49,2 dias |
| E3 | Confiabilidade do fornecimento (OTIF) | recebidos até a data prevista e completos ÷ recebidos | 93% (etapa: 50%) | 22,4% |
| O1 | Acurácia da previsão | 1 − Σ\|erro\| ÷ Σ consumo | ≥ 75% | 69,6% |
| O2 | Tempo de aprovação | média (liberação − requisição) | ≤ 3 dias | 2,89 dias |
| O3 | Itens em risco crítico | críticos ÷ catálogo; % de sugestões decididas no prazo | ≤ 5% | 11,5% (23 itens) |

Totais são **razão de somas** (numerador e denominador guardados em `ouro_kpi_semanal`). Prazo de decisão (O3): 1 dia para crítico e 3 dias para atenção.

## 7. Qualidade: 48 testes (`testes_dw.py`)
47 passam e 1 é informativo (risco: 23 críticos e 13 em atenção contra 21 e 17 do protótipo). Cobrem: reconciliação de linhas (bruto = prata + quarentena + duplicadas), integridade referencial (19 relações), consumo semanal igual ao protótipo (8.200 células), estornos, pedidos e lead time recalculados em pandas, rupturas (367), clima de 22/10 contra a planilha de referência, fórmulas de SS e PP, indicadores SQL contra pandas, sensibilidade do OTIF e LGPD (nenhuma coluna ou valor de requisitante, CPF, CNPJ ou nome de pessoa física na camada ouro).

## 8. Diferenças em relação ao protótipo v1 (declarar no relatório)
1. Lead time e desvio vêm dos pedidos realizados (no protótipo eram parâmetros do gerador); σ do lead time é menor, e o risco muda de 21/17 para 23/13.
2. A previsão inicia nas 4 primeiras semanas do DW (o protótipo tinha 4 semanas anteriores simuladas).
3. OTIF é derivado (22,4%); o protótipo exibia ≈ 94%, número simulado sem derivação.
4. A classificação SBC reproduziu os 84 itens intermitentes do gerador (nenhum item mudou de método).

## 9. Limitações
- Sem histórico de saldo: E2 e O3 são fotografias; para tendência, gravar um snapshot semanal.
- z único de 95% (o relatório de 22/10 prevê calibrar por categoria); sem classificação XYZ.
- Clima simulado: a hipótese de efeito do clima não é comprovada pelos dados.
- Uma estação principal (A707); a A718 só como apoio.
- Fórmula com (R + L), mantida por decisão do grupo (alternativa R + L − 1 registrada).
