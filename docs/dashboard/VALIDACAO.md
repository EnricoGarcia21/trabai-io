# Dashboard do SAD — entrega e validação

Nova página `dashboard.html`, com seis painéis, implementada com a ordem de prioridade 1 → 5 → 3 → 2 → 4 → 6 do guia. As páginas anteriores receberam somente o link Dashboard; seus dados, cálculos e registros permanecem separados.

## Cobertura

- Painel 1: seis indicadores, status/meta, bullets, tendências permitidas, OTIF suavizado com amostra e quatro frases de ação.
- Painel 5: matriz família × indicador, inclinação anterior/atual e ranking divergente. E2/O3 não ganham séries históricas.
- Painel 3: risco empilhado, capital/cobertura, fila com paginação de 15 itens, aceitar/ajustar/recusar, justificativa, indicador de prazo e gaveta com cálculo e série do item.
- Painel 2: serviço semanal, Pareto com acumulado em quadro separado, OTIF anterior/atual com as duas metas e dispersão de prazo prometido/real.
- Painel 4: busca de item por código/nome, consumo/previsão/rupturas, aquecimento, acurácia, aprovação e desempenho por padrão.
- Painel 6: chuva parcial vazada, consumo no mesmo eixo temporal com cursor sincronizado, médias por cenário e cartão atual. Aviso de hipótese visível.
- Todo gráfico tem tooltip acessível ao foco, alternativa tabular e CSV. Cores e formatação seguem o guia. O gráfico opcional G3.4 foi omitido.

## Respostas às quatro perguntas finais do guia

1. **Filtros:** cada gráfico apresenta os filtros que não se aplicam. Fornecedor destaca os gráficos de fornecedores; família destaca risco/capital e benchmarking. Estoque é fotografia e não reage ao período. Fila e item seguem os filtros previstos. O quadro climático atual permanece fixo na data de posição.
2. **Escalas sem zero:** serviço, acurácia e aprovação semanais, inclinação de benchmarking e sparklines usam escala automática e mostram aviso. Barras partem de zero, incluindo valores negativos em torno da linha de zero se ocorrerem.
3. **Sem armazenamento:** leitura e escrita de `localStorage` têm tratamento de exceções. As decisões continuam em memória e a página informa quando não podem ser persistidas. Nenhum usuário/nome/e-mail é armazenado; apenas perfil e justificativa informada.
4. **Aceite:** passaram os testes numéricos e funcionais abaixo; não ficaram testes essenciais pendentes. As ambiguidades do contrato estão documentadas nesta página e no plano.

## Evidências

- `node --test tests/dashboard.test.cjs`: seis testes aprovados — contrato/seis KPIs/janelas, política 23 críticos + 13 em atenção, decisões/prazos/CSV/média móvel, proporção das barras por quantidade de itens, identificação das linhas e títulos derivados dos dados.
- `node tests/dashboard.smoke.cjs`: aprovado no Chrome com Playwright. Verifica seis painéis; seis valores oficiais; OTIF com tolerância e clima; uma única carga do JSON e ausência de chamadas externas; ausência de erros/avisos no console; larguras 390/820/1366 sem overflow da página; filtros e destaques; alinhamento entre chuva/consumo; tabelas de todos os gráficos; CSVs; ajuste de compra; persistência após recarga; gaveta/Escape; armazenamento bloqueado e contrato inválido.
- `node tests/smoke.cjs`: regressão das páginas anteriores aprovada.
- `node --check dashboard/*.mjs` individualmente e `git diff --check`: aprovados.
- Inspeção visual de capturas de desktop/celular e dos seis painéis. Tabelas e gráficos extensos têm rolagem dentro de seu quadro.
- Revisão independente: três problemas encontrados (destaque de família, alinhamento temporal, suavização/amostra do OTIF), corrigidos, cobertos por regressão e reconferidos pelo revisor.

Para executar os testes de navegador é necessário Playwright e um navegador previamente instalados; `PLAYWRIGHT_MODULE_PATH` e `CHROME_PATH` permitem indicar seus caminhos. Não foram instaladas dependências.

## Ambiguidades resolvidas pela alternativa mais simples

- **Períodos personalizados:** o JSON não traz todos os numeradores semanais originais. Nas janelas prontas, cartões usam `kpi_resumo`. Para Ano/recorte agrícola, usam-se os KPIs semanais ponderados por observações, pedidos, requisições ou consumo. O aviso de arredondamento fica no cartão; nunca é feita média simples de percentuais.
- **Ano em fornecedores/Pareto:** o contrato fornece somente ATUAL/ANTERIOR. O dumbbell compara ambas; dispersão/Pareto mostram explicitamente ATUAL quando Ano está selecionado, com alternador próprio no Pareto. Não se inventa agregado anual.
- **Clima e família:** a descrição de G6.2 menciona filtrar família, mas a matriz explícita diz que família não se aplica ao clima. Foi seguida a matriz, com selo explicativo.
- **Datas de decisão:** sugestão datada pela posição do DW; decisões usam a data real do clique. Uma decisão tardia não é artificialmente marcada como no prazo.
- **Semanas de clima:** a semana parcial final é exibida junto à janela atual e ambas as parciais aparecem em Ano. Não se estima consumo onde o contrato não fornece histórico.

O ETL não foi executado nem modificado: foi usado o contrato entregue, sem recalcular ou substituir a base. Não foram adicionados API meteorológica, recebimento físico de estoque ou backend.

## Correções de aderência ao guia

- Foco do teclado preservado após paginação, seleção de indicador/família e confirmação de decisão. Ao chegar à última página, o foco segue para um controle de paginação disponível.
- G3.1 representa quantidades absolutas: famílias com mais itens têm barras maiores. O percentual crítico e sua meta ficam em uma coluna separada, sem misturar quantidade com percentual.
- Linhas identificadas diretamente no gráfico, com marcadores iguais aos da legenda.
- Títulos de benchmarking, consumo do item e clima apresentam conclusões calculadas a partir dos dados existentes.
- Testes de navegador ampliados para reproduzir os problemas de foco e verificar as correções, além das três larguras exigidas. Revisão independente do diff e inspeção visual dos painéis 2, 3 e 4 concluídas sem achados relevantes.

Estas correções não alteram o contrato JSON, os cálculos dos indicadores, os pacotes de dados/ETL ou as outras abas.
