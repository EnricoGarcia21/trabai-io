# Guia técnico do dashboard — nova aba dentro do SAD da Usina Alcar

> **Para quem é:** a pessoa que vai montar a aba "Dashboard" dentro do SAD (HTML/CSS/JS). Também serve de prompt: pode ser colado inteiro em uma IA de código.
> **Em uma frase:** uma aba com **6 painéis**, cada um respondendo **uma única pergunta**, alimentada por **um único arquivo**, o `dados_alcar.json`, com os mesmos números do relatório.
> **Dados:** 100% fictícios (empresa, itens e clima simulados). Isso aparece na tela, no rodapé de cada painel.

---

## 0. Prompt de abertura (cole isto primeiro na IA)

```
Você é um desenvolvedor front-end sênior. Vou colar um guia técnico. Implemente UMA NOVA ABA chamada
"Dashboard" dentro de um app HTML/CSS/JS já existente (o SAD da Usina Alcar), sem alterar as demais abas.
Regras inegociáveis: (1) ler somente o arquivo dados_alcar.json; (2) nenhum número escrito à mão no código;
(3) usar apenas as cores e tokens do guia; (4) cada gráfico tem tooltip, visão em tabela e exportação CSV;
(5) funcionar sem erro de console em 390, 820 e 1366 px, sem rolagem horizontal da página;
(6) formatar tudo em pt-BR; (7) seguir os testes de aceite da seção 11.
Entregue em etapas: primeiro tokens + filtros + painel 1; depois um painel por vez, na ordem de prioridade da seção 3.
Se algo do guia for ambíguo, escolha a opção mais simples e liste a dúvida no fim da resposta.
```

---

## 1. A ideia, de forma lúdica

Pense no dashboard como um **livro de 6 capítulos**. Cada capítulo (painel) começa com uma pergunta e termina com uma resposta em uma frase. Quem abre o livro em 30 segundos deve saber se a usina está bem; quem lê tudo deve saber *por que* e *o que decidir*.

| # | Painel | A pergunta que ele responde | Quem lê | Indicadores |
|---|---|---|---|---|
| 1 | **Como estamos?** | A saúde do abastecimento está dentro da meta? | Gestor de suprimentos | os 6 |
| 2 | **Estamos entregando?** | A manutenção recebe a peça a tempo, e os fornecedores cumprem? | Gestor, compras | E1, E3 |
| 3 | **Onde está o risco e o dinheiro?** | Quais itens vão faltar, e quanto capital está parado? | Analista, gestor | E2, O3 |
| 4 | **Dá para confiar na previsão e na aprovação?** | O modelo acerta, e a compra anda rápido? | Analista, compras | O1, O2 |
| 5 | **Como nos comparamos?** | Qual família vai melhor ou pior que a média, e que direção segue? | Todos | os 6 |
| 6 | **O clima conta?** | A chuva muda o consumo? (hipótese a testar) | Analista, PCM | contexto |

Regra de ouro: **um painel, uma pergunta**. Se um gráfico não ajuda a responder a pergunta do painel, ele vai para outro painel ou sai.

---

## 2. Dados: o que existe e o que NÃO existe

**Arquivo único:** `dados_alcar.json` (≈ 1 MB). Carregue uma vez, guarde em memória, derive tudo dele. Não chame APIs externas.

| Chave | Linhas | Para que serve | Campos principais |
|---|---|---|---|
| `meta` | 1 | data de posição, parâmetros, aviso de dados fictícios | `data_posicao` (22/10/2026), `ultima_semana_fechada`, `parametros{}` |
| `indicadores` | 6 | a matriz: nome, fórmula, meta, sentido | `codigo`, `nome`, `unidade`, `meta_min`, `meta_max`, `sentido`, `formula`, `pergunta_de_negocio` |
| `kpi_resumo` | 54 | valor atual × anterior, por família e TOTAL | `familia`, `codigo`, `valor_atual`, `valor_anterior`, `variacao`, `dentro_da_meta`, `tendencia` |
| `kpi_semanal` | 369 | séries semanais (41 semanas × 8 famílias + TOTAL) | `semana_inicio`, `semana_idx`, `janela_13s`, `familia`, `nivel_servico_pct`, `otif_pct`, `acuracia_previsao_pct`, `tempo_aprovacao_dias`, `lead_time_real_dias`, `lead_time_prometido_dias`, `pedidos_recebidos`, `requisicoes` |
| `kpi_fornecedor` | 24 | 12 fornecedores × 2 janelas | `cod_fornecedor`, `fornecedor`, `janela`, `otif_pct`, `lead_time_real_dias`, `lead_time_prometido_dias`, `atraso_medio_dias`, `pedidos_recebidos` |
| `ruptura_causa` | 8 | Pareto das causas × 2 janelas | `janela`, `causa`, `rupturas`, `dias_em_falta`, `participacao_pct` |
| `otif_sensibilidade` | 8 | OTIF com tolerância de 0, 1, 2, 3 dias × 2 janelas | `tolerancia_dias`, `janela`, `otif_pct`, `no_prazo_pct` |
| `estoque_familia` | 9 | capital, cobertura e itens por faixa de risco | `familia`, `capital_imobilizado`, `cobertura_dias`, `itens_criticos`, `itens_atencao`, `itens_sem_risco`, `criticos_pct`, `valor_sugerido` |
| `itens` | 200 | política de estoque do item em 22/10 | `cod`, `nome`, `fam`, `abc`, `padrao`, `metodo`, `custo`, `forn`, `saldo`, `transito`, `d`, `sdd`, `L`, `sL`, `ss`, `pp`, `lote`, `dias_ruptura`, `risco`, `qtd`, `valor`, `cobertura` |
| `itens_semana` | 8.200 | consumo, previsão e ruptura de cada item por semana | `cod`, `semana`, `consumo`, `previsao`, `aquecimento`, `ruptura` |
| `clima_semanal` | 43 | chuva e cenário por semana | `semana_inicio`, `chuva_mm`, `dias_com_chuva`, `cenario`, `n_dias`, `semana_completa` |
| `clima_atual` | 1 | cenário nos 7 dias até 22/10 | `chuva_7d_mm`, `dias_com_chuva_7d`, `dias_sem_chuva_seguidos`, `cenario` |
| `familias`, `fornecedores`, `semanas` | 8 / 12 / 41 | listas para filtros | `id`, `nome` |
| `decisoes` | 0 | **vazia**: o painel grava aqui | ver seção 8 |

### Armadilhas conhecidas (leia antes de codar)
1. **Unidades:** todos os campos `*_pct` já estão em % (95.5, não 0.955).
2. **`familia = "TOTAL"`** existe em `kpi_resumo`, `kpi_semanal` e `estoque_familia`. Não é uma família: é o benchmark da empresa.
3. **`janela_13s`**: `ATUAL` = semanas 29–41 (20/07 a 18/10), `ANTERIOR` = semanas 16–28, `null` = fora das janelas.
4. **Aquecimento:** nas 4 primeiras semanas `acuracia_previsao_pct` é `null` e `itens_semana.aquecimento = 1`. Mostre-as em cinza, nunca como zero.
5. **Semana pequena, número ruidoso:** `otif_pct` semanal usa poucos pedidos (às vezes 0 ou 100). **Mostre média móvel de 4 semanas** nas linhas semanais de OTIF e escreva o *n* no tooltip (`pedidos_recebidos`).
6. **E2 (cobertura) e O3 (itens críticos) são fotografias de 22/10.** Não têm série semanal. Não invente linha de tendência para eles.
7. **Semana parcial:** `clima_semanal` tem a primeira (29/12) e a última (19/10) com `n_dias = 4`. Desenhe com barra vazada (só contorno) e avise no tooltip.
8. **Fornecedor pessoa física** vem como "Fornecedor PF (protegido)". Não tente identificar.
9. **Sem cruzamentos que o dado não permite:** não existe OTIF semanal por fornecedor, nem indicador por fornecedor × família. Veja a matriz de filtros (seção 4).
10. **OTIF = 22,4%** na janela atual (regra estrita: recebido até a data prevista e completo). Está certo, não é bug. A meta final é 93%, e há uma **meta intermediária de 50%** em `meta.parametros.meta_otif_intermediaria_pct`. Mostre as duas (seção 6, gráfico G2.3).

---

## 3. Ordem de construção (prioridade)

Ordem pensada na rubrica: *dashboard interativo com filtros dinâmicos e benchmarking com tendências visíveis*.

1. Tokens de cor + barra de filtros + carregamento do JSON (**base de tudo**)
2. **Painel 1** Como estamos? (o cartão de visita)
3. **Painel 5** Como nos comparamos? (benchmarking, exigido pela rubrica)
4. **Painel 3** Onde está o risco e o dinheiro? (ação e decisão)
5. **Painel 2** Estamos entregando?
6. **Painel 4** Previsão e aprovação
7. **Painel 6** O clima conta?
8. Acabamento: exportações, tabela alternativa, testes, responsivo

---

## 4. Filtros globais (a barra fixa no topo da aba)

| Filtro | Valores | Padrão |
|---|---|---|
| Família | Todas + 8 famílias | Todas (`TOTAL`) |
| Janela | Atual (13 sem) · Anterior (13 sem) · Ano (41 sem) | Atual |
| Período agrícola | Todos · Safra (a partir de 01/04) · Entressafra (antes) | Todos |
| Fornecedor | Todos + 12 | Todos |
| Curva ABC | Todas · A · B · C | Todas |
| Risco | Todos · crítico · atenção · sem risco | Todos |
| Padrão de demanda | Todos · suave · intermitente | Todos |
| Nível de serviço (what-if) | controle de 90 a 99,5% | 95% |

**Quem reage a quê** (o dado tem limites; filtro que não se aplica deve **sinalizar**, não sumir):

| Gráfico | Família | Janela | Período | Fornecedor | ABC / Risco / Padrão |
|---|---|---|---|---|---|
| Cartões, linhas semanais (G1.1, G2.1, G4.2, G4.3) | ✔ | ✔ | ✔ | — | — |
| Pareto de causas (G2.2) | — | ✔ | — | — | — |
| Dumbbell e dispersão de fornecedores (G2.3, G2.4) | — | ✔ | — | destaca | — |
| Estoque e risco (G3.1, G3.2) | ✔ destaca | — (foto de 22/10) | — | — | — |
| Fila de compra e dispersão de itens (G3.3, G3.4) | ✔ | — | — | ✔ | ✔ |
| Item × semana (G4.1, G4.4) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Benchmarking (G5.x) | destaca | — (compara as duas) | — | — | — |
| Clima (G6.x) | — | ✔ | ✔ | — | — |

Quando um filtro não afeta o gráfico, mostre um selo discreto "não se aplica a este gráfico" (texto, cor `--cinza`).

**Estado na URL (opcional, recomendado):** `#fam=ROL&janela=ATUAL&nivel=95` para colar link com o filtro.

---

## 5. Cores e estilo (siga os tokens do SAD)

### 5.1 Tokens que já existem no SAD (não mude)

```css
:root{
  --oliva:#47682C;        /* cor principal: foco, barras principais, botão primário */
  --oliva-claro:#E7EEDD;  /* fundos de destaque, faixa "sem risco" */
  --fundo:#F4F7EF;        /* fundo da página */
  --tinta:#080F0F;        /* texto e linhas de meta */
  --cinza:#5E6B66;        /* texto secundário, benchmark TOTAL */
  --cinza-2:#46524D;
  --borda:#D5DAD7;
  --branco:#fff;
  --crit:#B3261E;         /* vermelho: SOMENTE crítico / fora da meta */
  --aten:#C98A00;         /* amarelo: SOMENTE atenção */
  --ok:#47682C;           /* ok = oliva */
}
```

### 5.2 Três cores novas, derivadas da paleta (adicione como tokens)

| Token | Hex | Por que esta cor | Uso |
|---|---|---|---|
| `--petroleo` | `#2F6F73` | azul-esverdeado frio: contrasta com o oliva sem sair do tom natural da paleta; contraste 5,8:1 sobre branco | 2ª série (família comparada); cenário **chuvoso** |
| `--terra` | `#8A5A2B` | marrom de terra de canavial: quente, vizinho do oliva; contraste 5,9:1 | 3ª série; cenário **seco** |
| `--salvia` | `#8FAE6B` | oliva clareado: mesma família de cor, serve para "o período anterior" | período anterior, preenchimentos suaves |

> Atenção: oliva, petróleo e terra têm **brilho parecido** (razão de contraste entre elas ≈ 1,1). Para quem tem daltonismo, **a cor sozinha não basta**. Por isso a regra da seção 5.4 (marcador + traço + rótulo direto) é obrigatória.

### 5.3 Quem pode usar vermelho e amarelo

- **Vermelho `--crit`** e **amarelo `--aten`** são **cores de status**. Servem para: crítico, atenção, fora da meta, alerta. **Nunca** para identificar uma família ou fornecedor.
- **Amarelo não serve para texto sobre branco** (contraste 2,9:1). Use como preenchimento ou ícone, com texto `--tinta` ao lado.
- Status sempre vem com **símbolo e palavra**: `● ok`, `▲ atenção`, `◆ crítico`. Nunca só cor.

### 5.4 Regras de uso

| Quando | Faça |
|---|---|
| Família ou item em foco | `--oliva`, linha contínua, marcador ● |
| Benchmark (TOTAL) | `--cinza`, linha **tracejada**, marcador ○ |
| 2ª e 3ª série comparadas | `--petroleo` (marcador ■) e `--terra` (marcador ▲). Mais de 3 séries → **pequenos múltiplos**, não 4 cores |
| Atual × anterior | atual `--oliva` sólido; anterior `--salvia` ou cinza |
| Linha de meta | `--tinta`, 1 px, tracejado curto, rótulo "meta 95%" |
| Janela atual sombreada | `--oliva-claro` com 60% de opacidade, atrás da linha |
| Semana de aquecimento | cinza `#D5DAD7`, texto "aquecimento do modelo" |
| Risco empilhado | crítico `--crit`, atenção `--aten`, sem risco `--oliva-claro` com contorno `--oliva` |
| Cenário climático | chuvoso `--petroleo`, seco `--terra`, normal `--borda` |

Outras regras visuais: fonte `"Segoe UI", system-ui…` (a do SAD), mínimo 12 px nos rótulos, cantos `--raio:14px`, cartões brancos com borda `--borda`, sem sombra pesada, sem degradê, sem 3D. Respeite `prefers-reduced-motion` (sem animações longas).

---

## 6. Os gráficos (o que, por que e como)

Para cada gráfico: **função** (o que o usuário descobre), **por que este tipo** e **especificação**. Títulos devem ser **frases com a conclusão**, geradas pelo código (modelos na seção 7).

### Painel 1 — Como estamos?

**G1.1 Seis cartões de indicador**
- *Função:* dizer em 30 s se cada indicador está dentro da meta e para onde caminha.
- *Por que cartão com mini-barra de meta (bullet) e não velocímetro:* o velocímetro gasta espaço, compara mal e exagera ponteiros; o bullet mostra valor, meta e faixa em uma linha.
- *Spec:* um cartão por indicador (E1…O3). Conteúdo: nome, valor atual grande (`valor_atual` + unidade), selo de status (`dentro_da_meta`), seta de tendência `▲ melhora` / `▼ piora` / `■ estável` (campo `tendencia`; para "menor é melhor" a seta de melhora aponta para baixo, mas o **texto** diz "melhora"), variação vs janela anterior, mini-barra com a meta (`meta_min`/`meta_max`) e, para E1, E3, O1, O2, uma **sparkline** das últimas 13 semanas (de `kpi_semanal`, família do filtro). E2 e O3 mostram "fotografia de 22/10" no lugar da sparkline. E3 mostra também a meta intermediária (50%).
- *Dados:* `kpi_resumo` (familia do filtro) + `indicadores` + `kpi_semanal`.

**G1.2 Faixa "o que pede atenção hoje"**
- *Função:* transformar números em 3 a 5 frases de ação.
- *Por que texto e não gráfico:* o gestor lê frases mais rápido que decifra um gráfico novo.
- *Spec:* lista gerada por regras: nº de itens críticos e valor sugerido (`estoque_familia` TOTAL); indicador mais distante da meta; fornecedor com maior `atraso_medio_dias` na janela atual; cenário climático atual (`clima_atual`). Cada frase tem botão "ver" que rola até o painel/gráfico de origem.

### Painel 2 — Estamos entregando?

**G2.1 Nível de serviço semanal (linha)**
- *Função:* ver se a taxa de falta está subindo ou caindo.
- *Por que linha:* é tempo contínuo; a linha mostra tendência e quebras.
- *Spec:* x = `semana_inicio`, y = `nivel_servico_pct`. Série oliva = família do filtro; cinza tracejada = TOTAL (se a família for Todas, só uma linha). Linha de meta em 95. Janela atual sombreada. Eixo y automático **sem zero**, com aviso "eixo vertical não começa em zero". Tooltip: semana, valor, itens com ruptura/itens observados.
- *Dados:* `kpi_semanal`.

**G2.2 Pareto das causas de ruptura (barras + linha acumulada)**
- *Função:* dizer qual causa resolver primeiro.
- *Por que Pareto:* poucas causas explicam a maioria das faltas; as barras ordenadas e a linha acumulada deixam isso óbvio.
- *Spec:* barras horizontais por `causa` ordenadas por `rupturas` (janela do filtro); linha de % acumulado (calcule no código a partir de `participacao_pct`); alternador Atual/Anterior. Cor oliva; a causa líder em `--petroleo` com rótulo direto. Tooltip: rupturas, dias em falta.
- *Dados:* `ruptura_causa`.

**G2.3 OTIF por fornecedor, anterior → atual (dumbbell)**
- *Função:* mostrar quem melhorou e quem piorou entre as janelas, e a distância até a meta.
- *Por que dumbbell e não duas barras:* o que importa é a **diferença** entre dois pontos por fornecedor; duas barras escondem a variação.
- *Spec:* uma linha por fornecedor, ordenada por `otif_pct` atual. Ponto `--salvia` = anterior, ponto `--oliva` = atual, segmento entre eles. Duas linhas verticais de referência: **meta intermediária 50%** (tracejada fina) e **meta final 93%** (tracejada). Rodapé do gráfico: *"OTIF com a regra estrita (entrega até a data prevista e completa). Com 2 dias de tolerância, o total sobe de 22,4% para 58,8%."* (valores de `otif_sensibilidade`, tolerância 2, janela ATUAL; **não escreva os números à mão**).
- *Dados:* `kpi_fornecedor`, `otif_sensibilidade`, `meta.parametros`.

**G2.4 Prazo real × prometido por fornecedor (dispersão)**
- *Função:* mostrar quem promete menos do que cumpre. É a base de tudo: o estoque de segurança usa o prazo **real**.
- *Por que dispersão com diagonal:* cada ponto é um fornecedor; acima da diagonal x = y o prazo real é maior que o prometido. Uma figura responde "quem atrasa e quanto".
- *Spec:* x = `lead_time_prometido_dias`, y = `lead_time_real_dias`, tamanho = `pedidos_recebidos`, cor oliva. Diagonal tracejada. Rótulo direto no fornecedor mais distante da diagonal. Tooltip com `atraso_medio_dias`.
- *Dados:* `kpi_fornecedor` (janela do filtro).

### Painel 3 — Onde está o risco e o dinheiro?

**G3.1 Risco por família (barras horizontais empilhadas)**
- *Função:* ver onde se concentram os itens críticos.
- *Por que empilhada:* mostra o total de itens da família e a composição crítico/atenção/sem risco; o rótulo traz o `% crítico`.
- *Spec:* uma barra por família ordenada por `criticos_pct`; segmentos `--crit`, `--aten`, `--oliva-claro`. Clique na barra define o filtro Família. Linha vertical de meta: 5% de críticos.
- *Dados:* `estoque_familia`.

**G3.2 Capital imobilizado e cobertura por família (barras + marcador)**
- *Função:* mostrar onde há dinheiro parado e se a cobertura está na faixa-alvo (30–45 dias).
- *Por que barra com marcador:* a barra é o capital (R$, ancorada em zero); o marcador é a cobertura, sem usar dois eixos.
- *Spec:* barras horizontais com `capital_imobilizado` (R$ mil). À direita, um losango na posição da cobertura sobre uma mini-escala com a faixa 30–45 sombreada em `--oliva-claro`. Cobertura **dentro da faixa** = `--oliva`; **fora** = `--aten` + texto "acima" ou "abaixo". Ordenar por capital.
- *Dados:* `estoque_familia`.

**G3.3 Fila de compra (tabela de ação com mini-bullet)**
- *Função:* é o coração do SAD: o que comprar, quanto, e decidir.
- *Por que tabela:* decisão exige comparar vários campos lado a lado e agir na linha.
- *Spec:* itens com `risco ≠ sem risco`, ordenados por urgência (`dias_ruptura − L`, menor primeiro; vazio por último). Colunas: item (nome + código), família, risco (símbolo + palavra), saldo, em trânsito, **mini-bullet "dias até faltar × prazo de reposição L"** (barra do `dias_ruptura` com marcador em `L`; se a barra for menor que o marcador, `--crit`), quantidade sugerida (`qtd`), valor (`valor`), ações **Aceitar · Ajustar · Recusar** (grava em `decisoes`, seção 8). Respeita filtros de família, fornecedor, ABC, padrão e risco. Paginação de 15 linhas e linha de totais (nº itens e soma de `valor`).
- *Dados:* `itens`.

**G3.4 Cobertura × capital por item (dispersão, opcional)**
- *Função:* achar o que está sobrando (muito capital e muitos dias de cobertura) e o que está faltando.
- *Por que dispersão:* 200 itens × 2 medidas só cabem em pontos; os outliers saltam à vista.
- *Spec:* x = `cobertura` (dias, limitar a 200 e avisar), y = `saldo × custo` (R$, escala log), cor = risco (mesmas cores do status), forma = curva ABC (A ●, B ■, C ▲). Faixa vertical 30–45 sombreada. Clique no ponto abre o painel de detalhe do item (seção 9).
- *Dados:* `itens`.

### Painel 4 — Dá para confiar na previsão e na aprovação?

**G4.1 Consumo real × previsão do item (linha)**
- *Função:* ver, no item que importa, se a previsão acompanha o consumo e onde houve ruptura.
- *Por que linha com marcadores:* série temporal curta de um item; os marcadores de ruptura contam a história.
- *Spec:* seletor de item (busca por nome ou código; padrão = item mais urgente da fila). Barras finas `--borda` para consumo real, linha `--oliva` para previsão (`previsao`), triângulo `--crit` na semana com `ruptura = 1`. As 4 primeiras semanas em cinza "aquecimento". Tooltip com consumo, previsão, erro. Selo com o método do item (`metodo`, `padrao`).
- *Dados:* `itens_semana`, `itens`.

**G4.2 Acurácia da previsão por semana (linha)**
- *Função:* acompanhar se o modelo melhora.
- *Spec:* x = semana, y = `acuracia_previsao_pct`; família do filtro em oliva e TOTAL em cinza tracejado; meta 75%; média móvel de 4 semanas. Aquecimento fora (`null`).
- *Dados:* `kpi_semanal`.

**G4.3 Tempo de aprovação por semana (linha)**
- *Função:* ver se a compra anda rápido (a espera na aprovação pesa no prazo total de reposição).
- *Spec:* y = `tempo_aprovacao_dias`; meta 3 dias (limite superior); janela atual sombreada.
- *Dados:* `kpi_semanal`.

**G4.4 Acurácia por padrão de demanda (barras)**
- *Função:* mostrar onde o modelo sofre (itens de demanda intermitente).
- *Por que barras:* duas categorias, uma medida.
- *Spec:* duas barras (suave × intermitente) com `100 × (1 − Σ|consumo − previsão| ÷ Σ consumo)`, calculada no código com `itens_semana` **sem** as semanas de aquecimento e respeitando filtros. Mostrar o nº de itens em cada barra. Linha de meta 75%, eixo y partindo de zero.
- *Dados:* `itens_semana` + `itens.padrao`.

### Painel 5 — Como nos comparamos? (benchmarking)

**G5.1 Mapa de calor família × indicador**
- *Função:* panorama: quem está fora da meta em quê.
- *Por que mapa de calor discreto:* 8 famílias × 6 indicadores é uma tabela; cor em 3 estados (dentro, fora, sem dado) e o **número dentro da célula** evitam adivinhar tons.
- *Spec:* linhas = famílias + TOTAL (fixo no topo); colunas = E1…O3. Célula: valor, símbolo de status (`●` dentro, `◆` fora) e seta de tendência. Cor: dentro `--oliva-claro`, fora `#F3D6D3` (o `--crit` a 15% de opacidade sobre branco, única cor extra permitida além das três do item 5.2) com texto `--tinta`. Clique no cabeçalho de coluna define o indicador do G5.2 e G5.3.
- *Dados:* `kpi_resumo`.

**G5.2 Tendência: anterior → atual (gráfico de inclinação)**
- *Função:* ver, para um indicador, para onde cada família caminha entre as duas janelas.
- *Por que slopegraph:* duas medidas por entidade; as linhas que cruzam a TOTAL mostram quem passou à frente ou ficou para trás.
- *Spec:* dois eixos verticais (anterior, atual); uma linha por família em `--salvia`; **TOTAL** em `--cinza` tracejada, mais grossa; família selecionada em `--oliva`; piora em `--crit` só no rótulo ("piora"). Rótulos diretos nas pontas, com anticolisão (mínimo 14 px). Seletor de indicador (E1, E3, O1, O2; E2 e O3 não têm anterior e ficam desabilitados com a explicação).
- *Dados:* `kpi_resumo`.

**G5.3 Ranking com distância da média (barras divergentes)**
- *Função:* mostrar quanto cada família está acima ou abaixo da empresa.
- *Spec:* barras horizontais de `valor_atual − valor_atual(TOTAL)` para o indicador escolhido; o lado "melhor que a empresa" em `--oliva` e o lado "pior" em `--petroleo` (vermelho fica reservado para status). O sinal considera o `sentido` (menor é melhor inverte o lado). Rótulo com o valor e a unidade.
- *Dados:* `kpi_resumo`.

### Painel 6 — O clima conta? (hipótese)

**G6.1 Chuva semanal colorida pelo cenário (barras) + G6.2 consumo total semanal (linha), empilhados com o mesmo eixo x**
- *Função:* ver se as semanas chuvosas e as de consumo alto coincidem.
- *Por que dois gráficos empilhados e não um com dois eixos:* eixo duplo induz a correlações falsas; dois gráficos alinhados deixam o olho comparar sem enganar.
- *Spec:* em cima, barras de `chuva_mm` coloridas por `cenario` (chuvoso `--petroleo`, seco `--terra`, normal `--borda`); semana parcial vazada. Embaixo, linha `--oliva` com o consumo total semanal (soma de `itens_semana.consumo` por semana, respeitando filtro de família). Cursor sincronizado (tooltip nos dois).

**G6.3 Consumo médio por cenário (barras)**
- *Função:* testar a hipótese de forma simples.
- *Spec:* 3 barras (chuvoso, normal, seco) com o consumo médio semanal por item; mostre o **n de semanas** em cada barra. Eixo y a partir de zero.

**G6.4 Cartão do cenário atual**
- *Spec:* `clima_atual`: "Chuvoso: 32,4 mm em 7 dias, 1 dia de chuva, 3 dias sem chuva". Regra do cenário em um tooltip: chuvoso se ≥ 30 mm ou ≥ 4 dias de chuva em 7; seco se ≥ 5 dias seguidos sem chuva; senão normal.

> **Aviso obrigatório no painel 6:** "Dados simulados: este painel mostra a hipótese, não comprova efeito do clima." Texto em `--cinza`, visível sem hover.

---

## 7. Modelos de título (frases geradas pelo código)

Troque os `{}` por valores do JSON. Nunca escreva o número no código.

- **G1.1 (cartão E1):** `Nível de serviço {valor_atual}%: {dentro_da_meta ? "dentro" : "fora"} da meta (≥ {meta_min}%), {tendencia} vs. 13 semanas anteriores`
- **G2.2:** `{causa_líder} responde por {participacao}% das rupturas na janela {janela}`
- **G2.3:** `{n_melhoraram} de 12 fornecedores melhoraram o OTIF; nenhum chegou à meta de {93}%`
- **G3.1:** `{familia_líder} concentra {n} itens críticos ({pct}% da família)`
- **G3.2:** `Capital imobilizado de R$ {total} mil; cobertura de {dias} dias, {dentro ? "na" : "fora da"} faixa de 30 a 45`
- **G4.4:** `A previsão acerta {x}% nos itens suaves e {y}% nos intermitentes (meta 75%)`
- **G5.2:** `{familia} {sobe/cai} {delta} {unidade} em {indicador}, {acima/abaixo} da média da empresa`

---

## 8. Registro de decisões (liga a tabela G3.3 ao indicador O3)

Cada clique em Aceitar/Ajustar/Recusar cria **um registro** em `decisoes` (memória + `localStorage` com try/catch, e botão **Exportar CSV**):

```json
{ "cod": "AL-118364", "data_sugestao": "2026-10-22", "data_decisao": "2026-10-23T14:05",
  "qtd_sugerida": 16, "qtd_decidida": 16, "decisao": "aceitou",
  "perfil": "analista", "justificativa": "", "decidido_no_prazo": 1 }
```

- `decisao` ∈ `aceitou | ajustou | recusou`. **Ajustar** e **Recusar** exigem justificativa (campo texto curto).
- `decidido_no_prazo`: 1 se `data_decisao − data_sugestao` ≤ **1 dia** para item **crítico** ou ≤ **3 dias** para **atenção** (valores em `meta.parametros.prazo_decisao_critico_dias` e `prazo_decisao_atencao_dias`).
- O cartão de O3 (G1.1) mostra, abaixo do % de críticos, **"% das sugestões decididas no prazo"** = decididas no prazo ÷ decisões registradas. Sem registros: texto "sem decisões registradas ainda".
- **LGPD:** gravar só o **perfil** (analista, compras, gestor), nunca nome nem e-mail. Avise abaixo do campo justificativa: "não escreva dados pessoais".

---

## 9. Painel de detalhe do item (gaveta ao clicar em um item)

Mostra: nome, código, família, ABC, padrão e método; saldo, em trânsito, ponto de pedido (`pp`), estoque de segurança (`ss`), lote; **dias até faltar × prazo de reposição**; gráfico G4.1 do item; a explicação em português da conta (`SS = z·√((R+L)·σd² + d̄²·σL²)`, `PP = d̄·(R+L) + SS`), com os valores do item. Botão fechar com `Esc`.

---

## 10. Cálculos permitidos no navegador (e só estes)

**Simulador de nível de serviço (what-if).** Ao mover o controle, recalcule por item, usando os campos já existentes (`d`, `sdd`, `L`, `sL`, `saldo`, `transito`, `lote`, `dias_ruptura`) e R = `meta.parametros.revisao_dias`:

```
z   = inversa_normal(nivel)            // aproximação de Acklam; o SAD já tem zInv
SS  = z * sqrt((R + L) * sdd^2 + d^2 * sL^2)
PP  = d * (R + L) + SS
pos = saldo + transito
risco = (dias_ruptura != null && dias_ruptura <= L) ? "crítico"
        : (pos <= PP ? "atenção" : "sem risco")
qtd = risco == "sem risco" ? 0 : lote * max(1, ceil((PP - pos + 1) / lote))
valor = qtd * custo
```

Com 95% (z = 1,645) o resultado deve bater com o JSON (23 críticos, 13 em atenção). Isso é um **teste de aceite**.

Também permitido: somar `itens_semana` por semana/padrão/cenário (G4.4, G6.2, G6.3), média móvel de 4 semanas, % acumulado do Pareto. **Tudo o mais vem pronto do JSON.** Não recalcule indicadores a partir de dados brutos.

---

## 11. Testes de aceite (a IA deve rodá-los ou listá-los)

**Números que precisam bater** (família = Todas, janela = Atual, nível = 95%):

| Item | Valor esperado |
|---|---|
| E1 Nível de serviço | 95,5% (meta ≥ 95 → dentro) |
| E2 Cobertura | 49,2 dias (faixa 30–45 → fora) |
| E3 OTIF | 22,4% (meta 93, intermediária 50 → fora) |
| O1 Acurácia | 69,6% (meta ≥ 75 → fora) |
| O2 Aprovação | 2,89 dias (meta ≤ 3 → dentro) |
| O3 Itens críticos | 11,5% = 23 de 200 (meta ≤ 5 → fora); 13 em atenção |
| Clima atual | Chuvoso, 32,4 mm, 1 dia de chuva, 3 dias sem chuva |
| OTIF com 2 dias de tolerância | 58,8% |

**Comportamento:**
1. Nenhum erro ou aviso no console; nenhuma requisição além do `dados_alcar.json`.
2. Sem rolagem horizontal da página em 390, 820 e 1366 px (tabelas rolam dentro do próprio quadro).
3. Cada filtro muda os gráficos que a matriz da seção 4 indica, e os demais mostram o selo "não se aplica".
4. Todo gráfico tem: tooltip, botão "ver como tabela", botão "exportar CSV", título em frase.
5. Teclado: todos os controles com foco visível; `Tab` percorre filtros → painéis; `Esc` fecha a gaveta.
6. Nenhum status só por cor: sempre símbolo + palavra.
7. Eixos que não começam em zero trazem o aviso; barras sempre começam em zero.
8. Sem dados (família sem itens no filtro): mensagem "nenhum item com esses filtros", nunca gráfico vazio ou `NaN`.
9. Formatos pt-BR: `1.234,5`; `R$ 12,3 mil`; datas `22/10`; porcentagem com 1 casa.
10. Decisão registrada aparece no cartão O3 e no CSV exportado; recarregar a página mantém o registro (`localStorage` com try/catch; se bloquear, a aba funciona em memória).

---

## 12. O que NÃO fazer

- Gráfico de pizza, rosca, 3D, velocímetro, degradê, sombra pesada.
- Eixo duplo (dois eixos y no mesmo gráfico).
- Mais de 3 cores em séries; passou disso, use pequenos múltiplos.
- Vermelho ou amarelo para identificar família ou fornecedor.
- Escrever qualquer número do relatório diretamente no código.
- Buscar dados de internet, usar CDN sem versão fixa, ou gravar dado pessoal.
- Mostrar tendência para E2 e O3 (não existe série).
- Esconder o aviso de dados fictícios.

---

## 13. Estrutura sugerida do código

```
dashboard/
  tokens.css        // cores, espaçamentos, tipografia (seção 5)
  dados.js          // carrega dados_alcar.json, valida chaves, expõe D
  filtros.js        // estado dos filtros, hash da URL, matriz de aplicação
  calculos.js       // what-if (seção 10), médias móveis, agregações de itens_semana
  graficos/         // um arquivo por gráfico: g11.js, g21.js, ... cada um exporta render(D, filtros)
  paineis.js        // monta os 6 painéis e a ordem
  decisoes.js       // seção 8
  tabela-alternativa.js  // "ver como tabela" e exportação CSV, genéricos
```

Se o SAD for um arquivo único, mantenha a mesma separação em seções comentadas dentro do arquivo. Cada gráfico é uma função pura: recebe `(D, filtros)` e devolve SVG/HTML; não lê o DOM de outros gráficos.

---

## 14. Perguntas que a IA deve devolver ao fim (modelo)

1. Quais filtros não se aplicam a quais gráficos e como foram sinalizados?
2. Quais gráficos usam escala sem zero e onde está o aviso?
3. Como a aba lida com `localStorage` indisponível?
4. Quais testes da seção 11 passaram e quais ficaram pendentes?

---

*Todos os dados deste projeto são fictícios. Guia gerado em 31/10/2026 a partir do contrato de dados versão 1.0 (ver `dicionario_dados.md` e `er_alcar.png`).*
