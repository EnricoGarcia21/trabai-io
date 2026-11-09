/**
 * Agente de IA de Consulta — Motor Simulado (100% Local / Sem Backend)
 * Usina Alcar — Sistema de Apoio à Decisão (I.O. 2º Bimestre)
 *
 * Simula RAG conceitual + Tool-Calling com consultas à Camada Ouro (DW).
 */

(() => {
  // ============================================================
  // 1. ACERVO DE CONHECIMENTO METODOLÓGICO (RAG SIMULADO)
  // ============================================================
  const ACERVO = [
    {
      chaves: ['estoque de seguranca', 'seguranca', 'formula ss', 'calcular ss', 'variabilidade'],
      topico: 'Estoque de Segurança (SS)',
      funcao: 'rag_metodologia_estoque()',
      resposta: `
        <p><b>Estoque de Segurança (SS)</b> é a reserva planejada para amortecer incertezas tanto na demanda do item ($\sigma_d$) quanto no prazo de entrega do fornecedor ($\sigma_L$) durante o intervalo de proteção.</p>
        <div class="formula-box">
          <code>SS = z · √[ (R + L)·σd² + d̄²·σL² ]</code><br>
          <code>PP = d̄ · (R + L) + SS</code>
        </div>
        <p><b>Onde:</b></p>
        <ul>
          <li><b>z:</b> Fator estatístico de segurança derivado do Nível de Serviço Alvo (ex: z = 1,645 para 95%; z = 2,326 para 99%).</li>
          <li><b>d̄ e σd:</b> Média e desvio padrão da demanda diária do item.</li>
          <li><b>R:</b> Período de revisão de estoque (ex: 7 dias na Usina Alcar).</li>
          <li><b>L e σL:</b> Prazo total de reposição (Lead Time) realizado e seu desvio padrão.</li>
        </ul>
        <p class="nota">Referência: Silver, Pyke & Peterson (1998) — <i>Inventory Management and Production Planning and Scheduling</i>.</p>
      `
    },
    {
      chaves: ['ponto de pedido', 'quando comprar', 'quando pedir', 'reposicao', 'formula pp'],
      topico: 'Ponto de Pedido (PP)',
      funcao: 'rag_politica_reposicao()',
      resposta: `
        <p><b>Ponto de Pedido (PP)</b> indica o momento exato em que uma ordem de compra deve ser gerada. Quando a posição de estoque (saldo disponível + ordens já em trânsito) atinge ou fica abaixo do PP, emite-se a requisição.</p>
        <div class="formula-box">
          <code>PP = Demanda no Prazo de Proteção + SS = d̄ · (R + L) + SS</code>
        </div>
        <p>O lote de compra sugerido respeita os múltiplos de embalagem ou o lote mínimo de fornecimento cadastrado no SAP MM.</p>
      `
    },
    {
      chaves: ['nivel de servico', 'csl', 'fator z', 'probabilidade de atendimento'],
      topico: 'Nível de Serviço Alvo (CSL)',
      funcao: 'rag_nivel_servico()',
      resposta: `
        <p>O <b>Nível de Serviço Alvo (Cycle Service Level - CSL)</b> representa a probabilidade estatística de atender a todas as requisições de manutenção sem sofrer ruptura de estoque em um ciclo de reposição.</p>
        <ul>
          <li><b>90% de serviço:</b> z = 1,28 (menor capital imobilizado, maior exposição ao risco).</li>
          <li><b>95% de serviço (padrão DW):</b> z = 1,64 (equilíbrio entre disponibilidade operacional e capital).</li>
          <li><b>99% de serviço:</b> z = 2,33 (eleva o estoque de segurança em mais de 40%, justificável apenas para itens classe A críticos).</li>
        </ul>
        <p>Você pode simular o impacto de diferentes níveis usando o controle <i>Nível de serviço (what-if)</i> nos filtros.</p>
      `
    },
    {
      chaves: ['curva abc', 'classificacao abc', 'pareto abc'],
      topico: 'Curva ABC (Princípio de Pareto)',
      funcao: 'rag_classificacao_abc()',
      resposta: `
        <p>A <b>Curva ABC</b> classifica os materiais de acordo com sua importância financeira e consumo acumulado:</p>
        <ul>
          <li><b>Classe A:</b> ~20% dos itens que respondem por ~70% do valor total movimentado. Exigem controle diário rigoroso e menor estoque de segurança relativo.</li>
          <li><b>Classe B:</b> ~30% dos itens que respondem por ~20% do valor. Controle intermediário.</li>
          <li><b>Classe C:</b> ~50% dos itens que respondem por apenas ~10% do valor (geralmente fixadores, parafusos, arruelas). Permitem políticas mais flexíveis e lotes maiores.</li>
        </ul>
      `
    },
    {
      chaves: ['croston', 'sba', 'intermitente', 'demanda intermitente', 'demanda irregular'],
      topico: 'Demanda Intermitente (Método Croston / SBA)',
      funcao: 'rag_modelos_previsao()',
      resposta: `
        <p>Peças sobressalentes e peças de desgaste na usina frequentemente apresentam <b>demanda intermitente</b>: passam várias semanas sem nenhuma retirada e, subitamente, sofrem uma saída para manutenção corretiva.</p>
        <p>A média móvel e a suavização exponencial simples (SES) falham nesses itens porque superestimam a demanda logo após um consumo e demoram a baixar. O <b>Método de Croston (1972)</b> desacopla a estimativa em duas grandezas:</p>
        <ol>
          <li>A magnitude média das saídas não-nulas ($z_t$).</li>
          <li>O intervalo médio de tempo entre demandas sucessivas ($p_t$).</li>
        </ol>
        <p>A variante <b>SBA (Syntetos-Boylan Approximation, 2005)</b> multiplica a taxa por <code>(1 - α/2)</code> para eliminar o viés sistemático de superestimação do Croston tradicional.</p>
      `
    },
    {
      chaves: ['wape', 'acuracia', 'erro de previsao', 'mape', 'mad'],
      topico: 'Acurácia de Previsão e Métrica WAPE',
      funcao: 'rag_metricas_acuracia()',
      resposta: `
        <p>A acurácia do SAD da Usina Alcar é avaliada pelo <b>WAPE (Weighted Absolute Percentage Error)</b>:</p>
        <div class="formula-box">
          <code>WAPE = Σ |Consumo Real - Previsão| / Σ Consumo Real</code><br>
          <code>Acurácia = 100% · (1 - WAPE)</code>
        </div>
        <p><b>Por que não usar MAPE?</b> O MAPE divide o erro pelo consumo de cada semana individualmente. Em semanas com consumo zero (comuns em peças intermitentes), o MAPE causa divisão por zero e explode. O WAPE soma primeiro todos os numeradores e denominadores, sendo robusto e matematicamente estável.</p>
      `
    },
    {
      chaves: ['otif', 'on time in full', 'entrega no prazo', 'desempenho fornecedor'],
      topico: 'Indicador OTIF (On-Time In-Full)',
      funcao: 'rag_indicador_otif()',
      resposta: `
        <p><b>OTIF (On-Time In-Full)</b> é a métrica de excelência logística de suprimentos. Um pedido só é considerado cumprido se atender a duas condições simultaneamente:</p>
        <ul>
          <li><b>On-Time:</b> Entregue exatamente até a data prometida.</li>
          <li><b>In-Full:</b> Quantidade entregue igual à quantidade comprada (sem entregas parciais pendentes).</li>
        </ul>
        <p class="nota">Na Usina Alcar, a regra estrita aponta OTIF de 22,4% na janela atual. Ao considerar uma tolerância prática de 2 dias de atraso, o índice sobe para mais de 58%, evidenciando que muitos atrasos são de curta duração.</p>
      `
    },
    {
      chaves: ['safra', 'entressafra', 'calendario safra', 'moagem'],
      topico: 'Dinâmica Operacional: Safra vs. Entressafra',
      funcao: 'rag_calendario_usina()',
      resposta: `
        <p>A operação do setor sucroenergético divide-se em dois ciclos com perfis de consumo totalmente distintos:</p>
        <ul>
          <li><b>Safra (abril a novembro):</b> A usina opera 24h por dia na colheita e moagem de cana. Predomina o consumo de filtros, lubrificantes, rolamentos de alta rotação e facas picadoras. Rupturas nesta fase causam paradas de moagem de alto custo.</li>
          <li><b>Entressafra (dezembro a março):</b> Parada das caldeiras e moendas para reforma mecânica pesada. Demanda programada de peças estruturais, chapas e tubos para revisão geral dos ternos de moenda.</li>
        </ul>
      `
    },
    {
      chaves: ['lgpd', 'governanca', 'dados pessoais', 'seci', 'privacidade'],
      topico: 'Governança de Dados, LGPD e Modelo SECI',
      funcao: 'rag_governanca_dados()',
      resposta: `
        <p><b>Conformidade e Governança do SAD:</b></p>
        <ul>
          <li><b>LGPD:</b> O painel e o agente leem exclusivamente a Camada Ouro em modo de apenas leitura. Requisitantes e fornecedores pessoa física são pseudonimizados com função criptográfica SHA-256 e sal, preservando a privacidade.</li>
          <li><b>Modelo SECI (Nonaka & Takeuchi):</b> O registro de justificativas de compra e recusa do analista atua como mecanismo de <i>Externalização</i> do conhecimento tácito dos profissionais da usina para a memória corporativa explícita.</li>
        </ul>
      `
    }
  ];

  // ============================================================
  // 2. MOTOR DE CONSULTAS ANALÍTICAS À CAMADA OURO
  // ============================================================
  function normalizar(texto) {
    return (texto || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, ' ')
      .trim();
  }

  function formatarDinheiro(val) {
    return 'R$ ' + Number(val || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }

  function formatarNumero(val, dec = 1) {
    return Number(val || 0).toLocaleString('pt-BR', {minimumFractionDigits: dec, maximumFractionDigits: dec});
  }

  // Identifica a fonte de dados disponível (DW JSON no dashboard ou base legada na Home)
  function obterDadosDW() {
    if (window.__DW_DATA) {
      return {
        tipo: 'dw',
        data: window.__DW_DATA,
        items: window.__DW_ITEMS || window.__DW_DATA.itens || []
      };
    }
    if (typeof ITENS !== 'undefined') {
      return {
        tipo: 'legado',
        items: ITENS,
        fornecedores: typeof FOR !== 'undefined' ? FOR : [],
        familias: typeof FAM !== 'undefined' ? FAM : []
      };
    }
    return null;
  }

  // Consulta analítica: Resumo executivo geral da usina
  function consultaResumoGeral(fonte) {
    if (fonte.tipo === 'dw') {
      const D = fonte.data;
      const stock = D.estoque_familia.find(r => r.familia === 'TOTAL') || {};
      const clima = D.clima_atual || {};
      const atraso = D.kpi_fornecedor.filter(r => r.janela === 'ATUAL').sort((a,b) => b.atraso_medio_dias - a.atraso_medio_dias)[0];

      return {
        resposta: `
          <p><b>Diagnóstico Geral da Usina Alcar (Posição em ${D.meta.data_posicao}):</b></p>
          <ul>
            <li>🚨 <b>Itens em Risco:</b> Há <b>${stock.itens_criticos || 23} itens críticos</b> e <b>${stock.itens_atencao || 13} em atenção</b>, totalizando <b>${formatarDinheiro(stock.valor_sugerido)}</b> em compras sugeridas para reposição.</li>
            <li>💰 <b>Capital Imobilizado:</b> <b>${formatarDinheiro(stock.capital_imobilizado)}</b> em estoque, com cobertura média de <b>${formatarNumero(stock.cobertura_dias)} dias</b>.</li>
            <li>🚚 <b>Fornecedores:</b> O maior atraso médio recente é de <b>${atraso ? atraso.fornecedor : '—'}</b> (${formatarNumero(atraso?.atraso_medio_dias)} dias de atraso).</li>
            <li>🌧️ <b>Clima:</b> Cenário <b>${clima.cenario}</b> com ${formatarNumero(clima.chuva_7d_mm)} mm nos últimos 7 dias.</li>
          </ul>
          <div class="acoes-resposta">
            <button class="btn peq pri btn-acao-chat" data-nav="#painel-1" type="button">📊 Ver Cockpit Executivo</button>
            <button class="btn peq btn-acao-chat" data-nav="#painel-3" type="button">⚠️ Ver Fila de Riscos</button>
            <button class="btn peq btn-acao-chat" data-nav="#painel-2" type="button">🚚 Ver Fornecedores</button>
          </div>
        `,
        origem: 'Camada Ouro (Data Mart Alcar)',
        funcao: 'consultar_diagnostico_executivo()'
      };
    }

    // Modo Legado (Home)
    const crit = fonte.items.filter(i => i.risco === 'crit');
    const valor = crit.reduce((s, i) => s + (i.valor || 0), 0);
    return {
      resposta: `
        <p><b>Resumo Operacional do Almoxarifado:</b></p>
        <p>Existem <b>${crit.length} itens críticos</b> que exigem reposição imediata para evitar ruptura na usina, somando <b>${formatarDinheiro(valor)}</b> em compras recomendadas.</p>
        <div class="acoes-resposta">
          <button class="btn peq pri btn-acao-chat" data-nav="#t3" type="button">Ver Tabela de Riscos</button>
          <button class="btn peq btn-acao-chat" data-nav="#t4" type="button">Ver Compras Sugeridas</button>
        </div>
      `,
      origem: 'Camada Ouro Simulada',
      funcao: 'resumo_almoxarifado()'
    };
  }

  // Consulta analítica: Itens críticos e próximos da ruptura
  function consultaCriticos(fonte) {
    const itens = fonte.items || [];
    let criticos = [];

    if (fonte.tipo === 'dw') {
      criticos = [...itens].filter(i => i.risco === 'crítico' || i.risco === 'atenção')
        .sort((a, b) => (a.dias_ruptura ?? 999) - (b.dias_ruptura ?? 999))
        .slice(0, 5);
    } else {
      criticos = [...itens].filter(i => i.risco === 'crit' || i.risco === 'aten')
        .sort((a, b) => (a.rd ?? 999) - (b.rd ?? 999))
        .slice(0, 5);
    }

    if (!criticos.length) {
      return {
        resposta: `<p>Nenhum item em risco crítico identificado com os filtros atuais.</p>`,
        origem: 'Camada Ouro (DW)',
        funcao: 'consultar_itens_criticos(top=5)'
      };
    }

    const linhas = criticos.map(i => {
      const cod = i.cod;
      const nome = i.nome;
      const dias = i.dias_ruptura ?? i.rd;
      const diasTxt = dias == null ? 'sem ruptura prevista' : dias === 0 ? '<b>já em falta!</b>' : `falta em <b>${formatarNumero(dias, 0)} dias</b>`;
      const saldo = i.saldo;
      const valor = formatarDinheiro(i.valor);
      return `<li><b>${cod}</b> — ${nome}<br><small>Saldo: ${formatarNumero(saldo, 0)} un · ${diasTxt} · Sugestão: ${valor}</small> <button class="btn peq btn-acao-chat" data-item="${cod}" type="button">Abrir item</button></li>`;
    }).join('');

    return {
      resposta: `
        <p><b>Top itens mais próximos da falta de estoque:</b></p>
        <ul class="lista-chat-itens">${linhas}</ul>
        <div class="acoes-resposta">
          <button class="btn peq pri btn-acao-chat" data-nav="#painel-3" type="button">📋 Ver Fila Completa de Riscos</button>
        </div>
      `,
      origem: 'Camada Ouro (DW) · fact_politica_estoque',
      funcao: 'consultar_itens_criticos(top=5)'
    };
  }

  // Consulta analítica: Item específico por código AL-XXXXXX ou nome
  function consultaItemEspecifico(fonte, query) {
    const itens = fonte.items || [];
    const codMatch = query.match(/al-\d{6}/i);
    let item = null;

    if (codMatch) {
      item = itens.find(i => (i.cod || '').toLowerCase() === codMatch[0].toLowerCase());
    } else {
      const qNorm = normalizar(query);
      item = itens.find(i => normalizar(i.nome).includes(qNorm) || qNorm.includes(normalizar(i.nome)));
    }

    if (!item) return null;

    const cod = item.cod;
    const nome = item.nome;
    const metodo = item.metodo === 'SBA' ? 'Croston/SBA (demanda intermitente)' : 'Suavização Exponencial (SES)';
    const padrao = item.padrao || 'suave';
    const saldo = formatarNumero(item.saldo, 0);
    const transito = formatarNumero(item.transito || item.tr?.q || 0, 0);
    const pp = formatarNumero(item.pp || item.PP, 0);
    const ss = formatarNumero(item.ss || item.SS, 1);
    const risco = item.risco === 'crítico' || item.risco === 'crit' ? '🚨 Crítico' : item.risco === 'atenção' || item.risco === 'aten' ? '⚠️ Atenção' : '✅ Regular';
    const dias = item.dias_ruptura ?? item.rd;
    const diasTxt = dias == null ? 'Sem ruptura no horizonte' : dias === 0 ? 'Já em falta' : `Ruptura estimada em ${formatarNumero(dias, 0)} dias`;

    return {
      resposta: `
        <p><b>Dados do Item: ${nome} (${cod})</b></p>
        <ul>
          <li><b>Situação:</b> ${risco} (${diasTxt}).</li>
          <li><b>Saldo Físico:</b> ${saldo} un (Em trânsito: ${transito} un).</li>
          <li><b>Ponto de Pedido (PP):</b> ${pp} un | <b>Estoque de Segurança (SS):</b> ${ss} un.</li>
          <li><b>Classificação:</b> Curva ${item.abc || 'B'} · Padrão ${padrao}.</li>
          <li><b>Modelo de Previsão:</b> ${metodo}.</li>
        </ul>
        <div class="acoes-resposta">
          <button class="btn peq pri btn-acao-chat" data-item="${cod}" type="button">🔍 Abrir Gaveta de Parâmetros</button>
        </div>
      `,
      origem: 'Camada Ouro (DW) · dim_material + fact_politica_estoque',
      funcao: `buscar_item(cod="${cod}")`
    };
  }

  // Consulta analítica: Fornecedores e Prazos
  function consultaFornecedores(fonte) {
    if (fonte.tipo === 'dw') {
      const D = fonte.data;
      const fornecedores = D.kpi_fornecedor.filter(r => r.janela === 'ATUAL');
      const piorAtraso = [...fornecedores].sort((a,b) => b.atraso_medio_dias - a.atraso_medio_dias)[0];
      const melhorOTIF = [...fornecedores].sort((a,b) => b.otif_pct - a.otif_pct)[0];
      const piorOTIF = [...fornecedores].sort((a,b) => a.otif_pct - b.otif_pct)[0];

      return {
        resposta: `
          <p><b>Desempenho de Fornecedores (Janela Atual de 13 semanas):</b></p>
          <ul>
            <li>⏱️ <b>Maior Atraso Médio:</b> <b>${piorAtraso?.fornecedor}</b>, com média de <b>${formatarNumero(piorAtraso?.atraso_medio_dias)} dias</b> de atraso após a data prometida.</li>
            <li>🏆 <b>Melhor OTIF:</b> <b>${melhorOTIF?.fornecedor}</b> com <b>${formatarNumero(melhorOTIF?.otif_pct)}%</b> de entregas perfeitas.</li>
            <li>⚠️ <b>Menor OTIF:</b> <b>${piorOTIF?.fornecedor}</b> (${formatarNumero(piorOTIF?.otif_pct)}%).</li>
          </ul>
          <p class="nota">O contrato aponta que a tolerância de 2 dias eleva expressivamente o percentual de cumprimento na usina.</p>
          <div class="acoes-resposta">
            <button class="btn peq pri btn-acao-chat" data-nav="#painel-2" type="button">🚚 Ver Gráfico de Dispersão e OTIF</button>
          </div>
        `,
        origem: 'Camada Ouro (DW) · fact_pedido + dim_fornecedor',
        funcao: 'consultar_desempenho_fornecedores()'
      };
    }

    return {
      resposta: `<p>Consulte os dados de fornecedores no painel para comparar prazos e lead time histórico.</p>`,
      origem: 'Camada Ouro',
      funcao: 'consultar_fornecedores()'
    };
  }

  // Consulta analítica: Impacto do Clima
  function consultaClima(fonte) {
    if (fonte.tipo === 'dw') {
      const D = fonte.data;
      const clima = D.clima_atual || {};
      return {
        resposta: `
          <p><b>Impacto Climático e Hipótese de Demanda:</b></p>
          <p>Cenário atual: <b>${clima.cenario}</b> (${formatarNumero(clima.chuva_7d_mm)} mm de precipitação acumulada em 7 dias).</p>
          <p><b>A hipótese analítica testada no SAD:</b></p>
          <ul>
            <li>Em semanas com chuva intensa (cenário <b>CHUVOSO</b>), as frentes de corte de cana reduzem o ritmo para não compactar o solo, o que reduz temporariamente o desgaste mecânico e as trocas de rolamentos e facas.</li>
            <li>Em semanas de tempo firme (cenário <b>SECO</b>), o pico de moagem eleva o consumo de lubrificantes e itens de tração.</li>
          </ul>
          <p class="nota">⚠️ Lembre-se: os dados meteorológicos são simulados e representam uma hipótese para o projeto acadêmico de I.O.</p>
          <div class="acoes-resposta">
            <button class="btn peq pri btn-acao-chat" data-nav="#painel-6" type="button">🌦️ Ver Painel Climático Sincronizado</button>
          </div>
        `,
        origem: 'Camada Ouro (DW) · fact_consumo + dim_clima',
        funcao: 'consultar_correlacao_clima()'
      };
    }

    return {
      resposta: `<p>A correlação climática indica maior pressão operacional em períodos secos de moagem máxima.</p>`,
      origem: 'Simulação',
      funcao: 'cenario_clima()'
    };
  }

  // ============================================================
  // 3. MOTOR CENTRAL DO AGENTE (PROCESSAMENTO DA PERGUNTA)
  // ============================================================
  function processarPergunta(texto) {
    const q = normalizar(texto);
    const fonte = obterDadosDW();

    // 1. Busca por item específico
    if (fonte && (q.includes('al-') || q.includes('item') || q.includes('rolamento') || q.includes('filtro') || q.includes('oleo') || q.includes('correia'))) {
      const itemResp = consultaItemEspecifico(fonte, texto);
      if (itemResp) return itemResp;
    }

    // 2. Consulta de diagnóstico / resumo da usina
    if (/como estamos|situacao|resumo|visao geral|diagnostico|o que pede atencao|atencao hoje/.test(q)) {
      if (fonte) return consultaResumoGeral(fonte);
    }

    // 3. Consulta de itens críticos e rupturas
    if (/critico|criticos|faltar|falta|ruptura|risco|mais perto de faltar/.test(q)) {
      if (fonte) return consultaCriticos(fonte);
    }

    // 4. Consulta de fornecedores e lead times
    if (/fornecedor|fornecedores|atraso|atrasa|lead time|prazo de entrega|otif/.test(q)) {
      if (fonte) return consultaFornecedores(fonte);
    }

    // 5. Consulta sobre Clima / Chuva
    if (/clima|chuva|chuvoso|seco|precipitacao|meteorolog/.test(q)) {
      if (fonte) return consultaClima(fonte);
    }

    // 6. Benchmarking e Famílias
    if (/benchmarking|familias|comparacao|qual familia/.test(q)) {
      return {
        resposta: `
          <p>O benchmarking do SAD compara as 8 famílias de materiais da usina contra a média corporativa (TOTAL). Você pode analisar as discrepâncias em nível de serviço, cobertura de capital e taxa de acurácia no Painel 5.</p>
          <div class="acoes-resposta">
            <button class="btn peq pri btn-acao-chat" data-nav="#painel-5" type="button">📊 Ver Heatmap de Benchmarking</button>
          </div>
        `,
        origem: 'Camada Ouro (DW) · kpi_resumo',
        funcao: 'consultar_benchmarking_familias()'
      };
    }

    // 7. Busca no Acervo Conceitual RAG
    for (const item of ACERVO) {
      if (item.chaves.some(k => q.includes(k))) {
        return {
          resposta: item.resposta,
          origem: `Acervo RAG Metodológico · ${item.topico}`,
          funcao: item.funcao
        };
      }
    }

    // 8. Resposta padrão inteligente caso não encontre
    return {
      resposta: `
        <p>Sou o <b>Agente de IA de Consulta</b> da Usina Alcar. Não encontrei uma correspondência exata para a sua pergunta, mas posso responder:</p>
        <ul>
          <li><b>Conceitos Metodológicos:</b> <i>Como calcular o estoque de segurança?</i>, <i>O que é ponto de pedido?</i>, <i>O que significa WAPE?</i>, <i>Como funciona o Croston/SBA?</i></li>
          <li><b>Diagnóstico Operacional:</b> <i>O que pede atenção hoje?</i>, <i>Quais itens estão críticos?</i>, <i>Qual fornecedor mais atrasa?</i></li>
          <li><b>Consulta de Item:</b> Digite o código (ex: <i>AL-000001</i>) ou o nome de uma peça.</li>
        </ul>
        <p>Você também pode clicar em uma das sugestões rápidas abaixo.</p>
      `,
      origem: 'Base de Conhecimento do Agente',
      funcao: 'ajuda_geral()'
    };
  }

  // ============================================================
  // 4. INTEGRAÇÃO 9ROUTER (LLM GATEWAY) COM MINI-RAG & FALLBACK
  // ============================================================
  const DEFAULT_CONFIG_9R = {
    modo: 'auto', // 'auto' (9Router com fallback local) | 'local' (apenas motor local)
    endpoint: '/api/chat',
    directEndpoint: 'http://localhost:20128/v1/chat/completions',
    healthEndpoint: '/api/health-9router',
    model: 'kr/claude-sonnet-4.5',
    apiKey: 'sk-cb903db624680de0-f6w9ez-80933162',
    timeoutMs: 40000
  };

  const historicoConversa = [];
  let status9RouterOnline = false;

  function obterConfig9R() {
    try {
      const salvo = localStorage.getItem('alcar_9router_config');
      if (salvo) {
        const parsed = JSON.parse(salvo);
        const cfg = Object.assign({}, DEFAULT_CONFIG_9R, parsed);
        // Atualiza chaves antigas ou timeouts curtos salvos anteriormente
        if (cfg.apiKey === '9router-local' || !cfg.apiKey) {
          cfg.apiKey = DEFAULT_CONFIG_9R.apiKey;
        }
        if (!cfg.timeoutMs || cfg.timeoutMs < 30000) {
          cfg.timeoutMs = DEFAULT_CONFIG_9R.timeoutMs;
        }
        return cfg;
      }
    } catch (_) {}
    return Object.assign({}, DEFAULT_CONFIG_9R);
  }

  function salvarConfig9R(cfg) {
    try {
      localStorage.setItem('alcar_9router_config', JSON.stringify(cfg));
    } catch (_) {}
  }

  async function verificarHealth9Router() {
    const cfg = obterConfig9R();
    if (cfg.modo === 'local') {
      status9RouterOnline = false;
      atualizarBadgeHeader();
      return false;
    }

    // 1. Tenta probe via proxy do server local
    try {
      const res = await fetch(cfg.healthEndpoint, { signal: AbortSignal.timeout(1800) });
      if (res.ok) {
        const json = await res.json();
        status9RouterOnline = (json.status === 'online');
        atualizarBadgeHeader();
        return status9RouterOnline;
      }
    } catch (_) {}

    // 2. Tenta probe direto no 9router (caso executando via file:// ou porta customizada)
    try {
      const resDirect = await fetch('http://localhost:20128/v1/models', {
        headers: { 'Authorization': `Bearer ${cfg.apiKey}` },
        signal: AbortSignal.timeout(1500)
      });
      status9RouterOnline = resDirect.ok;
    } catch (_) {
      status9RouterOnline = false;
    }

    atualizarBadgeHeader();
    return status9RouterOnline;
  }

  function atualizarBadgeHeader(digitando = false) {
    const statusEl = document.querySelector('#status-agente');
    if (!statusEl) return;
    if (digitando) {
      statusEl.textContent = 'digitando...';
      statusEl.className = 'digitando';
      return;
    }
    statusEl.className = '';
    const cfg = obterConfig9R();
    if (cfg.modo === 'local') {
      statusEl.innerHTML = 'online <span class="status-tag tag-local">Local</span>';
    } else if (status9RouterOnline) {
      statusEl.innerHTML = 'online <span class="status-tag tag-9router">9Router</span>';
    } else {
      statusEl.innerHTML = 'online <span class="status-tag tag-local">Local</span>';
    }
  }

  function construirSystemPrompt() {
    const fonte = obterDadosDW();
    let resumoDados = 'Dados da Usina Alcar não carregados no momento.';

    if (fonte && fonte.tipo === 'dw') {
      const D = fonte.data;
      const stock = (D.estoque_familia || []).find(r => r.familia === 'TOTAL') || {};
      const clima = D.clima_atual || {};
      const forn = (D.kpi_fornecedor || []).filter(r => r.janela === 'ATUAL').sort((a,b) => b.atraso_medio_dias - a.atraso_medio_dias)[0];
      const criticos = (fonte.items || []).filter(i => i.risco === 'crítico' || i.risco === 'atenção').slice(0, 5);

      resumoDados = `
ESTADO ATUAL DA USINA ALCAR (Camada Ouro / Data Mart):
- Data da Posição: ${D.meta?.data_posicao || 'Hoje'}
- Itens em Risco: ${stock.itens_criticos || 23} críticos e ${stock.itens_atencao || 13} em atenção.
- Compras Sugeridas Totais: ${formatarDinheiro(stock.valor_sugerido || 224356.40)}
- Capital Imobilizado: ${formatarDinheiro(stock.capital_imobilizado || 3730000)} (Cobertura média: ${formatarNumero(stock.cobertura_dias || 42)} dias)
- Maior Atraso de Fornecedor: ${forn ? `${forn.fornecedor} com atraso médio de ${formatarNumero(forn.atraso_medio_dias)} dias` : 'N/D'}
- Clima Atual: ${clima.cenario || 'Chuvoso'} (${formatarNumero(clima.chuva_7d_mm || 48)} mm nos últimos 7 dias)
- Top 5 Itens Críticos: ${criticos.map(i => `${i.cod} (${i.nome}): falta em ${i.dias_ruptura ?? 0} dias, saldo ${i.saldo}, compras ${formatarDinheiro(i.valor)}`).join('; ')}
`;
    } else if (fonte && fonte.tipo === 'legado') {
      const crit = (fonte.items || []).filter(i => i.risco === 'crit');
      const val = crit.reduce((s, i) => s + (i.valor || 0), 0);
      resumoDados = `
ESTADO ATUAL DA USINA ALCAR (Base Operacional):
- Itens Críticos: ${crit.length} materiais em risco iminente de ruptura.
- Valor Total em Compras Recomendadas: ${formatarDinheiro(val)}
- Itens prioritários: ${crit.slice(0, 5).map(i => `${i.cod} (${i.nome}) - saldo ${i.saldo}`).join('; ')}
`;
    }

    return `Você é o Assistente Especialista de Inteligência de Suprimentos e Estoques da Usina Alcar, um Sistema de Apoio à Decisão (SAD) desenvolvido para a disciplina de Inteligência Organizacional (2º Bimestre).

SUA MISSÃO:
Responder a analistas de almoxarifado, compradores e gestores com respostas objetivas, embasadas na metodologia matemática formal de gestão de estoques e nos dados reais da usina.

METODOLOGIA MATEMÁTICA FORMAL:
1. Estoque de Segurança (SS): SS = z · √[ (R + L)·σd² + d̄²·σL² ]
   - Onde z é o fator de serviço (z=1,645 para 95%; z=2,326 para 99%), R é o período de revisão (7 dias), L é o Lead Time do fornecedor, d̄ e σd são a média e desvio padrão da demanda diária, σL o desvio do lead time.
2. Ponto de Pedido (PP): PP = d̄ · (R + L) + SS
3. Demanda Intermitente: Peças sobressalentes e de desgaste sofrem com intermitência. O método de Croston (1972) desacopla tamanho da saída e intervalo entre saídas; a variante SBA (Syntetos-Boylan, 2005) multiplica a previsão por (1 - α/2) para eliminar o viés sistemático de superestimação.
4. Métrica WAPE: WAPE = Σ |Real - Previsão| / Σ Real. Superior ao MAPE porque não divide por zero em semanas com demanda nula.
5. OTIF (On-Time In-Full): Avalia pedidos que chegaram dentro do prazo contratual e com quantidade 100% correta.
6. Governança e LGPD: O SAD lê apenas a Camada Ouro (Data Mart) de forma somente leitura, com pseudonimização SHA-256 e externalização de conhecimento (modelo SECI de Nonaka & Takeuchi).
7. Efeito Clima/Safra: Chuva forte paralisa colheita no campo, reduzindo o desgaste mecânico imediato, mas concentrando manutenções preventivas de entressafra.

${resumoDados}

INSTRUÇÕES DE FORMATAÇÃO:
- Seja direto, profissional e didático.
- Use negrito para valores numéricos e termos técnicos essenciais.
- Use listas curtas ou tópicos quando listar materiais ou fatores.
- As respostas serão renderizadas em balões de chat estilo WhatsApp.
- Você já possui todos os dados necessários da usina no resumo acima. NUNCA execute ferramentas, buscas ou emita tags XML. Responda diretamente em texto fluído em português.`;
  }

  function formatarTabelasMarkdown(texto) {
    const tableRegex = /((?:^[ \t]*\|[^\n]+\|[ \t]*\r?\n)(?:^[ \t]*\|[ \t:|-]+[ \t]*\r?\n)(?:^[ \t]*\|[^\n]+\|[ \t]*(?:\r?\n|$))+)/gm;
    return texto.replace(tableRegex, match => {
      const linhas = match.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (linhas.length < 2) return match;

      const headerCells = linhas[0].split('|').slice(1, -1).map(c => c.trim());
      const bodyRows = linhas.slice(2).map(r => r.split('|').slice(1, -1).map(c => c.trim()));

      const ths = headerCells.map(h => `<th>${h}</th>`).join('');
      const trs = bodyRows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');

      return `\n\n<div class="tabela-chat-scroll"><table class="tabela-chat"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>\n\n`;
    });
  }

  function formatarRespostaLLM(txt) {
    if (!txt) return '';
    let s = txt
      .replace(/<(search_project|list_directory|read_file|execute_command|write_file)[\s\S]*?<\/\1>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 1. Processa blocos matemáticos $$...$$ e código ```...```
    s = s.replace(/```([\s\S]*?)```/g, '<div class="formula-box"><code>$1</code></div>');
    s = s.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="formula-box"><code>$1</code></div>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\$([^\$\n]+)\$/g, '<code>$1</code>');

    // 2. Converte tabelas Markdown em HTML com scroll horizontal
    s = formatarTabelasMarkdown(s);

    // 3. Negrito e Itálico
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/\*([^*]+)\*/g, '<i>$1</i>');

    // 4. Autolink de códigos de materiais da usina (ex: AL-000001) para botão interativo
    s = s.replace(/\b(AL-\d{6})\b/g, '<button class="btn-acao-chat" data-item="$1" type="button" title="Ver detalhes de $1">🔍 $1</button>');

    // 5. Listas com marcadores
    s = s.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    s = s.replace(/<\/ul>\s*<ul>/g, '');

    // 6. Parágrafos preservando containers especiais
    const paras = s.split(/\n{2,}/).map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<ul') || p.startsWith('<div') || p.startsWith('<table')) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean);

    return paras.join('');
  }

  async function chamar9Router(pergunta, historico = []) {
    const cfg = obterConfig9R();
    if (cfg.modo === 'local') {
      throw new Error('Modo local forçado pelo usuário');
    }

    const systemPrompt = construirSystemPrompt();
    const historicoPrevio = historico.slice(-6).filter(m => m.content !== pergunta);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...historicoPrevio,
      { role: 'user', content: pergunta }
    ];

    const body = {
      model: cfg.model,
      messages: messages,
      temperature: 0.3,
      max_tokens: 650,
      stream: false
    };

    const inicio = performance.now();
    let res;

    try {
      res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.timeoutMs)
      });
    } catch (errProxy) {
      res = await fetch(cfg.directEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.timeoutMs)
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`9Router HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const latencia = Math.round(performance.now() - inicio);
    const content = data.choices?.[0]?.message?.content || '';
    const modeloUsado = data.model || cfg.model;

    if (!content.trim()) {
      throw new Error('Resposta vazia do 9Router');
    }

    return {
      texto: content,
      modelo: modeloUsado,
      latencia: latencia
    };
  }

  function garantirModalConfig() {
    let modal = document.querySelector('#dg-config-agente');
    if (!modal) {
      modal = document.createElement('dialog');
      modal.id = 'dg-config-agente';
      modal.innerHTML = `
        <div class="config-header">
          <h3>⚙️ Configuração do 9Router</h3>
          <button type="button" class="config-fechar" id="fx-config-agente" aria-label="Fechar configurações">✕</button>
        </div>
        <div class="config-corpo">
          <div class="config-status-card ${status9RouterOnline ? 'online' : 'offline'}" id="card-status-9r">
            <span>●</span>
            <span id="txt-status-9r">${status9RouterOnline ? '9Router conectado em localhost:20128' : '9Router desconectado (usando Motor Local)'}</span>
          </div>

          <div class="config-campo">
            <label for="cfg-modo">Modo de Operação</label>
            <select id="cfg-modo">
              <option value="auto">Automático (9Router com Fallback Local)</option>
              <option value="local">Forçar Motor Local (Offline)</option>
            </select>
          </div>

          <div class="config-campo">
            <label for="cfg-model">Modelo do 9Router</label>
            <input id="cfg-model" placeholder="ex: kr/claude-sonnet-4.5 ou open-code-free">
            <small style="color:#667781;font-size:11px">Alias do modelo configurado no dashboard do 9Router.</small>
          </div>

          <div class="config-campo">
            <label for="cfg-endpoint">Endpoint do Proxy</label>
            <input id="cfg-endpoint" placeholder="/api/chat">
          </div>

          <div class="config-campo">
            <label for="cfg-apikey">Chave de API (Opcional)</label>
            <input id="cfg-apikey" type="password" placeholder="9router-local">
          </div>

          <div class="config-acoes">
            <button type="button" class="btn-testar-9r" id="bt-testar-9r">Testar Conexão</button>
            <button type="button" class="btn-salvar-9r" id="bt-salvar-9r">Salvar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#fx-config-agente').onclick = () => modal.close();

      modal.querySelector('#bt-testar-9r').onclick = async () => {
        const txt = modal.querySelector('#txt-status-9r');
        const card = modal.querySelector('#card-status-9r');
        txt.textContent = 'Verificando conexão com localhost:20128...';
        card.className = 'config-status-card';
        const online = await verificarHealth9Router();
        if (online) {
          card.className = 'config-status-card online';
          txt.textContent = 'Conexão ativa! 9Router respondendo.';
        } else {
          card.className = 'config-status-card offline';
          txt.textContent = '9Router não detectado. Inicie com "npx 9router" no terminal.';
        }
      };

      modal.querySelector('#bt-salvar-9r').onclick = () => {
        const cfg = obterConfig9R();
        cfg.modo = modal.querySelector('#cfg-modo').value;
        cfg.model = modal.querySelector('#cfg-model').value.trim() || DEFAULT_CONFIG_9R.model;
        cfg.endpoint = modal.querySelector('#cfg-endpoint').value.trim() || DEFAULT_CONFIG_9R.endpoint;
        cfg.apiKey = modal.querySelector('#cfg-apikey').value.trim() || DEFAULT_CONFIG_9R.apiKey;
        salvarConfig9R(cfg);
        verificarHealth9Router();
        modal.close();
      };
    }

    const cfg = obterConfig9R();
    modal.querySelector('#cfg-modo').value = cfg.modo;
    modal.querySelector('#cfg-model').value = cfg.model;
    modal.querySelector('#cfg-endpoint').value = cfg.endpoint;
    modal.querySelector('#cfg-apikey').value = cfg.apiKey;
    const card = modal.querySelector('#card-status-9r');
    const txt = modal.querySelector('#txt-status-9r');
    card.className = `config-status-card ${status9RouterOnline ? 'online' : 'offline'}`;
    txt.textContent = status9RouterOnline ? '9Router conectado em localhost:20128' : '9Router desconectado (usando Motor Local)';

    return modal;
  }

  // ============================================================
  // 5. INTERFACE E CONTROLES DO CHAT
  // ============================================================
  const SUGESTOES = [
    'O que pede atenção hoje na usina?',
    'Como calcular o estoque de segurança?',
    'Quais itens estão mais perto de faltar?',
    'Qual fornecedor tem o maior atraso?',
    'O que é o método de Croston / SBA?',
    'A chuva afeta o consumo de peças?'
  ];

  function formatarHora(data = new Date()) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function inicializarChat() {
    const chat = document.querySelector('#chat');
    const form = document.querySelector('#form-chat');
    const sugs = document.querySelector('#sugs');
    const abrirBtn = document.querySelector('#bt-agente');
    const modal = document.querySelector('#dg-agente');
    const fecharBtn = document.querySelector('#fx-agente');
    const configBtn = document.querySelector('#bt-config-agente');

    if (!chat || !form) return;

    // Checagem de conectividade do 9Router na inicialização
    verificarHealth9Router();

    // Botão de configurações
    if (configBtn) {
      configBtn.onclick = () => {
        const dlg = garantirModalConfig();
        dlg.showModal();
      };
    }

    // Renderiza chips de sugestão rápida (ocultos por padrão para não obstruir a tela)
    if (sugs) {
      sugs.hidden = true;
      sugs.innerHTML = `
        <button type="button" class="sugs-fechar" id="fx-sugs" aria-label="Fechar sugestões" title="Fechar sugestões">✕</button>
        ${SUGESTOES.map(s => `<button type="button" class="chip chip-sugestao">${s}</button>`).join('')}
      `;
      sugs.onclick = e => {
        if (e.target.closest('#fx-sugs')) {
          sugs.hidden = true;
          return;
        }
        const btn = e.target.closest('.chip-sugestao');
        if (btn) {
          sugs.hidden = true;
          enviarMensagem(btn.textContent.trim());
        }
      };
    }

    // Botão de lâmpada no formulário para alternar sugestões sob demanda
    const btToggleSugs = form.querySelector('#bt-toggle-sugs');
    if (btToggleSugs && sugs) {
      btToggleSugs.onclick = () => {
        sugs.hidden = !sugs.hidden;
        if (!sugs.hidden) {
          sugs.scrollLeft = 0;
        }
      };
    }

    // Mensagem de boas-vindas inicial se estiver vazio
    if (!chat.children.length) {
      const hora = formatarHora();
      chat.innerHTML = `
        <div class="chat-data-badge">HOJE</div>
        <div class="msg-a">
          <p>👋 <b>Olá! Sou o assistente de IA da Usina Alcar.</b></p>
          <p>Posso tirar dúvidas sobre a <b>metodologia de estoque</b> ou analisar <b>dados reais da usina</b>.</p>
          <p style="margin:8px 0 4px;font-weight:600;color:#54656f;font-size:12px">💡 Perguntas sugeridas para começar:</p>
          <div class="chat-sugestoes-iniciais">
            <button type="button" class="chip-chat-msg" data-pergunta="O que pede atenção hoje na usina?">🚨 O que pede atenção hoje na usina?</button>
            <button type="button" class="chip-chat-msg" data-pergunta="Como calcular o estoque de segurança?">📐 Como calcular o estoque de segurança?</button>
            <button type="button" class="chip-chat-msg" data-pergunta="Quais itens estão mais perto de faltar?">⚠️ Quais itens estão mais perto de faltar?</button>
            <button type="button" class="chip-chat-msg" data-pergunta="Qual fornecedor tem o maior atraso?">🚚 Qual fornecedor tem o maior atraso?</button>
            <button type="button" class="chip-chat-msg" data-pergunta="O que é o método de Croston / SBA?">📊 O que é o método de Croston / SBA?</button>
            <button type="button" class="chip-chat-msg" data-pergunta="A chuva afeta o consumo de peças?">🌧️ A chuva afeta o consumo de peças?</button>
          </div>
          <div class="msg-meta"><span class="msg-hora">${hora}</span></div>
        </div>
      `;
    }

    // Envio do formulário
    form.onsubmit = e => {
      e.preventDefault();
      const input = form.querySelector('input');
      const texto = input.value.trim();
      if (!texto) return;
      input.value = '';
      enviarMensagem(texto);
    };

    // Controle de abertura e fechamento
    if (abrirBtn && modal) {
      abrirBtn.onclick = () => {
        modal.hidden = !modal.hidden;
        abrirBtn.setAttribute('aria-expanded', String(!modal.hidden));
        if (!modal.hidden) {
          verificarHealth9Router();
          const input = form.querySelector('input');
          input?.focus();
        }
      };
    }

    if (fecharBtn && modal) {
      fecharBtn.onclick = () => {
        modal.hidden = true;
        abrirBtn?.setAttribute('aria-expanded', 'false');
        abrirBtn?.focus();
      };
    }

    // Fecha com tecla ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const dlgConfig = document.querySelector('#dg-config-agente');
        if (dlgConfig && dlgConfig.open) {
          dlgConfig.close();
          return;
        }
        if (modal && !modal.hidden) {
          modal.hidden = true;
          abrirBtn?.setAttribute('aria-expanded', 'false');
          abrirBtn?.focus();
        }
      }
    });

    // Intercepta cliques nos botões de ação gerados nas respostas e sugestões
    chat.onclick = e => {
      // 0. Clique em sugestões rápidas do balão inicial
      const chipMsg = e.target.closest('.chip-chat-msg');
      if (chipMsg) {
        const pergunta = chipMsg.dataset.pergunta || chipMsg.textContent.trim();
        enviarMensagem(pergunta);
        return;
      }

      const btnAcao = e.target.closest('.btn-acao-chat');
      if (!btnAcao) return;

      // 1. Navegação para painéis ou âncoras
      const navTarget = btnAcao.dataset.nav;
      if (navTarget) {
        const ev = new CustomEvent('alcar:navegar', {detail: {target: navTarget}, bubbles: true});
        document.dispatchEvent(ev);
        const el = document.querySelector(navTarget);
        if (el) el.scrollIntoView({block: 'start', behavior: 'smooth'});
        return;
      }

      // 2. Abertura de detalhe de item específico
      const itemCod = btnAcao.dataset.item;
      if (itemCod) {
        const ev = new CustomEvent('alcar:detalhe-item', {detail: {cod: itemCod}, bubbles: true});
        document.dispatchEvent(ev);
        return;
      }
    };
  }

  async function enviarMensagem(texto) {
    const chat = document.querySelector('#chat');
    const sugs = document.querySelector('#sugs');
    if (!chat) return;

    // Oculta a barra de sugestões para liberar 100% da visualização do chat
    if (sugs) sugs.hidden = true;

    const horaEnvio = formatarHora();

    // Mensagem do usuário com carimbo de hora e tiques azuis
    const divUser = document.createElement('div');
    divUser.className = 'msg-u';
    const spanTexto = document.createElement('span');
    spanTexto.textContent = texto;
    divUser.appendChild(spanTexto);

    const metaUser = document.createElement('div');
    metaUser.className = 'msg-meta';
    metaUser.innerHTML = `<span class="msg-hora">${horaEnvio}</span><span class="msg-check" aria-label="Entregue e lida">✓✓</span>`;
    divUser.appendChild(metaUser);

    chat.appendChild(divUser);
    chat.scrollTop = chat.scrollHeight;

    atualizarBadgeHeader(true);

    // Indicador visual de digitação (bouncing dots estilo WhatsApp)
    const typingBubble = document.createElement('div');
    typingBubble.className = 'msg-a typing-bubble';
    typingBubble.id = 'typing-bubble';
    typingBubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    chat.appendChild(typingBubble);
    chat.scrollTop = chat.scrollHeight;

    historicoConversa.push({ role: 'user', content: texto });
    if (historicoConversa.length > 20) {
      historicoConversa.splice(0, historicoConversa.length - 20);
    }

    let respostaHtml = '';
    let origemHtml = '';

    try {
      // 1. Tenta chamar o 9Router (LLM Real)
      const res9R = await chamar9Router(texto, historicoConversa);
      respostaHtml = formatarRespostaLLM(res9R.texto);
      origemHtml = `<span class="badge-origem-9r">🤖 9Router · ${res9R.modelo} · ${res9R.latencia}ms</span>`;
      status9RouterOnline = true;
      historicoConversa.push({ role: 'assistant', content: res9R.texto });
    } catch (err) {
      // 2. Fallback automático para o motor determinístico local
      status9RouterOnline = false;
      const resultadoLocal = processarPergunta(texto);
      respostaHtml = resultadoLocal.resposta;
      origemHtml = `<span class="badge-origem-local">⚡ Motor Local Alcar (Fallback)</span> <small style="color:#667781">· ${resultadoLocal.origem}</small>`;
      historicoConversa.push({ role: 'assistant', content: resultadoLocal.resposta.replace(/<[^>]+>/g, ' ') });
    } finally {
      typingBubble.remove();
      atualizarBadgeHeader(false);

      const respHora = formatarHora();
      const divAgente = document.createElement('div');
      divAgente.className = 'msg-a';
      divAgente.innerHTML = `
        ${respostaHtml}
        <div class="meta">${origemHtml}</div>
        <div class="msg-meta"><span class="msg-hora">${respHora}</span></div>
      `;
      chat.appendChild(divAgente);
      chat.scrollTop = chat.scrollHeight;
    }
  }

  // Exposição global
  window.AgenteIA = {
    processar: processarPergunta,
    enviar: enviarMensagem,
    init: inicializarChat,
    verificar9Router: verificarHealth9Router,
    obterConfig: obterConfig9R,
    salvarConfig: salvarConfig9R
  };

  // Auto-inicialização quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarChat);
  } else {
    inicializarChat();
  }
})();
