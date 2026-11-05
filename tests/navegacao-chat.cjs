const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const server=require('../serve.cjs');
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  const page=await browser.newPage(),base=`http://127.0.0.1:${server.address().port}`,errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,820,1366]){
   await page.setViewportSize({width,height:900});let reference;
   for(const file of ['dashboard.html','index.html','compras.html','decisoes.html']){
    await page.goto(base+'/'+file);
    if(file==='dashboard.html')await page.locator('[data-kpi=E1]').waitFor();
    const layout=await page.locator('.navegacao').evaluate(nav=>{const box=nav.getBoundingClientRect();return [...nav.children].map(a=>{const r=a.getBoundingClientRect();return {x:r.x,y:r.y-box.y,width:r.width,height:r.height};});});
    if(reference)assert.deepEqual(layout,reference,`${file} ${width}: disposição dos links`);else reference=layout;
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(file!=='dashboard.html'){
     await page.locator('#bt-agente').click();
     assert.equal(await page.locator('#dg-agente').isVisible(),true);
     assert.equal(await page.locator('#dg-agente').evaluate(el=>el.tagName),'SECTION');
     assert.equal(await page.locator('dialog:modal').count(),0);
     // A consulta não bloqueia os demais controles da página.
     await page.selectOption('#f-abc','A');
     assert.equal(await page.locator('#f-abc').inputValue(),'A');
     assert.equal(await page.locator('#dg-agente').isVisible(),true);
     await page.locator('#q').fill('Como calcular o estoque de segurança?');
     await page.locator('#form-chat button').click();
     await page.waitForFunction(()=>document.querySelector('#chat').textContent.includes('SS ='));
     const history=await page.locator('#chat').innerText();
     await page.locator('#fx-agente').click();
     assert.equal(await page.locator('#dg-agente').isVisible(),false);
     await page.locator('#bt-agente').click();
     assert.equal(await page.locator('#chat').innerText(),history);
     await page.locator('#q').focus();await page.keyboard.press('Escape');
     assert.equal(await page.locator('#dg-agente').isVisible(),false);
     assert.equal(await page.locator('#bt-agente').getAttribute('aria-expanded'),'false');
    }
    const next=file==='index.html'?'Compras':file==='compras.html'?'Decisões':file==='decisoes.html'?'Dashboard':'Home';
    await page.getByRole('link',{name:next,exact:true}).click();
   }
  }
  assert.deepEqual(errors,[]);
  console.log('OK: navegação igual nas quatro telas e chat não modal em Home/Compras/Decisões, 390/820/1366.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
