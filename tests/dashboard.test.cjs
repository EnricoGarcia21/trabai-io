const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const load = async () => ({core:await import('../dashboard/core.mjs'), D:JSON.parse(await fs.readFile(path.join(__dirname,'../dashboard/dados_alcar.json'),'utf8'))});
test('contrato, KPIs publicados e janelas não inventam valores', async () => {
  const {core:c,D} = await load(); c.validate(D);
  const f = c.defaults(D);
  assert.deepEqual(D.indicadores.map(i=>[i.codigo,c.summary(D,f,i.codigo).value]).sort(), [['E1',95.5],['E2',49.2],['E3',22.44],['O1',69.62],['O2',2.89],['O3',11.5]]);
  assert.equal(c.weeks(D,f).length,13);
  assert.equal(c.weeks(D,{...f,janela:'ANTERIOR'}).length,13);
  assert.equal(c.weeks(D,{...f,janela:'ANO'}).length,41);
  assert.equal(c.weeks(D,{...f,agricola:'entre'}).length,0);
  assert.equal(c.summary(D,{...f,agricola:'entre'},'E1').value,null);
  assert.equal(c.summary(D,{...f,janela:'ANTERIOR'},'E1').value,95.92);
});
test('política padrão é fiel ao contrato e simulação não altera a fonte',async()=>{
  const {core:c,D} = await load(); const original=JSON.stringify(D.itens);
  const items=c.simulate(D,95);
  assert.equal(items.filter(i=>i.risco==='crítico').length,23);
  assert.equal(items.filter(i=>i.risco==='atenção').length,13);
  assert.equal(JSON.stringify(D.itens),original);
  assert.ok(c.simulate(D,99.5).some((i,k)=>i.pp>D.itens[k].pp));
});
test('decisão valida justificativa, quantidade e prazo; CSV neutraliza fórmulas', async()=>{
  const {core:c,D} = await load(); const item=D.itens.find(i=>i.risco==='crítico');
  assert.throws(()=>c.decision(D,item,'ajustou',0,'motivo','analista',new Date()),/quantidade/i);
  assert.throws(()=>c.decision(D,item,'recusou',0,'','analista',new Date()),/justificativa/i);
  const r=c.decision(D,item,'aceitou',item.qtd,'','analista',new Date(D.meta.data_posicao+'T12:00:00-03:00'));
  assert.equal(r.decidido_no_prazo,1); assert.equal(r.cod,item.cod);
  assert.equal(c.decision(D,item,'aceitou',item.qtd,'','analista',new Date('2026-11-02T12:00:00-03:00')).decidido_no_prazo,0);
  assert.match(c.csv(['texto'],[['=1+1']]),/'=1\+1/);
  assert.deepEqual(c.moving([null,10,null,30],4),[null,10,null,20]);
});
test('gráfico de risco representa a quantidade total das famílias',async()=>{
  const {D}=await load(),{stacked}=await import('../dashboard/charts.mjs');
  const rows=D.estoque_familia.filter(r=>r.familia!=='TOTAL').map(r=>({...r,label:r.familia}));
  const html=stacked(rows,5);
  const width=id=>{
    const group=html.match(new RegExp(`<g data-fam="${id}"[^>]*>(.*?)</g>`,'s'))[1];
    return [...group.matchAll(/<rect[^>]*width="([^"]+)"/g)].reduce((s,r)=>s+Number(r[1]),0);
  };
  assert.ok(Math.abs(width('LUB')/width('ROL')-18/30)<1e-9,'famílias de18 e30 itens devem ter larguras proporcionais');
  assert.match(html,/18 itens/);assert.match(html,/30 itens/);assert.match(html,/meta críticos 5%/);
});
test('linhas têm identificação direta e marcadores coerentes com a legenda',async()=>{
  const {line,C}=await import('../dashboard/charts.mjs');
  const html=line(['a','b'],[{name:'Família',values:[3,4],color:C.oliva},{name:'TOTAL',values:[3,5],color:C.cinza,dash:true},{name:'Média móvel',values:[3,4.5],color:C.petroleo,dash:true}]);
  assert.match(html,/<text[^>]*>● Família<\/text>/);
  assert.match(html,/<text[^>]*>○ TOTAL<\/text>/);
  assert.match(html,/<text[^>]*>■ Média móvel<\/text>/);
  assert.match(html,/<rect[^>]*data-tip="[^"]*Média móvel/);
});
test('títulos expressam conclusões derivadas dos dados',async()=>{
  const {D,core:c}=await load(),p=await import('../dashboard/paineis.mjs'),f=c.defaults(D);
  const p5=p.p5(D,f),p6=p.p6(D,f);
  const outside=D.kpi_resumo.filter(r=>r.familia!=='TOTAL'&&r.valor_atual!=null&&!r.dentro_da_meta).length;
  assert.ok(p5.includes(`${outside} de ${D.familias.length*D.indicadores.length} resultados das famílias estão fora da meta`));
  assert.match(p5,/maior vantagem sobre a empresa/);
  assert.match(p6,/maior chuva do recorte/);assert.match(p6,/Pico de consumo/);assert.match(p6,/Maior consumo médio por item/);
});
