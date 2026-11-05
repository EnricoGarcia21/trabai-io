import {esc,num,date} from './core.mjs';
export const C={oliva:'var(--oliva)',claro:'var(--oliva-claro)',cinza:'var(--cinza)',tinta:'var(--tinta)',borda:'var(--borda)',crit:'var(--crit)',aten:'var(--aten)',petroleo:'var(--petroleo)',salvia:'var(--salvia)',terra:'var(--terra)'};
const tip = s => `tabindex="0" data-tip="${esc(s)}"`;
const svg = (w,h,body,label) => `<svg viewBox="0 0 ${w} ${h}" style="min-width:${w}px" role="img" aria-label="${esc(label)}">${body}</svg>`;
const text = (x,y,s,attrs='') => `<text x="${x}" y="${y}" ${attrs}>${esc(s)}</text>`;
const seriesMarker = s => s.name==='TOTAL'?'○':s.color===C.petroleo?'■':s.color===C.terra?'▲':'●';
export function table(headers,rows) {return `<div class="table-scroll"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
export function graph(id,title,headers,rows,viz,note='',scope='') {
  return `<article class="graph" id="${id}" data-graph><div class="graph-head"><h3>${esc(title)}</h3><div class="tools"><button type="button" data-table="${id}" aria-controls="${id}-table" aria-expanded="false">Ver como tabela</button><button type="button" data-csv="${id}">Exportar CSV</button></div></div>${scope?`<p class="scope">${esc(scope)}</p>`:''}
  <div class="visual">${rows.length?viz:'<p class="empty">nenhum item com esses filtros</p>'}</div><div class="data-table" id="${id}-table" hidden>${table(headers,rows)}</div>${note?`<p class="note">${esc(note)}</p>`:''}</article>`;
}
export function line(labels,series,{meta=null,height=255,zero=false,shade=[],warming=[],bars=null,rupture=[],sync='',extra=[],ceiling=null}={}) {
  const w=720,h=height,l=62,r=24,t=24,b=40,iw=w-l-r,ih=h-t-b;
  const vals=series.flatMap(s=>s.values).concat(bars||[],meta==null?[]:[meta]).filter(v=>v!=null&&Number.isFinite(v));
  if(!labels.length||!vals.length)return '<p class="empty">nenhum item com esses filtros</p>';
  let lo=zero?Math.min(0,...vals):Math.min(...vals),hi=Math.max(...vals); const gap=(hi-lo)||Math.max(1,Math.abs(hi)*.1);if(!zero)lo-=gap*.12;hi=ceiling??hi+gap*.12;
  const x=k=>l+(sync?(k+.5)*iw/labels.length:labels.length===1?iw/2:k*iw/(labels.length-1)),y=v=>t+ih-(v-lo)/(hi-lo)*ih;
  let body='';
  labels.forEach((_,k)=>{const step=iw/Math.max(labels.length-1,1);if(shade[k]||warming[k])body+=`<rect x="${Math.max(l,x(k)-step/2)}" y="${t}" width="${Math.min(step,w-r-Math.max(l,x(k)-step/2))}" height="${ih}" fill="${warming[k]?C.borda:C.claro}" opacity=".6"/>`;});
  for(let j=0;j<5;j++){const v=lo+(hi-lo)*j/4;body+=`<path d="M${l} ${y(v)}H${w-r}" stroke="${C.borda}"/>`+text(l-7,y(v)+4,num(v),'text-anchor="end"');}
  if(meta!=null)body+=`<path d="M${l} ${y(meta)}H${w-r}" stroke="${C.tinta}" stroke-dasharray="4 3"/>`+text(w-r,y(meta)-5,'meta '+num(meta),'text-anchor="end"');
  if(bars)bars.forEach((v,k)=>{if(v!=null)body+=`<rect x="${x(k)-3}" y="${y(v)}" width="6" height="${Math.max(0,y(0)-y(v))}" fill="${C.borda}"/>`;});
  const annotations=[];
  series.forEach(s=>{
    let d='';s.values.forEach((v,k)=>{if(v==null){d+=' ';return;} d+=(k===0||s.values[k-1]==null?'M':'L')+x(k)+','+y(v)+' ';});
    body+=`<path d="${d.trim()}" stroke="${s.color||C.oliva}" stroke-width="2" fill="none" ${s.dash?'stroke-dasharray="6 4"':''}/>`;
    s.values.forEach((v,k)=>{if(v==null)return;const label=`${labels[k]} · ${s.name}: ${num(v)}${extra[k]?' · '+extra[k]:''}`; const attrs=tip(label);
      const marker=seriesMarker(s);
      body+=marker==='▲'?`<path d="M${x(k)} ${y(v)-4}l4 7h-8z" fill="${s.color||C.terra}" ${attrs}/>`:marker==='■'?`<rect x="${x(k)-3}" y="${y(v)-3}" width="6" height="6" fill="${s.color||C.petroleo}" ${attrs}/>`:`<circle cx="${x(k)}" cy="${y(v)}" r="3" fill="${marker==='○'?'var(--branco)':s.color||C.oliva}" stroke="${s.color||C.oliva}" ${attrs}/>`;
    });
    const k=s.values.findLastIndex(v=>v!=null&&Number.isFinite(v));
    if(k>=0)annotations.push({s,k,desired:y(s.values[k])-10});
  });
  let last=t-16;
  annotations.sort((a,b)=>a.desired-b.desired).forEach(a=>{a.labelY=Math.max(t+12,a.desired,last+18);last=a.labelY;});
  const overflow=Math.max(0,last-(h-b-8));
  for(const a of annotations){
    const label=seriesMarker(a.s)+' '+a.s.name,labelY=a.labelY-overflow,labelX=w-r-6;
    const width=Math.min(iw,label.length*7+12);
    body+=`<path d="M${x(a.k)} ${y(a.s.values[a.k])}L${labelX} ${labelY}" stroke="${a.s.color||C.oliva}" fill="none"/><rect x="${labelX-width}" y="${labelY-12}" width="${width}" height="16" fill="var(--branco)" fill-opacity=".9"/>`+text(labelX,labelY,label,'text-anchor="end"');
  }
  labels.forEach((s,k)=>{if(k%Math.max(1,Math.ceil(labels.length/7))===0)body+=text(x(k),h-12,s,`text-anchor="${k===0?'start':k===labels.length-1?'end':'middle'}"`);if(rupture[k])body+=`<path d="M${x(k)} ${h-b+2}l5 9h-10z" fill="${C.crit}" ${tip(s+' · ruptura')}/>`;
    if(sync)body+=`<rect x="${x(k)-iw/Math.max(labels.length,1)/2}" y="${t}" width="${iw/Math.max(labels.length,1)}" height="${ih}" fill="transparent" data-sync="${sync}" data-index="${k}" ${tip(s+' · '+series.map(s=>s.name+': '+num(s.values[k])).join(' · '))}/>`;
  });
  const legend=series.map(s=>`<span><i style="border-color:${s.color||C.oliva};border-style:${s.dash?'dashed':'solid'}"></i>${seriesMarker(s)} ${esc(s.name)}</span>`).join('');
  return `<div class="legend">${bars?'<span>▥ Real</span>':''}${legend}${warming.some(Boolean)?'<span>▧ aquecimento do modelo</span>':''}${rupture.some(Boolean)?'<span>▲ ruptura</span>':''}</div>${!zero?'<p class="axis-note">eixo vertical não começa em zero</p>':''}${svg(w,h,body,series.map(s=>s.name).join(' × '))}`;
}
export function bars(rows,{max=null,meta=null,diverging=false,format=v=>num(v),click=false}={}) {
  if(!rows.length)return '';
  const w=720,left=225,right=120,step=38,h=rows.length*step+42,range=w-left-right;
  max=max??Math.max(1,...rows.map(r=>Math.abs(r.value??0)),meta??0);
  const signed=diverging||rows.some(r=>r.value<0);
  const x=v=>signed?left+range/2+(v/max)*range/2:left+v/max*range;
  let body=`<path d="M${x(0)} 10V${h-25}" stroke="${C.cinza}"/>`;
  if(meta!=null)body+=`<path d="M${x(meta)} 8V${h-25}" stroke="${C.tinta}" stroke-dasharray="4 3"/>`+text(x(meta),h-7,'meta '+format(meta),'text-anchor="middle"');
  rows.forEach((r,k)=>{const y=15+k*step,attrs=tip(r.label+': '+format(r.value)+(r.detail?' · '+r.detail:''));
    body+=`<g ${click&&r.id?`data-fam="${esc(r.id)}" role="button" aria-label="Filtrar ${esc(r.label)}"`:''} ${attrs}>${text(left-10,y+17,r.label.length>29?r.label.slice(0,27)+'…':r.label,'text-anchor="end"')}
      <rect x="${Math.min(x(0),x(r.value??0))}" y="${y}" width="${Math.max(0,Math.abs(x(r.value??0)-x(0)))}" height="24" fill="${r.color||C.oliva}" ${r.highlight?'stroke="var(--tinta)" stroke-width="2"':''}/>${text(Math.max(x(0),x(r.value??0))+7,y+17,format(r.value))}</g>`;
  });
  return svg(w,h,body,'Barras ancoradas em zero');
}
export function bullet(value,min,max,{status=true}={}) {
  const end=Math.max(value??0,max??min??0,1)*1.2,xx=v=>12+v/end*196;
  return svg(220,42,`<rect x="12" y="17" width="196" height="10" fill="${C.claro}"/>${min!=null&&max!=null?`<rect x="${xx(min)}" y="13" width="${xx(max)-xx(min)}" height="18" fill="${C.salvia}"/>`:''}<rect x="12" y="19" width="${Math.max(0,xx(value??0)-12)}" height="6" fill="${status?C.oliva:C.crit}"/><path d="M${xx(min??max)} 10V33" stroke="${C.tinta}" stroke-width="2"/>`, 'Valor '+num(value)+'; meta '+num(min??max));
}
export function dumbbell(rows,intermediate,final,selected) {
  const w=720,left=245,iw=400,h=rows.length*34+44,x=v=>left+v/100*iw;
  let body=[intermediate,final].map(v=>`<path d="M${x(v)} 12V${h-30}" stroke="${C.tinta}" stroke-dasharray="4 3"/>`+text(x(v),h-8,'meta '+num(v,0)+'%','text-anchor="middle"')).join('');
  rows.forEach((r,k)=>{const y=k*34+20;body+=`<g ${tip(r.label+' · anterior '+num(r.previous)+'% · atual '+num(r.value)+'%')} ${selected===r.id?'class="selected"':''}>${text(left-12,y+4,r.label.slice(0,31),'text-anchor="end"')}<path d="M${x(r.previous??0)} ${y}H${x(r.value??0)}" stroke="${C.cinza}"/><circle cx="${x(r.previous??0)}" cy="${y}" r="5" fill="${C.salvia}"/><circle cx="${x(r.value??0)}" cy="${y}" r="5" fill="${C.oliva}" ${selected===r.id?'stroke="var(--tinta)" stroke-width="3"':''}/>${text(x(r.value??0)+8,y-7,num(r.value)+'%')}</g>`;});
  return '<p class="legend">● Atual (oliva) · ● Anterior (sálvia)</p>'+svg(w,h,body,'OTIF anterior e atual por fornecedor');
}
export function scatter(rows,{xLabel,yLabel,size=true,diagonal=true}={}) {
  const w=720,h=300,l=65,r=35,t=25,b=52,xx=Math.max(1,...rows.map(r=>r.x))*1.15,yy=Math.max(1,...rows.map(r=>r.y))*1.15,upper=diagonal?Math.max(xx,yy):null;
  const x=v=>l+v/(upper||xx)*(w-l-r),y=v=>h-b-v/(upper||yy)*(h-t-b);
  let body=`<path d="M${l} ${t}V${h-b}H${w-r}" stroke="${C.cinza}" fill="none"/>`;
  for(let j=0;j<=4;j++){body+=text(x((upper||xx)*j/4),h-b+20,num((upper||xx)*j/4),'text-anchor="middle"')+text(l-8,y((upper||yy)*j/4)+4,num((upper||yy)*j/4),'text-anchor="end"');}
  if(diagonal)body+=`<path d="M${x(0)} ${y(0)}L${x(upper)} ${y(upper)}" stroke="${C.cinza}" stroke-dasharray="5 4"/>`;
  rows.forEach(r=>{const radius=size?Math.max(4,Math.sqrt(r.n||1)):5;body+=`<circle cx="${x(r.x)}" cy="${y(r.y)}" r="${radius}" fill="${C.oliva}" fill-opacity=".7" stroke="${r.highlight?C.tinta:C.oliva}" stroke-width="${r.highlight?3:1}" ${tip(r.label+' · '+xLabel+': '+num(r.x)+' · '+yLabel+': '+num(r.y)+' · n='+r.n+' · atraso '+num(r.y-r.x)+' dias')}/>`;});
  const far=[...rows].sort((a,b)=>(b.y-b.x)-(a.y-a.x))[0];if(far)body+=text(Math.min(w-220,x(far.x)+10),Math.max(15,y(far.y)-12),far.label.slice(0,32));
  body+=text((w+l)/2,h-5,xLabel,'text-anchor="middle"')+text(l,t-9,yLabel);
  return svg(w,h,body,xLabel+' × '+yLabel);
}
export function slope(rows,selected,unit) {
  const w=860,h=400,l=295,r=565,t=40,b=365;
  const vals=rows.flatMap(r=>[r.previous,r.value]).filter(v=>v!=null),lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||1,y=v=>b-(v-lo)/span*(b-t);
  const labels=side=>{let last=-Infinity;return [...rows].sort((a,b)=>y(a[side])-y(b[side])).map(r=>{const desired=y(r[side]),v=Math.max(desired,last+16);last=v;return {id:r.id,pos:v};});};
  const before=labels('previous'),after=labels('value'),end=Math.max(h,...before.concat(after).map(p=>p.pos+25));
  let body=text(l,20,'Anterior','text-anchor="middle"')+text(r,20,'Atual','text-anchor="middle"');
  rows.forEach(row=>{const color=row.id==='TOTAL'?C.cinza:row.id===selected?C.oliva:C.salvia,ly=before.find(v=>v.id===row.id).pos,ry=after.find(v=>v.id===row.id).pos;
    body+=`<g ${tip(row.label+' · '+num(row.previous)+' → '+num(row.value)+' '+unit+' · '+(row.trend||''))}><path d="M${l} ${y(row.previous)}L${r} ${y(row.value)}" stroke="${color}" stroke-width="${row.id==='TOTAL'?3:2}" ${row.id==='TOTAL'?'stroke-dasharray="6 4"':''}/><circle cx="${l}" cy="${y(row.previous)}" r="3" fill="${color}"/><circle cx="${r}" cy="${y(row.value)}" r="3" fill="${color}"/><path d="M${l-5} ${y(row.previous)}L${l-12} ${ly}" stroke="${color}"/><path d="M${r+5} ${y(row.value)}L${r+12} ${ry}" stroke="${color}"/>${text(l-15,ly+4,row.label+' '+num(row.previous),'text-anchor="end"')}${text(r+15,ry+4,num(row.value)+' '+row.label+(row.trend==='piora'?' · piora':''),row.trend==='piora'?'fill="var(--crit)"':'')}</g>`;
  });return '<p class="axis-note">eixos verticais não começam em zero</p>'+svg(w,end,body,'Inclinação entre as duas janelas; rótulos separados');
}
export function rain(rows,sync) {
  const w=720,h=210,l=62,r=24,t=24,b=40,iw=w-l-r,max=Math.max(1,...rows.map(r=>r.chuva_mm)),x=k=>l+k*iw/Math.max(1,rows.length),bw=iw/Math.max(1,rows.length);
  let body='';rows.forEach((r,k)=>{const bh=r.chuva_mm/max*(h-t-b),color=r.cenario==='CHUVOSO'?C.petroleo:r.cenario==='SECO'?C.terra:C.borda;
    body+=`<rect x="${x(k)+1}" y="${h-b-bh}" width="${Math.max(1,bw-2)}" height="${bh}" fill="${r.semana_completa?color:'none'}" stroke="${color}"/><rect x="${x(k)}" y="${t}" width="${bw}" height="${h-t-b}" fill="transparent" ${tip(date(r.semana_inicio)+': '+num(r.chuva_mm)+' mm · '+r.cenario+' · '+r.n_dias+' dias'+(!r.semana_completa?' · semana parcial':''))} data-sync="${sync}" data-index="${k}"/>`;
    if(k%Math.max(1,Math.ceil(rows.length/7))===0)body+=text(x(k)+bw/2,h-12,date(r.semana_inicio),'text-anchor="middle"');});
  body+=text(8,18,'Chuva (mm)')+text(8,42,num(max))+`<path d="M${l} ${h-b}H${w-r}" stroke="${C.cinza}"/>`;
  return '<p class="legend">■ chuvoso (petróleo) · ■ seco (terra) · ■ normal (cinza) · □ parcial</p>'+svg(w,h,body,'Chuva semanal com semanas parciais vazadas');
}
export function stacked(rows,meta) {
  const w=850,left=235,iw=320,pctLeft=665,pctWidth=95,h=rows.length*43+78,maxItems=Math.max(1,...rows.map(r=>r.itens));
  let body=text(left,16,'Itens (quantidade)')+text(pctLeft,16,'Críticos (%)')+`<path d="M${pctLeft+pctWidth*meta/100} 25V${h-30}" stroke="${C.tinta}" stroke-dasharray="4 3"/>`+text(pctLeft,h-8,'meta críticos '+num(meta,0)+'%');
  rows.forEach((r,k)=>{let x=left;const y=k*43+32;body+=`<g data-fam="${esc(r.familia)}" role="button" ${r.highlight?'class="selected" data-selected="true"':''} ${tip(r.label+' · '+r.itens+' itens · '+r.itens_criticos+' críticos · '+r.itens_atencao+' atenção · '+r.itens_sem_risco+' sem risco')}>${text(left-10,y+15,(r.highlight?'● ':'')+r.label.slice(0,29),'text-anchor="end"')}`;
    for(const [field,color] of [['itens_criticos',C.crit],['itens_atencao',C.aten],['itens_sem_risco',C.claro]]){const width=r[field]/maxItems*iw;body+=`<rect x="${x}" y="${y}" width="${width}" height="23" fill="${color}" stroke="${field==='itens_sem_risco'?C.oliva:color}"/>`;x+=width;}
    body+=text(x+8,y+15,r.itens+' itens')+`<circle cx="${pctLeft+pctWidth*r.criticos_pct/100}" cy="${y+11}" r="4" fill="${r.criticos_pct>meta?C.crit:C.oliva}"/>`+text(pctLeft+pctWidth+8,y+15,num(r.criticos_pct)+'% ◆')+'</g>';});
  return '<p class="legend">◆ crítico · ▲ atenção · ● sem risco. Barras: total de itens; coluna à direita: percentual crítico e meta.</p>'+svg(w,h,body,'Quantidade de itens e composição do risco por família; percentual crítico em escala separada');
}
export function coverage(rows,min,max) {
  const maxCapital=Math.max(1,...rows.map(r=>r.capital_imobilizado)),w=850,left=235,range=320,covLeft=620,covRange=130,covMax=Math.max(max*1.5,...rows.map(r=>r.cobertura_dias||0)),h=rows.length*45+40;
  let body=text(left,16,'Capital (R$ mil)')+text(covLeft,16,'Cobertura (dias)');
  rows.forEach((r,k)=>{const y=32+k*45,cp=r.cobertura_dias,ok=cp>=min&&cp<=max,x=covLeft+(cp??0)/covMax*covRange;
    body+=`<g ${r.highlight?'class="selected" data-selected="true"':''} ${tip(r.label+' · capital '+num(r.capital_imobilizado)+' R$ · cobertura '+num(cp)+' dias · '+(ok?'na faixa':cp<min?'abaixo':'acima'))}>${text(left-10,y+16,(r.highlight?'● ':'')+r.label.slice(0,28),'text-anchor="end"')}<rect x="${left}" y="${y}" width="${r.capital_imobilizado/maxCapital*range}" height="22" fill="${C.oliva}" ${r.highlight?'stroke="var(--tinta)" stroke-width="2"':''}/>${text(left+r.capital_imobilizado/maxCapital*range+5,y+16,num(r.capital_imobilizado/1000,0))}<rect x="${covLeft}" y="${y+4}" width="${covRange}" height="12" fill="var(--fundo)"/><rect x="${covLeft+min/covMax*covRange}" y="${y+4}" width="${(max-min)/covMax*covRange}" height="12" fill="${C.claro}"/><path d="M${x} ${y+2}l6 8-6 8-6-8z" fill="${ok?C.oliva:C.aten}"/>${text(covLeft+covRange+8,y+16,num(cp)+(ok?'':cp<min?' ↓':' ↑'))}</g>`;
  });return svg(w,h,body,'Capital ancorado em zero e cobertura em mini-escala separada');
}
