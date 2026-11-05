const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const server=require('../serve.cjs');
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/index.html');
  assert.equal(await page.locator('.kpi-info').count(),6);
  for(const info of await page.locator('.kpi-info').all()){
   await info.focus();const id=await info.getAttribute('aria-controls');
   const tip=page.locator('#'+id);assert.equal(await tip.isVisible(),true);
   assert.match(await tip.innerText(),/Cálculo/);
   await page.keyboard.press('Escape');assert.equal(await tip.isVisible(),false);
   await info.click();assert.equal(await tip.isVisible(),true);
   await page.locator('h1').click();assert.equal(await tip.isVisible(),false);
  }
  const arrow=page.locator('#t3 [data-recolher]');
  assert.equal(await arrow.count(),1,'seta deve estar junto ao título do risco');
  assert.doesNotMatch(await arrow.innerText(),/Recolher|Expandir/);
  await arrow.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#risco-conteudo').isVisible(),false);
  assert.equal(await arrow.getAttribute('aria-expanded'),'false');
  await page.keyboard.press('Enter');assert.equal(await page.locator('#risco-conteudo').isVisible(),true);
  await page.locator('#chips-risco [data-r="ok"]').click();
  await page.getByRole('link',{name:'Compras',exact:true}).click();
  assert.equal(await page.locator('#f-risco').inputValue(),'');
  assert.ok(await page.locator('.compra:visible').count()>0,'Sem risco na Home não deve esvaziar as compras');
  await page.locator('#bt-limpar').click();
  assert.equal(await page.locator('#f-risco').isVisible(),true);
  await page.selectOption('#f-risco','crit');
  const visible=await page.locator('.compra:visible').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.id)));
  const expected=await page.evaluate(()=>filtrados(false).filter(i=>i.risco==='crit'&&[null,'devolvida'].includes(ultimoStatus(i.id))).length);
  assert.ok(visible.length>0);assert.equal(visible.length,Math.min(40,expected));
  assert.equal(await page.locator('.compra:visible').evaluateAll(nodes=>nodes.every(n=>ITENS.find(i=>i.id===Number(n.dataset.id)).risco==='crit')),true);
  await page.reload();assert.equal(await page.locator('#f-risco').inputValue(),'crit');
  await page.locator('#bt-limpar').click();assert.equal(await page.locator('#f-risco').inputValue(),'');
  for(const width of [390,820,1366]){
   await page.setViewportSize({width,height:900});
   for(const url of ['index.html','compras.html','decisoes.html','dashboard.html']){
    await page.goto(base+'/'+url);
    if(url==='dashboard.html')await page.locator('[data-kpi=E1]').waitFor();
    await page.evaluate(()=>scrollTo(0,700));await page.waitForTimeout(100);
    const bounds=await page.evaluate(()=>{const top=document.querySelector('.topo').getBoundingClientRect(),filters=document.querySelector('.filtros,#filters');return {top:top.top,bottom:top.bottom,filterTop:filters.getBoundingClientRect().top,sticky:getComputedStyle(filters).position,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.ok(Math.abs(bounds.top)<1,`${url} ${width}: topo deve acompanhar rolagem`);
    if(bounds.sticky==='sticky')assert.ok(bounds.filterTop>=bounds.bottom-1,`${url}: filtros sobrepõem cabeçalho`);
    assert.equal(bounds.overflow,false,`${url} ${width}: rolagem horizontal`);
   }
  }
  assert.deepEqual(errors,[]);
  console.log('OK: seis tooltips com fórmulas, setas acessíveis, criticidade em Compras, persistência e cabeçalho fixo sem sobreposição em 390/820/1366.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
