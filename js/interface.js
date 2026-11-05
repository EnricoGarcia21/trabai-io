const CHAVE_FILTROS = 'alcar-painel-filtros-v2';
function salvarFiltros() {
  const {fam, item, forn, inicio, fim, safra, pad, abc, risco, nivel, perfil} = S;
  lsSet(CHAVE_FILTROS, {fam, item, forn, inicio, fim, safra, pad, abc, risco, nivel, perfil});
}
function prepararPaginas() {
  const salvo = lsGet(CHAVE_FILTROS, {});
  for (const campo of ['fam', 'item', 'forn', 'safra', 'pad', 'abc', 'risco']) {
    if (typeof salvo[campo] === 'string') S[campo] = salvo[campo];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(salvo.inicio) && /^\d{4}-\d{2}-\d{2}$/.test(salvo.fim) && salvo.inicio <= salvo.fim) {
    S.inicio = salvo.inicio; S.fim = salvo.fim;
  }
  if (['analista', 'compras', 'gestor'].includes(salvo.perfil)) S.perfil = salvo.perfil;
  if (typeof salvo.nivel === 'number' && salvo.nivel >= 85 && salvo.nivel <= 99.5) S.nivel = salvo.nivel;
  const pagina = document.body.dataset.pagina;
  if (pagina === 'compras' && !['', 'crit', 'aten'].includes(S.risco)) S.risco = '';
  $$('[data-vista]').forEach(el => { el.hidden = el.dataset.vista !== pagina; });
  $$('.navegacao a').forEach(a => { if (a.dataset.pagina === pagina) a.setAttribute('aria-current', 'page'); });
  document.title = `${{home:'Home', compras:'Compras', decisoes:'Decisões'}[pagina]} · Suprimentos Alcar`;
}
function prepararControles() {
  for (const [id, campo] of [['f-fam','fam'], ['f-forn','forn'], ['f-safra','safra'], ['f-pad','pad'], ['f-abc','abc'], ['perfil','perfil'], ['f-nivel','nivel'], ['f-inicio','inicio'], ['f-fim','fim']]) $('#' + id).value = S[campo];
  const item = ITENS.find(i => i.id === +S.item);
  $('#f-item').value = item ? `${item.nome} — ${item.cod}` : '';
  const risco = $('#f-risco');
  if (risco) {
    risco.value = S.risco;
    risco.addEventListener('change', () => { S.risco = risco.value; S.mostrar = 12; render(); });
    $('#bt-limpar').addEventListener('click', () => { risco.value = ''; });
  }
  for (const id of ['f-inicio', 'f-fim']) $('#' + id).addEventListener('change', () => {
    const inicio = $('#f-inicio'), fim = $('#f-fim');
    inicio.setCustomValidity(''); fim.setCustomValidity('');
    if (!inicio.value || !fim.value || inicio.value > fim.value) {
      fim.setCustomValidity('Informe as duas datas, com a data final igual ou posterior à inicial.');
      fim.reportValidity(); return;
    }
    S.inicio = inicio.value; S.fim = fim.value; S.mostrar = 12; render();
  });
  $$('[data-recolher]').forEach(b => b.addEventListener('click', () => {
    const el = $('#' + b.dataset.recolher); el.hidden = !el.hidden;
    b.setAttribute('aria-expanded', String(!el.hidden));
    b.setAttribute('aria-label', `${el.hidden ? 'Expandir' : 'Recolher'} ${b.dataset.titulo}`);
    if (!el.hidden) render();
  }));
  const consulta = $('#dg-agente'), abrirConsulta = $('#bt-agente');
  const fecharConsulta = () => {
    consulta.hidden = true;
    abrirConsulta.setAttribute('aria-expanded', 'false');
    abrirConsulta.focus();
  };
  abrirConsulta.onclick = () => {
    if (!consulta.hidden) { fecharConsulta(); return; }
    consulta.hidden = false;
    abrirConsulta.setAttribute('aria-expanded', 'true');
    $('#q').focus();
  };
  $('#fx-agente').onclick = fecharConsulta;
  consulta.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); fecharConsulta(); }
  });
  $('#bt-mapa').onclick = () => {
    S.mapa = !S.mapa; $('#bt-mapa').setAttribute('aria-pressed', String(S.mapa));
    $('#bt-mapa').textContent = S.mapa ? 'Ver card' : 'Ver mapa'; renderClima();
  };
  $('#bt-excel').onclick = exportarExcel;
  document.addEventListener('alcar:navegar', e => {
    const target = e.detail?.target;
    if (!target) return;
    const el = document.querySelector(target);
    if (el) el.scrollIntoView({block: 'start', behavior: 'smooth'});
  });
  document.addEventListener('alcar:detalhe-item', e => {
    const cod = e.detail?.cod;
    if (cod && typeof ITENS !== 'undefined') {
      const item = ITENS.find(i => i.cod.toLowerCase() === cod.toLowerCase());
      if (item && typeof abrirItem === 'function') abrirItem(item.id);
    }
  });
  window.addEventListener('storage', e => {
    if (e.key === 'alcar-proto-v1-log') { LOG = lsGet(e.key, []); render(); }
  });
}
function decisoesFiltradas() {
  const ids = new Set(filtrados(false).map(i => i.id));
  return LOG.filter(e => ids.has(e.id));
}
function renderMapa(c, fim) {
  $('#clima-corpo').innerHTML = `<figure class="mapa"><svg viewBox="0 0 360 220" role="img" aria-label="Mapa esquemático da usina fictícia, sem localização geográfica real">
    <rect width="360" height="220" rx="12" fill="#e7eedd"/><path d="M0 140Q90 60 150 130T360 80" stroke="#a6c8db" stroke-width="18" fill="none"/>
    <path d="M35 0L120 220M0 45L360 180M260 0L230 220" stroke="white" stroke-width="9"/>
    <circle cx="180" cy="100" r="40" fill="${c.cen === 'CHUVOSO' ? '#a6c8db' : '#d6dfab'}" stroke="#47682C" stroke-width="2"/>
    <text x="180" y="98" text-anchor="middle" fill="#080F0F" font-size="15">${nf1.format(c.mm)} mm</text>
    <text x="180" y="117" text-anchor="middle" fill="#080F0F" font-size="12">${nf1.format(c.t)} °C</text>
    <text x="180" y="165" text-anchor="middle" fill="#080F0F" font-size="16">Usina Alcar · ${c.cen}</text></svg>
    <figcaption class="nota">Mapa demonstrativo, sem geolocalização. Dados simulados dos 7 dias até ${dm(fim)}; não é radar ou previsão em tempo real.</figcaption></figure><p>${MSG_CL[c.cen]}</p>`;
}

// XLSX uses a small uncompressed ZIP; no runtime dependency or network needed.
function zipPlanilha(arquivos) {
  const enc = new TextEncoder(), partes = [], central = []; let offset = 0;
  const header = (size, values) => { const a = new Uint8Array(size), d = new DataView(a.buffer); for (const [pos, valor, bytes] of values) bytes === 2 ? d.setUint16(pos, valor, true) : d.setUint32(pos, valor, true); return a; };
  for (const [nome, texto] of Object.entries(arquivos)) {
    const n = enc.encode(nome), conteudo = enc.encode(texto); let crc = 0xffffffff;
    for (const b of conteudo) { crc ^= b; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = header(30, [[0,0x04034b50,4],[4,20,2],[14,crc,4],[18,conteudo.length,4],[22,conteudo.length,4],[26,n.length,2]]);
    partes.push(local, n, conteudo);
    central.push(header(46, [[0,0x02014b50,4],[4,20,2],[6,20,2],[16,crc,4],[20,conteudo.length,4],[24,conteudo.length,4],[28,n.length,2],[42,offset,4]]), n);
    offset += local.length + n.length + conteudo.length;
  }
  const tamanho = central.reduce((s, b) => s + b.length, 0), total = Object.keys(arquivos).length;
  return new Blob([...partes, ...central, header(22, [[0,0x06054b50,4],[8,total,2],[10,total,2],[12,tamanho,4],[16,offset,4]])], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function exportarExcel() {
  const idx = semanas(), itens = filtrados(true);
  if (!idx.length || !itens.length) { toast('Não há consumo no recorte para exportar'); return; }
  const linhas = [['Início da semana', 'Fim da semana', 'Real', 'Previsto', 'Unidade']];
  serieSemanal(itens, idx, S.met === 'rs').forEach((s, i) => linhas.push([dmy(WK[idx[i]]), dmy(addDays(WK[idx[i]],6)), s.r, s.p, S.met === 'rs' ? 'R$' : 'un']));
  const xml = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const sheet = `<worksheet xmlns="${ns}"><cols><col min="1" max="5" width="22" customWidth="1"/></cols><sheetData>${linhas.map((l,i) => `<row r="${i+1}">${l.map((v,j) => `<c r="${String.fromCharCode(65+j)}${i+1}"${typeof v === 'number' ? '' : ' t="inlineStr"'}>${typeof v === 'number' ? `<v>${v}</v>` : `<is><t>${xml(v)}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const blob = zipPlanilha({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Consumo" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':sheet
  });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'consumo_alcar.xlsx'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
init();
