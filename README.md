# Painel de Suprimentos Alcar

Protótipo acadêmico com dados fictícios. HTML, CSS, JavaScript e base simulada separados, sem dependências para executar o painel.

## Nova aba Dashboard

Abra `dashboard.html` pelo menu. A aba usa exclusivamente `dashboard/dados_alcar.json` do contrato DW, com seis painéis, filtros conforme a matriz do guia, exportação CSV, visão tabular, simulação de nível de serviço e decisões persistidas localmente. Home, Compras e Decisões preservam o protótipo anterior.

Especificação em `docs/dashboard/GUIA_DASHBOARD_SAD.md`; resultados, limitações do contrato e respostas às perguntas finais em `docs/dashboard/VALIDACAO.md`.

Testes adicionais:

```sh
node --test tests/dashboard.test.cjs
node tests/dashboard.smoke.cjs
```

## Executar

Com Node.js instalado, execute na pasta do projeto:

```sh
node serve.cjs
```

Abra http://127.0.0.1:4173. Use sempre a mesma origem (endereço e porta) para preservar filtros e decisões entre as páginas. Também pode hospedar os arquivos em qualquer servidor estático.

O servidor precisa permanecer em execução durante o uso. O Dashboard mostra um erro com opção de tentar novamente se seus módulos falharem ou o JSON não responder em 15 segundos.

## Ajustes da Home e Compras

- Setas junto aos títulos de risco e benchmarking substituem os botões de recolher/expandir.
- Os seis indicadores da Home têm botão de informação com significado e fórmula. As explicações abrem por mouse, teclado ou toque; Escape fecha.
- Compras possui filtro de criticidade (Crítico/Atenção), preservado na navegação e recarga e removido por Limpar filtros.
- O cabeçalho acompanha a rolagem nas quatro telas; a posição dos filtros considera a altura real do cabeçalho.
- Home, Compras, Decisões e Dashboard usam a mesma disposição agrupada dos links de navegação.
- A consulta de IA abre uma caixa flutuante expansível, sem bloquear a página. Fechar ou pressionar Escape dentro da consulta preserva a conversa para reabertura na mesma página.

Verificação adicional: `node tests/ajustes-home.cjs` (mesma configuração de Playwright e Chrome dos demais testes).

Navegação e consulta flutuante: `node tests/navegacao-chat.cjs`.

## Arquivos

- `index.html`: Home, indicadores, consumo, clima, risco e benchmarking.
- `compras.html`: sugestões, aceite/recusa do analista e aprovação/devolução do setor de compras.
- `decisoes.html`: histórico persistido no navegador e exportação CSV.
- `css/`: estilos existentes e ajustes de navegação e layout.
- `js/dados.js`: base simulada original, com semente fixa.
- `js/app.js`: cálculos, gráficos e regras do protótipo original.
- `js/interface.js`: navegação, filtros compartilhados, janela do agente, mapa demonstrativo e exportação XLSX.
- `tests/smoke.cjs`: testes funcionais com Playwright.

## Ajustes do documento

- Filtro “Família” renomeado para “Tipo de item”. Período substituído por datas inicial/final. Como a base é semanal, entram semanas que se sobrepõem ao intervalo informado.
- Filtros de item, fornecedor, tipo, safra, demanda, ABC, risco e nível de serviço preservados ao navegar. As datas filtram o consumo histórico; risco e compras representam o estoque atual. As decisões atuais continuam visíveis mesmo fora do período histórico, respeitando os filtros dos itens.
- Consumo exportado como `.xlsx` com valores numéricos, respeitando datas, itens e unidade selecionada. A planilha contém o histórico real/previsto do recorte, sem as oito semanas de projeção ilustrativa.
- Card climático alterna com um mapa esquemático da usina fictícia. Não há localização ou serviço meteorológico definido no documento: o mapa usa os mesmos dados simulados, sem radar nem previsão real.
- Compras e decisões possuem páginas próprias, com links no cabeçalho. A Home contém um resumo e botão para abrir as compras. Aceites, recusas, aprovações e devoluções aparecem no histórico.
- Risco ocupa a largura disponível; risco e benchmarking possuem controles de recolher/expandir.
- Agente acessível por botão flutuante que expande uma caixa de conversa sem bloquear a página, com fechamento por botão ou Escape.

## Validação

Os testes usam Playwright previamente instalado; não há instalação automática:

```sh
node tests/smoke.cjs
```

Se necessário, defina `PLAYWRIGHT_MODULE_PATH` com o caminho do módulo instalado e `CHROME_PATH` com o executável do navegador. Os testes usam uma porta local livre e um contexto de navegador isolado.

O protótipo não possui autenticação real, integração SAP ou IA generativa. Perfis são demonstrativos; decisões e filtros ficam no armazenamento local do navegador. A aprovação representa uma requisição simulada, sem entrada física de estoque. O mapa não deve ser usado como informação meteorológica operacional.
