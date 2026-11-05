# Dashboard do SAD — plano de implementação

> Execução: superpowers:executing-plans, nesta sessão. O guia fornecido pelo usuário é a especificação; seguir sua ordem e resolver ambiguidades pela alternativa mais simples.

**Objetivo:** adicionar Dashboard com seis painéis e fonte única `dashboard/dados_alcar.json`.
**Arquitetura:** página própria na navegação existente; módulos ES sem bibliotecas novas. Home, Compras e Decisões mantêm seus scripts, dados e comportamento.
**Especificação:** `GUIA_DASHBOARD_SAD.md` fornecido na pasta pai, copiado para `docs/dashboard/` com o contrato.

## Restrições

- Dados e metas somente do JSON, sem APIs externas; cálculos limitados à seção 10 e agregações por razão de somas.
- Tokens e formatos do guia; tooltip, tabela e CSV em todo gráfico; aviso fictício por painel.
- Não produzir séries de cobertura ou críticos; preservar aquecimento e clima parcial.
- Decisões do Dashboard isoladas dos registros do protótipo antigo, com o schema da seção 8.
- Validar números da seção 11, filtros, memória sem localStorage, exportações, teclado e larguras 390/820/1366.

## Arquivos

`dashboard.html`: nova aba. `dashboard/{tokens.css,core.mjs,charts.mjs,paineis.mjs,app.mjs,dados_alcar.json}`: apresentação, regras puras, gráficos, painéis e integração. `tests/dashboard.{test,smoke}.cjs`: testes numéricos e de navegador. Nas páginas existentes adicionar somente link Dashboard. Em `serve.cjs` permitir JSON e módulos ES.

## Etapas e verificações

- [x] 1. Base + painel 1: testes de contrato, janela e agregação; carga única, filtros, seis cartões, bullets/sparklines e frases de ação.
- [x] 2. Painel 5: mapa de calor, inclinação com rótulos sem colisão e ranking divergente; E2/O3 sem anterior, metadados de filtros.
- [x] 3. Painel 3: risco/capital por família, fila paginada, decisões e gaveta; testar justificativa, quantidade, prazo, persistência e 23/13 no what-if padrão. G3.4 opcional omitido.
- [x] 4. Painel 2: linhas, Pareto, dumbbell e dispersão de fornecedores; teste das duas metas e da tolerância de dois dias.
- [x] 5. Painel 4: consumo do item, acurácia, aprovação e padrões; testar exclusão do aquecimento e médias móveis sem converter nulos em zero.
- [x] 6. Painel 6: chuva parcial, consumo com cursor sincronizado, cenários e cartão atual; respeitar hipótese e matriz de filtros.
- [x] 7. Testes completos, revisão independente, inspeção visual, documentação, commit local e publicação já autorizada no repositório.

## Foco da revisão

Filtros impossíveis devem exibir "não se aplica". Nulos/denominador zero não viram zero. Falha de rede ou schema inválido deve gerar mensagem com repetição da carga. Armazenamento bloqueado deve manter decisões em memória. Conteúdo de justificativa é escapado no HTML e neutralizado em CSV.

## Decisões de implementação

- O contrato não exporta numeradores completos de todos os KPIs semanais. Nas janelas prontas usar `kpi_resumo`; para Ano/recortes agrícolas agregar os KPIs publicados com os pesos disponíveis (itens observados, pedidos, requisições, consumo), nunca média simples de percentuais. Exibir aviso sobre arredondamento das séries publicadas.
- Fornecedores/Pareto não têm janela Ano; nessa escolha mostrar as duas janelas disponíveis identificadas (dumbbell) ou ATUAL explicitamente, sem inventar anual.
- Filtros de clima não usam família, seguindo a matriz; a descrição de G6.2 menciona família de forma conflitante. A matriz explícita governa os três gráficos de clima.
- O3 usa prazo desde a data de posição do contrato, sem alterar datas para aparentar decisões no prazo.

## Registro

Plano criado antes da implementação. Testes e resultados serão registrados no relatório de validação.

Validação: testes numéricos, smoke do Dashboard e regressão antiga aprovados. Três achados da revisão corrigidos e reconferidos. Relatório em docs/dashboard/VALIDACAO.md.
