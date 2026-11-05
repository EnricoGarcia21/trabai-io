export const fields = {E1:'nivel_servico_pct',E3:'otif_pct',O1:'acuracia_previsao_pct',O2:'tempo_aprovacao_dias'};
export const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const num = (v,n=1) => v == null || !Number.isFinite(+v) ? 'sem dado' : new Intl.NumberFormat('pt-BR',{minimumFractionDigits:n,maximumFractionDigits:n}).format(+v);
export const money = v => v == null ? 'sem dado' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);
export const date = s => s ? s.slice(8,10)+'/'+s.slice(5,7) : 'sem data';
export const sum = a => a.reduce((s,v)=>s+(Number.isFinite(+v)?+v:0),0);
export const ratio = (a,b) => b ? a/b : null;
export const format = (v,i) => num(v,i.codigo==='O2'?2:1)+(v==null?'':i.unidade==='%'?'%':' '+i.unidade);
export const within = (v,i) => v==null?null:(i.meta_min==null||v>=i.meta_min)&&(i.meta_max==null||v<=i.meta_max);
export const metaText = i => i.meta_min!=null&&i.meta_max!=null ? `${num(i.meta_min,0)}–${num(i.meta_max,0)} ${i.unidade}` : `${i.meta_min!=null?'≥':'≤'} ${num(i.meta_min??i.meta_max,0)} ${i.unidade}`;
export function validate(D) {
  for (const key of ['indicadores','kpi_resumo','kpi_semanal','kpi_fornecedor','estoque_familia','itens','itens_semana','clima_semanal','familias','fornecedores','semanas','decisoes','ruptura_causa','otif_sensibilidade']) if (!Array.isArray(D[key])) throw Error(`Contrato inválido: ${key}`);
  if (!D.meta?.parametros || !/^\d{4}-\d{2}-\d{2}$/.test(D.meta.data_posicao) || !D.clima_atual) throw Error('Contrato sem metadados ou clima atual');
  if (!['E1','E2','E3','O1','O2','O3'].every(c=>D.indicadores.some(i=>i.codigo===c)&&D.kpi_resumo.some(i=>i.codigo===c&&i.familia==='TOTAL'))) throw Error('Contrato sem os seis indicadores');
  if (D.itens.some(i=>!i.cod||!Number.isFinite(i.saldo)||!Number.isFinite(i.custo))) throw Error('Contrato com item inválido');
  return D;
}
export const defaults = D => ({fam:'TOTAL',janela:'ATUAL',agricola:'',forn:'',abc:'',risco:'',padrao:'',nivel:95,indicador:'E1',item:'',page:0,perfil:'analista',pareto:''});
export function weeks(D,f) {
  return D.semanas.filter(w=>(f.janela==='ANO'||w.janela===f.janela)&&(!f.agricola||(f.agricola==='safra'?w.semana_inicio.slice(5)>='04-01':w.semana_inicio.slice(5)<'04-01')));
}
export const weekly = (D,f,fam=f.fam) => {const keys=new Set(weeks(D,f).map(w=>w.semana_inicio));return D.kpi_semanal.filter(w=>w.familia===fam&&keys.has(w.semana_inicio));};
export function moving(a,n=4) { return a.map((v,k)=>{if(v==null)return null;const xs=a.slice(Math.max(0,k-n+1),k+1).filter(v=>v!=null);return ratio(sum(xs),xs.length);}); }
export function summary(D,f,code) {
  const r=D.kpi_resumo.find(r=>r.familia===f.fam&&r.codigo===code);
  const i=D.indicadores.find(i=>i.codigo===code);
  if (!r) return {value:null,previous:null,trend:null,status:null};
  if (['E2','O3'].includes(code)) return {value:r.valor_atual,previous:null,trend:null,status:!!r.dentro_da_meta};
  if (!f.agricola&&f.janela!=='ANO') {const v=f.janela==='ATUAL'?r.valor_atual:r.valor_anterior;return {value:v,previous:f.janela==='ATUAL'?r.valor_anterior:null,trend:f.janela==='ATUAL'?r.tendencia:null,status:within(v,i)};}
  const rows=weekly(D,f), field=fields[code];
  const consumed=new Map();
  if(code==='O1') {const ids=new Set(D.itens.filter(it=>f.fam==='TOTAL'||it.fam===f.fam).map(it=>it.cod));for(const s of D.itens_semana)if(ids.has(s.cod))consumed.set(s.semana,(consumed.get(s.semana)||0)+s.consumo);}
  const weight = r => code==='E1'?r.itens_observados:code==='E3'?r.pedidos_recebidos:code==='O2'?r.requisicoes:(consumed.get(r.semana_inicio)||0);
  const valid=rows.filter(r=>r[field]!=null), den=sum(valid.map(weight));
  const value=ratio(sum(valid.map(r=>r[field]*weight(r))),den);
  return {value,previous:null,trend:null,status:within(value,i),estimated:true};
}
export function filteredItems(D,f,items=D.itens) {return items.filter(i=>(f.fam==='TOTAL'||i.fam===f.fam)&&(!f.forn||i.forn===f.forn)&&(!f.abc||i.abc===f.abc)&&(!f.risco||i.risco===f.risco)&&(!f.padrao||i.padrao===f.padrao));}
export const urgent = items => [...items].sort((a,b)=>(a.dias_ruptura==null?Infinity:a.dias_ruptura-a.L)-(b.dias_ruptura==null?Infinity:b.dias_ruptura-b.L)||a.cod.localeCompare(b.cod));
export function zInv(p) {
  const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],c=[-.00778489400243029,-.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],d=[.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];
  const tail=q=>(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  if(p<.02425)return tail(Math.sqrt(-2*Math.log(p))); if(p>1-.02425)return -tail(Math.sqrt(-2*Math.log(1-p)));
  const q=p-.5,r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
export function simulate(D,nivel) {
  const z=nivel===95?+D.meta.parametros.nivel_servico_z:zInv(nivel/100),R=+D.meta.parametros.revisao_dias;
  return D.itens.map(i=>{const ss=z*Math.sqrt((R+i.L)*i.sdd**2+i.d**2*i.sL**2),pp=i.d*(R+i.L)+ss,pos=i.saldo+i.transito;
    const risco=i.dias_ruptura!=null&&i.dias_ruptura<=i.L?'crítico':pos<=pp?'atenção':'sem risco',qtd=risco==='sem risco'?0:i.lote*Math.max(1,Math.ceil((pp-pos+1)/i.lote));
    return {...i,ss,pp,risco,qtd,valor:qtd*i.custo};});
}
export function decision(D,item,action,quantity,why,perfil,now=new Date()) {
  if(!['aceitou','ajustou','recusou'].includes(action))throw Error('Decisão inválida');
  if(!['analista','compras','gestor'].includes(perfil))throw Error('Perfil inválido');
  if(action!=='aceitou'&&!why.trim())throw Error('Informe a justificativa');
  const qty=action==='recusou'?0:action==='aceitou'?item.qtd:Number(quantity);
  if(action!=='recusou'&&(!Number.isFinite(qty)||qty<=0))throw Error('Informe uma quantidade positiva');
  const elapsed=(now-new Date(D.meta.data_posicao+'T00:00:00-03:00'))/864e5;
  const limit=+(item.risco==='crítico'?D.meta.parametros.prazo_decisao_critico_dias:D.meta.parametros.prazo_decisao_atencao_dias);
  return {cod:item.cod,data_sugestao:D.meta.data_posicao,data_decisao:now.toISOString(),qtd_sugerida:item.qtd,qtd_decidida:qty,decisao:action,perfil,justificativa:why.trim().slice(0,500),decidido_no_prazo:elapsed>=0&&elapsed<=limit?1:0};
}
export function csv(headers,rows) {const q=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replace(/"/g,'""')+'"';return '\uFEFF'+[headers,...rows].map(r=>r.map(q).join(';')).join('\r\n');}
export const storageKey='alcar-dashboard-decisoes-v1';
export function readDecisions(D,storage) {try{const a=JSON.parse(storage.getItem(storageKey)||'null');return Array.isArray(a)?a.filter(r=>D.itens.some(i=>i.cod===r.cod)&&['aceitou','ajustou','recusou'].includes(r.decisao)&&typeof r.justificativa==='string'&&[0,1].includes(r.decidido_no_prazo)):D.decisoes.slice();}catch{return D.decisoes.slice();}}
export function saveDecisions(a,storage) {try{storage.setItem(storageKey,JSON.stringify(a));return true;}catch{return false;}}
