"use strict";
/* ============================================================ dados */
const D = DADOS;
const WK = D.meta.semanas.map(s => new Date(s + 'T12:00:00'));
const NW = WK.length, R = D.meta.R;
const REFDATE = new Date(D.meta.ref + 'T12:00:00');
const CL0 = new Date(D.clima.ini + 'T12:00:00');
const FAM = Object.fromEntries(D.familias.map(f => [f.id, f]));
const FOR = Object.fromEntries(D.fornecedores.map(f => [f.id, f]));
const ITENS = D.itens;
const ULT = 13;                         // janela dos parâmetros de política (semanas)
const MET = ['Média móvel (4 sem.)', 'Suavização exponencial', 'Croston/SBA'];
const MCOR = ['#5E6B66', '#47682C', '#080F0F'], MDASH = ['2 4', '', '7 4'];

/* ============================================================ utilidades */
const nf0 = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0});
const nf1 = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const nf2 = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const brl = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0});
const brlK = v => v >= 1e6 ? 'R$ ' + nf2.format(v / 1e6) + ' mi' : v >= 1e3 ? 'R$ ' + nf0.format(v / 1e3) + ' mil' : brl.format(v);
const pc = v => nf1.format(v) + '%';
const dm = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
const dmy = d => dm(d) + '/' + d.getFullYear();
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const sum = a => a.reduce((s, v) => s + v, 0);
const std = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a.map(v => (v - m) ** 2)) / (a.length - 1)); };
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const dayIdx = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12) - CL0) / 864e5);
function zInv(p) {                      // quantil da normal (Acklam)
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
let tToast;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(tToast); tToast = setTimeout(() => e.classList.remove('on'), 2600); }
const lsGet = (k, v) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : v; } catch (e) { return v; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* ============================================================ pré-cálculo (estático por item) */
const laMedia = mean(D.la.slice(-ULT));
for (const it of ITENS) {
  const f = FOR[it.forn], u = it.r.slice(-ULT);
  it.d = mean(u) / 7;                              // demanda média diária
  it.sdd = std(u) / Math.sqrt(7);                  // desvio diário (exato sob independência)
  it.Lf = mean(f.lt.slice(-ULT)); it.La = laMedia; it.L = it.Lf + it.La;
  it.sL = Math.sqrt(f.sd ** 2 + 1.2 ** 2);
  it.lote = Math.max(3, Math.ceil(30 * it.d));
  it.mi = it.metodo === 'SBA' ? 2 : 1;             // índice do método em uso
  it.pos = it.saldo + (it.tr ? it.tr.q : 0);
  const df = Math.max(it.fn / 7, 1e-6); it.df = df;
  it.cob = it.saldo / df;
  let inv = it.saldo, rd = it.saldo === 0 ? 0 : null;
  for (let t = 1; rd === null && t <= 120; t++) { inv -= df; if (it.tr && t === it.tr.eta) inv += it.tr.q; if (inv < 0) { rd = t; break; } }
  it.rd = rd;
  it.nrup = [...it.rup].filter(c => c === '1').length;
}
const clWeek = k => {                                  // resumo semanal do clima (seg–dom)
  const i0 = dayIdx(WK[k]); let mm = 0, dc = 0, t = 0;
  for (let i = i0; i < i0 + 7; i++) { mm += D.clima.mm[i]; dc += D.clima.ch[i]; t += D.clima.t[i]; }
  return {mm, dc, dsc: D.clima.dsc[i0 + 6], t: t / 7, cen: D.meta.cen[k]};
};
function calcular(nivel) {
  const z = zInv(nivel);
  for (const it of ITENS) {
    it.SS = z * Math.sqrt((R + it.L) * it.sdd ** 2 + it.d ** 2 * it.sL ** 2);
    it.PP = it.d * (R + it.L) + it.SS;
    const crit = it.rd !== null && it.rd <= it.L;
    it.risco = crit ? 'crit' : (it.pos <= it.PP ? 'aten' : 'ok');
    if (it.risco !== 'ok') {
      it.qtd = it.lote * Math.max(1, Math.ceil((it.PP - it.pos + 1) / it.lote));
      it.valor = it.qtd * it.custo;
    } else { it.qtd = 0; it.valor = 0; }
  }
  return z;
}

/* ============================================================ estado */
const S = {fam: '', item: '', forn: '', inicio: '2026-07-20', fim: '2026-10-18', safra: '', pad: '', abc: '', risco: '', nivel: 95, z: 1.645,
           perfil: 'analista', met: 'un', tab: 'forn', ord: {k: 'risco', dir: 1}, mostrar: 12, cl: 'hoje', mapa: false};
let LOG = lsGet('alcar-proto-v1-log', []);

function semanas() {
  let idx = [...Array(NW).keys()].filter(k => WK[k] <= new Date(S.fim + 'T23:59:59') && addDays(WK[k], 6) >= new Date(S.inicio + 'T00:00:00'));
  if (S.safra) idx = idx.filter(k => { const m = WK[k].getMonth() + 1, sf = m >= 4 && m <= 11; return S.safra === 'safra' ? sf : !sf; });
  return idx;
}
function filtrados(ignRisco, ignForn, ignFam) {
  return ITENS.filter(it => (ignFam || !S.fam || it.fam === S.fam) && (ignForn || !S.forn || it.forn === S.forn) &&
    (!S.pad || it.padrao === S.pad) && (!S.abc || it.abc === S.abc) && (!S.item || it.id === +S.item) &&
    (ignRisco || !S.risco || it.risco === S.risco));
}
const ultimoStatus = id => { for (let i = LOG.length - 1; i >= 0; i--) if (LOG[i].id === id) return LOG[i].acao; return null; };
const fornCurto = f => f.pf ? (S.perfil === 'analista' ? 'Fornecedor PF (protegido)' : 'Usinagem autônoma (PF)') : f.nome.split(' ').slice(0, 2).join(' ');
const nomeForn = f => (f.pf && S.perfil === 'analista') ? 'Fornecedor pessoa física (nome protegido)' : f.nome;

/* ============================================================ gráfico de linhas genérico */
function nice(max) { if (max <= 0) return 1; const e = 10 ** Math.floor(Math.log10(max)), f = max / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
function lineChart(host, cfg) {
  const W = Math.max(280, host.clientWidth || 600), H = cfg.height || 280, m = {l: 48, r: cfg.rpad || 14, t: 12, b: 30};
  const n = cfg.labels.length, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const vals = cfg.series.flatMap(s => s.values.filter(v => v !== null && !isNaN(v)));
  const hi0 = Math.max(...vals, cfg.yminmax || 0.0001), lo0 = Math.min(...vals, cfg.yminmax == null ? Infinity : cfg.yminmax);
  let ylo = 0, ymax = nice(hi0 * 1.06), yn = 4, ystep = ymax / 4;
  if (lo0 > .55 * hi0) { const pad = (hi0 - lo0) * .4 || hi0 * .05; ystep = nice((hi0 - lo0 + 2 * pad) / 4); ylo = Math.max(0, Math.floor((lo0 - pad) / ystep) * ystep); yn = Math.max(2, Math.ceil((hi0 + pad - ylo) / ystep)); ymax = ylo + ystep * yn; }
  const X = i => m.l + (n === 1 ? pw / 2 : pw * i / (n - 1)), Y = v => m.t + ph - ph * (v - ylo) / (ymax - ylo);
  const stp = n > 1 ? pw / (n - 1) : pw;
  let g = '';
  for (let t = 0; t <= yn; t++) { const v = ylo + ystep * t, y = Y(v); g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="#D5DAD7" stroke-width="${t ? .8 : 1.4}"/><text x="${m.l - 7}" y="${y + 4}" text-anchor="end" font-size="11.5" fill="#5E6B66">${cfg.yFmt(v)}</text>`; }
  if (cfg.shade) cfg.shade.forEach((on, i) => { if (on) g += `<rect x="${X(i) - stp / 2}" y="${m.t}" width="${stp}" height="${ph}" fill="#E7EEDD"/>`; });
  const every = Math.ceil(n / Math.max(3, Math.floor(pw / 62)));
  cfg.labels.forEach((l, i) => { if (i % every === 0) g += `<text x="${X(i)}" y="${H - 9}" text-anchor="middle" font-size="11.5" fill="#5E6B66">${l}</text>`; });
  if (cfg.divisor != null) g += `<line x1="${X(cfg.divisor)}" x2="${X(cfg.divisor)}" y1="${m.t}" y2="${m.t + ph}" stroke="#5E6B66" stroke-dasharray="3 4"/><text x="${X(cfg.divisor) + 5}" y="${m.t + 11}" font-size="11" fill="#5E6B66">${cfg.divRot || ''}</text>`;
  if (ylo > 0) g += `<text x="${m.l}" y="${m.t - 2}" font-size="10.5" fill="#5E6B66">eixo vertical não começa em zero</text>`;
  const rotulos = [];
  for (const s of cfg.series) {
    let d = '', pen = false;
    s.values.forEach((v, i) => { if (v === null || isNaN(v)) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2.2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round" opacity="${s.op || 1}"/>`;
    if (cfg.direct) { let li = s.values.length - 1; while (li > 0 && s.values[li] === null) li--; if (s.values[li] != null) rotulos.push({x: X(li) + 6, y: Y(s.values[li]) + 4, t: s.short || s.name}); }
  }
  rotulos.sort((a, b) => a.y - b.y); for (let i = 1; i < rotulos.length; i++) if (rotulos[i].y - rotulos[i - 1].y < 14) rotulos[i].y = rotulos[i - 1].y + 14;
  rotulos.forEach(r => g += `<text x="${r.x}" y="${r.y}" font-size="11.5" font-weight="600" fill="#46524D">${r.t}</text>`);
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.aria || '')}">${g}<line class="cx" y1="${m.t}" y2="${m.t + ph}" stroke="#080F0F" stroke-width="1" visibility="hidden"/><g class="dots"></g><rect class="hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/></svg><div class="tip" hidden></div><div class="tabela" hidden></div>`;
  const tb = `<table><thead><tr><th>${esc(cfg.xName || 'Semana')}</th>${cfg.series.map(s => `<th class="r">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${cfg.labels.map((l, i) => `<tr><td>${cfg.tabLabels ? cfg.tabLabels[i] : l}</td>${cfg.series.map(s => `<td class="r num">${s.values[i] == null ? '–' : cfg.yFmt(s.values[i], true)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('.tabela', host).innerHTML = tb;
  const svg = $('svg', host), hit = $('.hit', svg), cx = $('.cx', svg), dots = $('.dots', svg), tip = $('.tip', host);
  const mover = ev => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
    const i = Math.max(0, Math.min(n - 1, Math.round((px - m.l) / (stp || 1))));
    cx.setAttribute('x1', X(i)); cx.setAttribute('x2', X(i)); cx.setAttribute('visibility', 'visible');
    dots.innerHTML = cfg.series.map(s => s.values[i] == null ? '' : `<circle cx="${X(i)}" cy="${Y(s.values[i])}" r="4.5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`).join('');
    tip.innerHTML = `<b>${cfg.tipTitle ? cfg.tipTitle(i) : cfg.labels[i]}</b>` + cfg.series.map(s => s.values[i] == null ? '' : `<div class="lin"><span><i style="border-color:${s.color};${s.dash ? 'border-top-style:dashed' : ''}"></i>${s.name}</span><span class="num">${cfg.yFmt(s.values[i], true)}</span></div>`).join('') + (cfg.tipExtra ? cfg.tipExtra(i) : '');
    tip.hidden = false;
    const tw = tip.offsetWidth, xx = X(i) * r.width / W;
    tip.style.left = Math.max(0, Math.min(r.width - tw, xx + 14 > r.width - tw ? xx - tw - 14 : xx + 14)) + 'px'; tip.style.top = '10px';
  };
  hit.addEventListener('pointermove', mover); hit.addEventListener('pointerdown', mover);
  hit.addEventListener('pointerleave', () => { cx.setAttribute('visibility', 'hidden'); dots.innerHTML = ''; tip.hidden = true; });
}
function legenda(el, itens) {
  el.innerHTML = itens.map(s => s.faixa ? `<span><svg width="18" height="12"><rect width="18" height="12" rx="2" fill="${s.color}" stroke="#cddbbb"/></svg>${s.name}</span>`
    : `<span><svg width="26" height="10"><line x1="1" x2="25" y1="5" y2="5" stroke="${s.color}" stroke-width="${s.w || 2.4}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linecap="round"/></svg>${s.name}</span>`).join('');
}
function spark(arr, w = 150, h = 30, cor = '#47682C') {
  const ok = arr.filter(v => v != null); if (ok.length < 2) return '';
  const mn = Math.min(...ok), mx = Math.max(...ok), rg = mx - mn || 1;
  const pts = arr.map((v, i) => v == null ? null : [i * (w - 4) / (arr.length - 1) + 2, h - 3 - (h - 6) * (v - mn) / rg]).filter(Boolean);
  const l = pts[pts.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('')}" fill="none" stroke="${cor}" stroke-width="1.8"/><circle cx="${l[0]}" cy="${l[1]}" r="3" fill="${cor}" stroke="#fff" stroke-width="1.5"/></svg>`;
}
const ico = r => r === 'crit' ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#B3261E"/><rect x="7.1" y="3.6" width="1.8" height="5.6" rx=".9" fill="#fff"/><circle cx="8" cy="11.6" r="1.1" fill="#fff"/></svg>'
  : r === 'aten' ? '<svg width="17" height="16" viewBox="0 0 17 16" aria-hidden="true"><path d="M8.5 0.8 16.6 15H.4z" fill="#C98A00"/><rect x="7.6" y="5.6" width="1.8" height="5" rx=".9" fill="#fff"/><circle cx="8.5" cy="12.6" r="1" fill="#fff"/></svg>'
  : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#47682C"/><path d="M4.4 8.3l2.5 2.5 4.8-5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const rdTxt = it => it.rd == null ? '&gt; 120 dias' : it.rd === 0 ? 'já em falta' : it.rd + (it.rd === 1 ? ' dia' : ' dias');
const RNOME = {crit: 'Crítico', aten: 'Atenção', ok: 'Sem risco'};
const stl = r => `<span class="st">${ico(r)}${RNOME[r]}</span>`;

/* ============================================================ blocos */
function pesoSem(it, k, rs) { return rs ? it.custo : 1; }
function serieSemanal(F, k0s, rs) {
  return k0s.map(k => ({r: sum(F.map(it => it.r[k] * (rs ? it.custo : 1))), p: sum(F.map(it => it.p[k] * (rs ? it.custo : 1)))}));
}
function taxaRup(F, idx) { if (!F.length || !idx.length) return null; let c = 0; for (const it of F) for (const k of idx) if (it.rup[k] === '1') c++; return 100 * c / (F.length * idx.length); }
function wape(F, idx, mi) { let e = 0, r = 0; for (const it of F) for (const k of idx) { e += it.e[mi == null ? it.mi : mi][k]; r += it.r[k]; } return r ? 100 * e / r : null; }
function periodoAnterior(idx) { if (!idx.length) return null; const n = idx.length, p = idx.map(k => k - n); return p.every(k => k >= 0) ? p : null; }
function delta(v, ant, menorMelhor, unid, casas = 1) {
  if (v == null || ant == null) return '<span class="delta neutro">sem período anterior</span>';
  const d = v - ant, ab = Math.abs(d);
  if (ab < 0.05) return '<span class="delta neutro">■ estável vs. período anterior</span>';
  const bom = menorMelhor ? d < 0 : d > 0;
  return `<span class="delta ${bom ? 'melhor' : 'pior'}">${d > 0 ? '▲' : '▼'} ${nf1.format(ab)} ${unid} (${bom ? 'melhor' : 'pior'}) vs. período anterior</span>`;
}
function kpiAjuda(id, titulo, significado, formula) {
  return `<div class="rot kpi-titulo"><span>${titulo}</span><span class="kpi-ajuda"><button class="kpi-info" type="button" aria-label="Como é calculado: ${titulo}" aria-expanded="false" aria-controls="kpi-tip-${id}" aria-describedby="kpi-tip-${id}">i</button><span class="kpi-tooltip" id="kpi-tip-${id}" role="tooltip" hidden><strong>${titulo}</strong><span>${significado}</span><b>Cálculo no protótipo</b><span>${formula}</span></span></span></div>`;
}
function prepararAjudaKPIs() {
  const host = $('#kpis');
  let aberta = null, fixa = false, sair;
  const fechar = () => {
    clearTimeout(sair);
    if (aberta) { $('.kpi-info', aberta).setAttribute('aria-expanded', 'false'); $('.kpi-tooltip', aberta).hidden = true; }
    aberta = null; fixa = false;
  };
  const abrir = ajuda => {
    clearTimeout(sair);
    if (aberta !== ajuda) { fechar(); aberta = ajuda; }
    const botao = $('.kpi-info', ajuda), tip = $('.kpi-tooltip', ajuda), r = botao.getBoundingClientRect();
    tip.hidden = false; botao.setAttribute('aria-expanded', 'true');
    tip.style.left = Math.max(12, Math.min(r.right - tip.offsetWidth, innerWidth - tip.offsetWidth - 12)) + 'px';
    tip.style.top = Math.max(12, r.bottom + tip.offsetHeight + 8 <= innerHeight ? r.bottom + 4 : r.top - tip.offsetHeight - 4) + 'px';
  };
  host.addEventListener('pointerover', e => { const ajuda = e.target.closest('.kpi-ajuda'); if (ajuda && !ajuda.contains(e.relatedTarget)) abrir(ajuda); });
  host.addEventListener('pointerout', e => { if (aberta && !aberta.contains(e.relatedTarget) && !fixa && !aberta.contains(document.activeElement)) sair = setTimeout(fechar, 160); });
  host.addEventListener('focusin', e => { const ajuda = e.target.closest('.kpi-ajuda'); if (ajuda) abrir(ajuda); });
  host.addEventListener('focusout', e => { if (aberta && !aberta.contains(e.relatedTarget)) fechar(); });
  host.addEventListener('click', e => { const ajuda = e.target.closest('.kpi-ajuda'); if (e.target.closest('.kpi-info')) { if (aberta === ajuda && fixa) fechar(); else { abrir(ajuda); fixa = true; } } });
  document.addEventListener('click', e => { if (aberta && !aberta.contains(e.target)) fechar(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && aberta) { fechar(); e.preventDefault(); } });
  window.addEventListener('scroll', e => {
    if (!aberta || e.target.closest?.('.kpi-tooltip')) return;
    const r = $('.kpi-info', aberta).getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) fechar(); else abrir(aberta);
  }, true);
}
function renderKPIs(F, idx) {
  const el = $('#kpis');
  if (!F.length) { el.innerHTML = '<div class="kpi" style="grid-column:1/-1"><div class="rot">Sem itens</div><div class="det">Nenhum item atende aos filtros. Use “Limpar filtros”.</div></div>'; return; }
  const nc = F.filter(i => i.risco === 'crit').length, na = F.filter(i => i.risco === 'aten').length;
  const prev = periodoAnterior(idx);
  const rup = taxaRup(F, idx), rupA = prev ? taxaRup(F, prev) : null;
  const ac = idx.length ? 100 - wape(F, idx) : null, acA = prev ? 100 - wape(F, prev) : null;
  const val = sum(F.map(i => i.saldo * i.custo)), cons = sum(F.map(i => i.df * i.custo));
  const cob = cons ? val / cons : 0;
  const w8 = F.map(i => FOR[i.forn]); const lt8 = mean(F.map(i => mean(FOR[i.forn].lt.slice(-8)))), prom = mean(F.map(i => FOR[i.forn].prom));
  const comp = F.filter(i => i.risco !== 'ok' && !['aceita', 'aprovada', 'recusada'].includes(ultimoStatus(i.id)));
  const sRup = [...Array(NW).keys()].map(k => taxaRup(F, [k])), sRupS = sRup.map((_, i) => i < 3 ? null : mean(sRup.slice(i - 3, i + 1)));
  const sAc = [...Array(NW).keys()].map(k => 100 - wape(F, [k])), sAcS = sAc.map((_, i) => i < 3 ? null : mean(sAc.slice(i - 3, i + 1)));
  const sLt = [...Array(NW).keys()].map(k => mean(F.map(i => FOR[i.forn].lt[k])));
  el.innerHTML = `
  <div class="kpi">${kpiAjuda('criticos', 'Itens em risco crítico', 'Quantidade de itens cuja falta é prevista antes ou no prazo total de reposição. Considera saldo, consumo previsto e chegada do estoque em trânsito.', 'Conta os itens com dia de ruptura ≤ L. L = prazo médio do fornecedor + aprovação interna, ambos nas últimas 13 semanas. A projeção desconta máx(previsão semanal ÷ 7; 0,000001) por dia e soma o trânsito no dia de chegada; saldo zero já conta como falta. Horizonte: 120 dias.')}<div class="val num">${nf0.format(nc)}<small>de ${nf0.format(F.length)}</small></div>
    <div class="det">${nf0.format(na)} em atenção · ${nf0.format(F.length - nc - na)} sem risco</div>
    <div class="det">${ico('crit')} ruptura prevista dentro do prazo de reposição</div></div>
  <div class="kpi">${kpiAjuda('ruptura', 'Taxa de ruptura', 'Percentual das combinações de item e semana que registraram falta no período selecionado.', '100 × item-semanas com registro de falta ÷ (nº de itens × nº de semanas selecionadas). Cada item e semana tem o mesmo peso; sem semanas, exibe “–”.')}<div class="val num">${rup == null ? '–' : pc(rup)}</div>
    <div class="det">item-semanas com falta, no período</div>${delta(rup, rupA, true, 'p.p.')}${spark(sRupS)}</div>
  <div class="kpi">${kpiAjuda('acuracia', 'Acurácia da previsão', 'Indica a precisão das previsões pelo complemento do erro absoluto ponderado (WAPE), usando o método ativo de cada item.', '100 − (100 × soma dos erros absolutos ÷ soma do consumo real), para os itens e semanas selecionados. Os erros vêm dos dados simulados. Pode ficar negativa se o erro superar o consumo. Sem semanas, exibe “–”; com consumo real zero, o protótipo exibe 100%.')}<div class="val num">${ac == null ? '–' : pc(ac)}</div>
    <div class="det">1 − WAPE, método em uso por item</div>${delta(ac, acA, false, 'p.p.')}${spark(sAcS)}</div>
  <div class="kpi">${kpiAjuda('cobertura', 'Cobertura do estoque', 'Dias de consumo previsto cobertos pelo saldo atual, ponderados pelo custo dos itens. Não inclui estoque em trânsito.', 'Σ(saldo × custo unitário) ÷ Σ(consumo diário previsto × custo unitário). Consumo diário = máx(previsão semanal ÷ 7; 0,000001). Se o denominador for zero, retorna 0. Usa a posição atual e a previsão cadastrada, sem depender do período selecionado.')}<div class="val num">${nf0.format(cob)}<small>dias</small></div>
    <div class="det">valor parado: ${brlK(val)}</div><div class="det">saldo ÷ consumo previsto, ponderado por valor</div></div>
  <div class="kpi">${kpiAjuda('leadtime', 'Lead time real do fornecedor', 'Prazo médio realizado pelos fornecedores dos itens do recorte, em dias, comparado ao prazo prometido.', 'Para cada item, calcula a média do prazo de seu fornecedor nas últimas 8 semanas; depois calcula a média entre os itens. Um fornecedor aparece uma vez por item, portanto não é uma média de fornecedores distintos. O prometido também é calculado por item. Não inclui aprovação interna e não depende do período selecionado.')}<div class="val num">${nf1.format(lt8)}<small>dias</small></div>
    <div class="det">prometido: ${nf1.format(prom)} dias · últimas 8 semanas</div>
    <span class="delta ${lt8 > prom + .05 ? 'pior' : 'melhor'}">${lt8 > prom + .05 ? '▲' : '▼'} ${nf1.format(Math.abs(lt8 - prom))} dias ${lt8 > prom + .05 ? 'acima' : 'abaixo'} do prometido</span>${spark(sLt, 150, 30, '#5E6B66')}</div>
  <div class="kpi">${kpiAjuda('compras', 'Compras sugeridas', 'Valor das reposições sugeridas para itens críticos ou em atenção que ainda aguardam decisão. Exclui decisões aceitas, aprovadas ou recusadas.', 'Σ(quantidade sugerida × custo unitário). Quantidade = lote × máx(1; teto((PP − posição + 1) ÷ lote)); lote = máx(3; teto(30 × demanda diária)); posição = saldo + trânsito. PP = demanda diária × (revisão + prazo total) + estoque de segurança. O estoque de segurança usa o nível de serviço escolhido.')}<div class="val num">${brlK(sum(comp.map(i => i.valor)))}</div>
    <div class="det">${nf0.format(comp.length)} itens aguardando decisão</div><div class="det">nível de serviço alvo: ${pc(S.nivel)} (z = ${nf2.format(S.z)})</div></div>`;
}

function climaJanela(fim) {                                 // 7 dias terminando em "fim"
  const i1 = dayIdx(fim), i0 = i1 - 6; let mm = 0, dc = 0, t = 0; const dias = [];
  for (let i = i0; i <= i1; i++) { mm += D.clima.mm[i]; dc += D.clima.ch[i]; t += D.clima.t[i]; dias.push(D.clima.mm[i]); }
  const dsc = D.clima.dsc[i1];
  const cen = (mm >= 30 || dc >= 4) ? 'CHUVOSO' : (dsc >= 5 ? 'SECO' : 'NORMAL');
  return {mm, dc, t: t / 7, dsc, cen, dias, fim};
}
const MSG_CL = {
  SECO: 'Colheita e frota agrícola operam sem interrupção, e o consumo de peças de desgaste agrícola pode subir.',
  CHUVOSO: 'A colheita tende a parar, e a hipótese é de mais quebras em equipamentos industriais.',
  NORMAL: 'Sem sinal climático forte; seguir o ponto de pedido.'};
const ICO_CL = {
  SECO: '<svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="7" fill="#47682C"/><g stroke="#47682C" stroke-width="2.4" stroke-linecap="round"><path d="M19 4v5M19 29v5M4 19h5M29 19h5M8.4 8.4l3.5 3.5M26.1 26.1l3.5 3.5M8.4 29.6l3.5-3.5M26.1 11.9l3.5-3.5"/></g></svg>',
  CHUVOSO: '<svg width="42" height="38" viewBox="0 0 42 38" aria-hidden="true"><path d="M11 24a7 7 0 0 1 .8-13.9A9 9 0 0 1 29.400 12 6 6 0 0 1 31 24z" fill="#47682C"/><g stroke="#47682C" stroke-width="2.4" stroke-linecap="round"><path d="M13 29l-2 5M21 29l-2 5M29 29l-2 5"/></g></svg>',
  NORMAL: '<svg width="42" height="38" viewBox="0 0 42 38" aria-hidden="true"><path d="M10 28a7 7 0 0 1 .8-13.9A9 9 0 0 1 28.400 16 6 6 0 0 1 30 28z" fill="none" stroke="#47682C" stroke-width="2.6"/></svg>'};
function renderClima() {
  const sel = $('#sel-clima');
  if (!sel.options.length) {
    sel.innerHTML = '<option value="hoje">Hoje, 22/10</option>' + [...Array(12).keys()].map(j => { const k = NW - 1 - j, f = addDays(WK[k], 6); return `<option value="${k}">Semana até ${dm(f)}</option>`; }).join('');
  }
  const fim = S.cl === 'hoje' ? REFDATE : addDays(WK[+S.cl], 6), c = climaJanela(fim);
  if (S.mapa) { renderMapa(c, fim); return; }
  const dsem = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const mx = Math.max(10, ...c.dias);
  const barras = c.dias.map((v, i) => { const h = Math.max(2, 34 * v / mx); const dd = addDays(fim, i - 6); return `<g><rect x="${6 + i * 22}" y="${40 - h}" width="14" height="${h}" rx="3" fill="#47682C"><title>${dm(dd)}: ${nf1.format(v)} mm</title></rect><text x="${13 + i * 22}" y="52" text-anchor="middle" font-size="10" fill="#46524D">${dsem[(dd.getDay() + 6) % 7]}</text></g>`; }).join('');
  $('#clima-corpo').innerHTML = `
    <div class="estado">${ICO_CL[c.cen]}<span>${c.cen}</span></div>
    <div class="dias num">${nf0.format(c.dsc)} ${c.dsc === 1 ? 'dia' : 'dias'} sem chuva seguidos</div>
    <div class="linha num">chuva nos 7 dias até ${dm(fim)}: <b>${nf1.format(c.mm)} mm</b> em ${c.dc} ${c.dc === 1 ? 'dia' : 'dias'}</div>
    <svg width="160" height="56" viewBox="0 0 160 56" role="img" aria-label="Chuva diária nos últimos 7 dias" style="margin:6px auto 0;display:block">${barras}</svg>
    <div class="msg"><b>Possibilidade:</b> ${MSG_CL[c.cen]}</div>
    <div class="mini"><div><b class="num">${nf1.format(c.t)} °C</b><span>temp. média 7 dias</span></div><div><b class="num">${nf1.format(c.mm)} mm</b><span>chuva 7 dias</span></div><div><b class="num">${c.dc}</b><span>dias com chuva</span></div></div>
    <div class="nota" style="color:var(--cinza-2)">Regras: chuvoso = 30 mm ou mais, ou 4 ou mais dias com chuva (prevalece); seco = 5 ou mais dias seguidos sem chuva. Limites iniciais e ajustáveis. <b>Apoio à leitura, não é previsão.</b></div>`;
}

function renderMain(F, idx) {
  const rs = S.met === 'rs', host = $('#ch-main'); $('#tb-main').textContent = 'Ver tabela';
  if (!idx.length || !F.length) { host.innerHTML = '<div class="vazio">Nenhuma semana no recorte: o período e a safra/entressafra escolhidos não se sobrepõem. Ajuste as datas para incluir semanas com dados.</div>'; $('#leg-main').innerHTML = ''; $('#nt-main').textContent = ''; return; }
  const ser = serieSemanal(F, idx, rs);
  const incUlt = idx[idx.length - 1] === NW - 1;
  const labels = idx.map(k => dm(WK[k])), tabL = idx.map(k => dm(WK[k]) + ' a ' + dm(addDays(WK[k], 6)));
  const real = ser.map(s => s.r), prev = ser.map(s => s.p);
  let proj = idx.map(() => null), hasProj = incUlt && F.length;
  const H = 8;
  if (hasProj) {
    const f = sum(F.map(i => i.fn * (rs ? i.custo : 1)));
    for (let j = 0; j < H; j++) { labels.push(dm(addDays(WK[NW - 1], 7 * (j + 1)))); tabL.push(dm(addDays(WK[NW - 1], 7 * (j + 1))) + ' (projeção)'); real.push(null); prev.push(null); proj.push(f); }
    proj[idx.length - 1] = prev[idx.length - 1];
  }
  const fmt = (v, t) => rs ? (v >= 1000 ? 'R$ ' + nf0.format(v / 1000) + (t ? ' mil' : ' mil') : 'R$ ' + nf0.format(v)) : nf0.format(v);
  const series = [{name: 'Real', color: '#47682C', w: 2.6, values: real}, {name: 'Previsto', color: '#080F0F', dash: '6 4', w: 1.9, values: prev}];
  if (hasProj) series.push({name: 'Projeção', color: '#5E6B66', dash: '2 4', w: 2, values: proj});
  const leg = [{name: 'Real', color: '#47682C', w: 2.6}, {name: 'Previsto (método por padrão de demanda)', color: '#080F0F', dash: '6 4', w: 1.9}];
  if (hasProj) leg.push({name: 'Projeção das próximas 8 semanas', color: '#5E6B66', dash: '2 4', w: 2});
  leg.push({name: 'Semana chuvosa', color: '#E7EEDD', faixa: 1});
  legenda($('#leg-main'), leg);
  lineChart(host, {labels, tabLabels: tabL, series, yFmt: fmt, height: 290, shade: idx.map(k => D.meta.cen[k] === 'chuvoso').concat(hasProj ? Array(H).fill(false) : []),
    divisor: hasProj ? idx.length - 1 : null, divRot: 'projeção', aria: `Consumo real e previsto por semana, ${rs ? 'em reais' : 'em unidades'}`,
    tipTitle: i => i < idx.length ? 'Semana de ' + tabL[i] : 'Semana de ' + labels[i] + ' (projeção)',
    tipExtra: i => { if (i >= idx.length) return ''; const c = clWeek(idx[i]); return `<div class="nota" style="margin-top:4px">chuva ${nf1.format(c.mm)} mm · ${c.dc} dias com chuva<br>cenário: ${c.cen}</div>`; }});
  const e = mean(idx.map((_, i) => Math.abs(real[i] - prev[i]) / Math.max(1, real[i])));
  $('#nt-main').textContent = `${F.length} itens · ${idx.length} semanas · faixa clara: semana com 30 mm ou mais, ou 4 ou mais dias de chuva. A projeção repete a previsão da última semana e não usa previsão de tempo.`;
}

/* ---- risco */
function ordenar(a) {
  const k = S.ord.k, d = S.ord.dir, O = {crit: 0, aten: 1, ok: 2};
  const f = {risco: it => O[it.risco] * 1e4 + (it.rd == null ? 999 : it.rd), nome: it => norm(it.nome), saldo: it => it.saldo, pp: it => it.PP, cob: it => it.cob, rd: it => it.rd == null ? 1e9 : it.rd, forn: it => norm(FOR[it.forn].nome)}[k];
  return [...a].sort((x, y) => { const u = f(x), v = f(y); return (u < v ? -1 : u > v ? 1 : x.id - y.id) * d; });
}
function renderRisco() {
  const base = filtrados(true), cont = {crit: 0, aten: 0, ok: 0}; base.forEach(i => cont[i.risco]++);
  $('#chips-risco').innerHTML = [['', 'Todos', base.length], ['crit', 'Crítico', cont.crit], ['aten', 'Atenção', cont.aten], ['ok', 'Sem risco', cont.ok]]
    .map(([k, t, n]) => `<button class="chip" data-r="${k}" aria-pressed="${S.risco === k}">${t} <span class="num">${n}</span></button>`).join('');
  const L = ordenar(filtrados(false));
  const vis = L.slice(0, S.mostrar);
  const th = (k, t, r) => `<th class="ord ${r ? 'r' : ''}" data-o="${k}" aria-sort="${S.ord.k === k ? (S.ord.dir > 0 ? 'ascending' : 'descending') : 'none'}">${t}${S.ord.k === k ? (S.ord.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  $('#tb-risco').innerHTML = `<thead><tr>${th('risco', 'Risco')}${th('nome', 'Item')}${th('saldo', 'Saldo', 1)}<th class="r">Em trânsito</th>${th('pp', 'Ponto de pedido', 1)}${th('rd', 'Ruptura em', 1)}${th('forn', 'Fornecedor')}</tr></thead><tbody>` +
    (vis.length ? vis.map(it => `<tr class="clicavel" tabindex="0" data-id="${it.id}"><td>${stl(it.risco)}</td><td><b>${esc(it.nome)}</b><br><span class="nota">${it.cod} · ${esc(FAM[it.fam].nome)}</span></td>
      <td class="r num">${nf0.format(it.saldo)}</td><td class="r num">${it.tr ? nf0.format(it.tr.q) + '<br><span class="nota">chega em ' + it.tr.eta + ' d</span>' : '–'}</td>
      <td class="r num">${nf0.format(Math.ceil(it.PP))}</td><td class="r num">${it.rd == null ? '<span class="nota">&gt; 120 dias</span>' : it.rd === 0 ? '<b>já em falta</b>' : rdTxt(it)}</td>
      <td>${esc(nomeForn(FOR[it.forn]))}</td></tr>`).join('') : '<tr><td colspan="7" class="vazio">Nenhum item atende aos filtros.</td></tr>') + '</tbody>';
  $('#bt-mais').hidden = L.length <= S.mostrar && S.mostrar <= 12;
  $('#bt-mais').textContent = L.length > S.mostrar ? `Mostrar mais (${L.length - S.mostrar})` : 'Mostrar menos';
  $('#nt-risco').textContent = `${vis.length} de ${L.length} itens`;
}

/* ---- compras */
function registrar(it, acao, just) {
  LOG.push({t: new Date().toISOString(), id: it.id, cod: it.cod, nome: it.nome, qtd: it.qtd, valor: it.valor, acao, perfil: S.perfil, just}); lsSet('alcar-proto-v1-log', LOG);
}
function renderCompras(F) {
  const el = $('#compras-corpo'), p = S.perfil;
  const sug = F.filter(i => i.risco !== 'ok');
  const ord = a => a.sort((x, y) => ({crit: 0, aten: 1}[x.risco] - {crit: 0, aten: 1}[y.risco]) || (x.rd ?? 999) - (y.rd ?? 999));
  const pend = ord(sug.filter(i => [null, 'devolvida'].includes(ultimoStatus(i.id))));
  const aguard = ord(sug.filter(i => ultimoStatus(i.id) === 'aceita'));
  const lin = (it, bts) => `<div class="compra" data-id="${it.id}"><div><div class="nm">${ico(it.risco)} ${esc(it.nome)}</div><div class="sub num">${nf0.format(it.qtd)} un · ${brl.format(it.valor)} · ${esc(fornCurto(FOR[it.forn]))}${ultimoStatus(it.id) === 'devolvida' ? ' · <b>devolvida pelo compras</b>' : ''}</div></div><div class="bts">${bts}</div>
      <input type="text" placeholder="${p === 'compras' ? 'Justificativa (obrigatória para devolver)' : 'Justificativa da decisão (obrigatória para recusar)'}" aria-label="Justificativa" ${p === 'gestor' ? 'disabled' : ''}></div>`;
  let h = '';
  if (p === 'analista') {
    $('#nt-compras').textContent = `${pend.length} pendentes · ${aguard.length} aguardando compras`;
    h = pend.length ? '<div class="lista-compras">' + pend.slice(0, 40).map(it => lin(it, '<button class="btn pri peq" data-a="aceita">Aceitar</button><button class="btn peq" data-a="recusada">Recusar</button>')).join('') + '</div>' + (pend.length > 40 ? `<p class="nota">Mostrando 40 de ${pend.length}. Use os filtros para refinar.</p>` : '') : '<div class="vazio">Nenhuma compra pendente no recorte.</div>';
  } else if (p === 'compras') {
    $('#nt-compras').textContent = `${aguard.length} aguardando aprovação`;
    h = aguard.length ? '<div class="lista-compras">' + aguard.map(it => lin(it, '<button class="btn pri peq" data-a="aprovada">Aprovar</button><button class="btn peq" data-a="devolvida">Devolver</button>')).join('') + '</div>' : '<div class="vazio">Nada aguardando aprovação. O analista precisa aceitar sugestões primeiro (troque o perfil no topo).</div>';
  } else {
    $('#nt-compras').textContent = 'somente leitura';
    h = `<div class="vazio" style="text-align:left"><b>Perfil de gestão: somente leitura.</b><br>${nf0.format(pend.length)} sugestões pendentes (${brlK(sum(pend.map(i => i.valor)))}), ${nf0.format(aguard.length)} aguardando o compras.</div>` +
      (pend.length ? '<div class="lista-compras">' + pend.slice(0, 8).map(it => lin(it, '')).join('') + '</div>' : '');
  }
  el.innerHTML = h;
}
function decidir(id, acao, just) {
  const it = ITENS.find(i => i.id === id), exige = ['recusada', 'devolvida'].includes(acao);
  const anterior = ultimoStatus(id);
  if (!it || it.risco === 'ok' || !((S.perfil === 'analista' && [null, 'devolvida'].includes(anterior) && ['aceita', 'recusada'].includes(acao)) || (S.perfil === 'compras' && anterior === 'aceita' && ['aprovada', 'devolvida'].includes(acao)))) return false;
  if (exige && just.trim().length < 8) return false;
  registrar(it, acao, just.trim()); return true;
}

/* ---- registro */
function renderLog() {
  const rot = {aceita: 'Aceita pelo analista', recusada: 'Recusada', aprovada: 'Aprovada. Requisição sugerida ao SAP (simulada)', devolvida: 'Devolvida ao analista'};
  const L = decisoesFiltradas().reverse();
  $('#tb-log').innerHTML = L.length ? `<thead><tr><th>Quando</th><th>Item</th><th>Decisão</th><th>Justificativa</th></tr></thead><tbody>` + L.map(e => { const d = new Date(e.t);
    return `<tr><td class="num">${dmy(d)}<br><span class="nota">${d.toTimeString().slice(0, 5)} · ${e.perfil}</span></td><td>${esc(e.nome)}<br><span class="nota">${e.cod} · ${nf0.format(e.qtd)} un</span></td><td>${rot[e.acao]}</td><td>${esc(e.just || '–')}</td></tr>`; }).join('') + '</tbody>'
    : '<tbody><tr><td class="vazio">Nenhuma decisão registrada ainda. Aceite ou recuse uma compra sugerida.</td></tr></tbody>';
}
function csv() {
  const q = v => '"' + String(v ?? '').replace(/^[=+@\-]/, c => "'" + c).replace(/"/g, '""') + '"';
  const linhas = [['data_hora', 'codigo', 'item', 'quantidade', 'valor_rs', 'decisao', 'perfil', 'justificativa'].join(';')].concat(decisoesFiltradas().map(e => [e.t, e.cod, q(e.nome), e.qtd, nf2.format(e.valor).replace('.', ''), e.acao, e.perfil, q(e.just)].join(';')));
  const b = new Blob(['﻿' + linhas.join('\r\n')], {type: 'text/csv;charset=utf-8'}), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = 'registro_decisoes_alcar.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

/* ---- benchmarking */
function slope(a) { const n = a.length, mx = (n - 1) / 2, my = mean(a); let nu = 0, de = 0; a.forEach((v, i) => { nu += (i - mx) * (v - my); de += (i - mx) ** 2; }); return nu / de; }
function renderBench(F, idx) {
  const el = $('#bench-corpo');
  $$('#abas button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === S.tab));
  if (S.tab === 'forn') {
    const base = filtrados(true, true), ids = [...new Set(base.map(i => i.forn))];
    const rows = ids.map(id => { const f = FOR[id], n = base.filter(i => i.forn === id).length, l8 = mean(f.lt.slice(-8)), a8 = mean(f.otif.slice(-8)), sl = slope(f.lt) * 10;
      return {f, n, l8, a8, sl}; }).sort((a, b) => (b.l8 - b.f.bench) - (a.l8 - a.f.bench));
    el.innerHTML = `<div class="rolar"><table><thead><tr><th>Fornecedor</th><th class="r">Itens</th><th class="r">Lead time real<br>(8 sem.)</th><th class="r">Prometido</th><th class="r">Referência<br>setorial</th><th class="r">Entrega no prazo e completa</th><th>Tendência do lead time (41 sem.)</th></tr></thead><tbody>` +
      rows.map(r => { const dv = r.l8 - r.f.bench, tl = r.sl > .5 ? ['▲ piorando', 'pior'] : r.sl < -.5 ? ['▼ melhorando', 'melhor'] : ['■ estável', 'neutro'];
        return `<tr class="clicavel ${S.forn === r.f.id ? 'sel' : ''}" tabindex="0" data-f="${r.f.id}"><td><b>${esc(nomeForn(r.f))}</b></td><td class="r num">${r.n}</td>
        <td class="r num"><b>${nf1.format(r.l8)} d</b><br><span class="${dv > .3 ? 'pior' : dv < -.3 ? 'melhor' : 'neutro'}" style="font-size:12px">${dv > .3 ? '▲' : dv < -.3 ? '▼' : '■'} ${nf1.format(Math.abs(dv))} d ${dv > .3 ? 'acima' : dv < -.3 ? 'abaixo' : 'em linha'}</span></td>
        <td class="r num">${r.f.prom} d</td><td class="r num">${nf1.format(r.f.bench)} d</td><td class="r num">${pc(r.a8)}<br><span class="nota">ref. 93,0%</span></td>
        <td><span class="tend ${tl[1]}">${tl[0]}</span> <span class="nota num">(${r.sl > 0 ? '+' : ''}${nf1.format(r.sl)} d / 10 sem.)</span><br>${spark(r.f.lt, 150, 26, r.sl > .5 ? '#B3261E' : '#47682C')}</td></tr>`; }).join('') + '</tbody></table></div><p class="nota">Clique em um fornecedor para filtrar o painel inteiro. Ordenado do maior para o menor desvio contra a referência. Em vermelho, lead time com piora de mais de 0,5 dia a cada 10 semanas.</p>';
  } else if (S.tab === 'rup') {
    const base = filtrados(true), all = [...Array(NW).keys()];
    const wref = base.length ? mean(base.map(i => FAM[i.fam].ref.rup)) : 0;
    const sr = all.map(k => taxaRup(base, [k])), sm = sr.map((_, i) => i < 3 ? null : mean(sr.slice(i - 3, i + 1)));
    el.innerHTML = `<div class="duas"><div><div class="leg" id="lg-rup"></div><div class="chart" id="ch-rup"></div><p class="nota">Taxa de ruptura, média móvel de 4 semanas, para os itens do filtro. A linha tracejada é a referência setorial fictícia ponderada pelas famílias.</p></div><div id="tb-fam"></div></div>`;
    legenda($('#lg-rup'), [{name: 'Taxa de ruptura (média móvel 4 sem.)', color: '#47682C', w: 2.6}, {name: 'Referência setorial', color: '#080F0F', dash: '6 4', w: 1.8}]);
    if (base.length) lineChart($('#ch-rup'), {labels: all.map(k => dm(WK[k])), tabLabels: all.map(k => dm(WK[k]) + ' a ' + dm(addDays(WK[k], 6))), series: [{name: 'Taxa de ruptura', color: '#47682C', w: 2.6, values: sm}, {name: 'Referência', color: '#080F0F', dash: '6 4', w: 1.8, values: all.map(() => wref)}],
      yFmt: v => nf1.format(v) + '%', height: 250, aria: 'Taxa de ruptura por semana contra a referência setorial', yminmax: wref});
    const fams = D.familias.map(f => { const b = filtrados(true, false, true).filter(i => i.fam === f.id); return {f, b, rup: taxaRup(b, idx), ac: b.length && idx.length ? 100 - wape(b, idx) : null, cob: b.length ? sum(b.map(i => i.saldo * i.custo)) / sum(b.map(i => i.df * i.custo)) : null}; }).filter(r => r.b.length);
    const mx = Math.max(8, ...fams.map(r => Math.max(r.rup ?? 0, r.f.ref.rup))) * 1.1;
    $('#tb-fam').innerHTML = `<table><thead><tr><th>Família</th><th style="width:34%">Ruptura no período × referência</th><th class="r">Acurácia<br>(ref.)</th><th class="r">Cobertura<br>(ref.)</th></tr></thead><tbody>` + fams.map(r => { const pior = r.rup != null && r.rup > r.f.ref.rup;
      return `<tr class="${S.fam === r.f.id ? 'sel' : ''}"><td>${esc(r.f.nome)}<br><span class="nota">${r.b.length} itens</span></td>
      <td>${r.rup == null ? '–' : `<div class="barra" role="img" aria-label="${pc(r.rup)} contra referência de ${pc(r.f.ref.rup)}"><i style="width:${100 * r.rup / mx}%"></i><u style="left:${100 * r.f.ref.rup / mx}%"></u></div><span class="num" style="font-size:12.5px"><b>${pc(r.rup)}</b> · ref. ${pc(r.f.ref.rup)} <span class="${pior ? 'pior' : 'melhor'}">${pior ? '▲ acima' : '▼ abaixo'}</span></span>`}</td>
      <td class="r num">${r.ac == null ? '–' : pc(r.ac)}<br><span class="nota">${pc(r.f.ref.acc)}</span></td><td class="r num">${r.cob == null ? '–' : nf0.format(r.cob) + ' d'}<br><span class="nota">${r.f.ref.cob} d</span></td></tr>`; }).join('') + '</tbody></table><p class="nota">A barra mostra a taxa da família; o traço preto é a referência.</p>';
  } else {
    const base = filtrados(true), all = [...Array(NW).keys()];
    el.innerHTML = `<div class="duas"><div><div class="leg" id="lg-prev"></div><div class="chart" id="ch-prev"></div><p class="nota">WAPE semanal (soma dos erros absolutos ÷ soma do consumo real), média móvel de 4 semanas. Menor é melhor. Os três métodos foram aplicados a todos os itens do filtro.</p></div><div id="tb-met"></div></div>`;
    legenda($('#lg-prev'), MET.map((n, i) => ({name: n, color: MCOR[i], dash: MDASH[i], w: i === 1 ? 2.8 : 2.2})));
    if (base.length) {
      const sw = MET.map((_, mi) => { const s = all.map(k => wape(base, [k], mi)); return s.map((_, i) => i < 3 ? null : mean(s.slice(i - 3, i + 1))); });
      lineChart($('#ch-prev'), {labels: all.map(k => dm(WK[k])), tabLabels: all.map(k => dm(WK[k]) + ' a ' + dm(addDays(WK[k], 6))), series: MET.map((n, i) => ({name: n, short: ['Média móvel', 'Suav. exp.', 'Croston/SBA'][i], color: MCOR[i], dash: MDASH[i], w: i === 1 ? 2.8 : 2.2, values: sw[i]})),
        yFmt: v => nf0.format(v) + '%', height: 260, rpad: 84, direct: true, aria: 'WAPE por método de previsão ao longo das semanas'});
    }
    const pads = ['regular', 'intermitente', 'muito intermitente', 'sazonal'];
    $('#tb-met').innerHTML = `<table><thead><tr><th>Padrão de demanda</th><th class="r">Itens</th>${MET.map(n => `<th class="r">${n.replace(' (4 sem.)', '')}</th>`).join('')}<th>Melhor</th></tr></thead><tbody>` + pads.map(p => { const b = base.filter(i => i.padrao === p); if (!b.length || !idx.length) return ''; const w = MET.map((_, mi) => wape(b, idx, mi)), mn = Math.min(...w), bi = w.indexOf(mn);
      return `<tr><td>${p}</td><td class="r num">${b.length}</td>${w.map((v, i) => `<td class="r num" style="${i === bi ? 'font-weight:800' : ''}">${pc(v)}${i === bi ? ' ✓' : ''}</td>`).join('')}<td>${['Média móvel', 'Suav. exp.', 'Croston/SBA'][bi]}</td></tr>`; }).join('') + '</tbody></table><p class="nota">✓ marca o menor WAPE do padrão no período. Em itens intermitentes o WAPE é alto para qualquer método, e por isso a recomendação de estoque olha o risco, e não só o erro de previsão. O método avançado (regressão com clima, safra e horas de máquina) fica para a próxima versão.</p>';
  }
}

/* ============================================================ agente (regras locais) */
const ACERVO = [
  {k: ['estoque de seguranca', 'seguranca'], t: 'Estoque de segurança', r: '<p>O estoque de segurança cobre a variação da demanda e do prazo de reposição durante o intervalo de proteção. Com revisão a cada R dias e prazo total L = Lf + La:</p><p class="formula">SS = z · √( (R+L)·σd² + d̄²·σL² )<br>PP = d̄ · (R+L) + SS</p><p>z vem do nível de serviço alvo (z ≈ 1,64 para 95%), d̄ e σd são a média e o desvio da demanda diária, e σL é o desvio do prazo total.</p>'},
  {k: ['ponto de pedido', 'quando pedir', 'reposicao'], t: 'Ponto de pedido', r: '<p>O ponto de pedido é o saldo (mais o que já está em trânsito) abaixo do qual se emite uma compra: a demanda esperada durante o intervalo de proteção mais o estoque de segurança. A quantidade comprada costuma ser um múltiplo do lote.</p>'},
  {k: ['nivel de servico', 'z ', 'csl'], t: 'Nível de serviço', r: '<p>É a probabilidade de não faltar item em um ciclo de reposição. Subir o nível de 95% para 99% aumenta o z de 1,64 para 2,33, ou seja, cerca de 40% mais estoque de segurança. Use o controle “Nível de serviço alvo” no topo para ver o efeito nos riscos.</p>'},
  {k: ['curva abc', 'abc'], t: 'Curva ABC', r: '<p>Classifica os itens pelo valor consumido: A concentra cerca de 70% do valor, B os 20% seguintes e C o restante. Serve para escolher onde gastar atenção e onde aceitar um nível de serviço menor.</p>'},
  {k: ['croston', 'intermitente', 'sba'], t: 'Demanda intermitente', r: '<p>Peças de reposição ficam semanas sem sair e depois saem de uma vez. A média móvel simples falha nesses itens. O método de Croston separa o tamanho da demanda do intervalo entre demandas, e a variante SBA corrige o viés. Veja a aba “Métodos de previsão”.</p>'},
  {k: ['wape', 'acuracia', 'erro de previsao'], t: 'Acurácia da previsão', r: '<p>O WAPE soma os erros absolutos de todas as semanas e divide pela soma do consumo real. Ele não explode em semanas com consumo zero, ao contrário do MAPE. A acurácia exibida é 1 − WAPE.</p>'},
  {k: ['lgpd', 'dados pessoais', 'privacidade'], t: 'LGPD', r: '<p>O painel lê somente a camada ouro, com perfis por função. Os dados pessoais previstos são os de fornecedores pessoa física e de requisitantes, que ficam mascarados para quem não precisa deles. Detalhes em “Governança e metodologia”.</p>'},
  {k: ['lead time', 'prazo de entrega'], t: 'Lead time', r: '<p>É o tempo entre a decisão de comprar e a chegada do item. Aqui ele soma o prazo do fornecedor (Lf) e o tempo de aprovação interna (La), e usa o valor realizado, não o prometido.</p>'}];
const respostas = [];
function achaItem(q) {
  const c = q.match(/al-\d{6}/i); if (c) return ITENS.filter(i => i.cod.toLowerCase() === c[0].toLowerCase());
  const stop = new Set(['de', 'da', 'do', 'ref', 'tipo', 'com', 'para', 'item']);
  let melhor = 0, r = [];
  for (const it of ITENS) { const tk = norm(it.nome).replace(/[()]/g, '').split(/\s+/).filter(t => t.length > 2 && !stop.has(t)); const n = tk.filter(t => q.includes(t)).length; const min = Math.min(2, tk.length);
    if (n >= min && n > 0) { if (n > melhor) { melhor = n; r = [it]; } else if (n === melhor) r.push(it); } }
  return r;
}
function achaForn(q) { return D.fornecedores.find(f => q.includes(norm(f.nome.split(' ')[0])) && norm(f.nome.split(' ')[0]).length >= 4); }
const meta = (o, fn) => `<div class="meta">Origem: ${o}${fn ? ' · função: <code>' + fn + '</code>' : ''}</div>`;
function linhaItem(it) { return `<li>${stl(it.risco)} <b>${esc(it.nome)}</b> (${it.cod}): saldo ${nf0.format(it.saldo)}, ${it.rd == null ? 'sem ruptura em 120 dias' : it.rd === 0 ? 'já em falta' : 'ruptura em ' + rdTxt(it)}</li>`; }
function agente(qq) {
  const q = norm(qq), F = filtrados(false);
  const it = achaItem(q), fo = achaForn(q);
  const lista = (a, n) => '<ul>' + a.slice(0, n).map(linhaItem).join('') + '</ul>';
  if (/(mais perto|proximo|perto) de faltar|mais critico|maior risco/.test(q)) {
    const L = ordenar(F.filter(i => i.rd != null)).filter(i => i.risco !== 'ok').slice(0, 3);
    return L.length ? `<p>No recorte atual, os itens mais perto de faltar são:</p>${lista(L, 3)}${meta('base analítica (camada ouro)', 'itens_proximos_ruptura(n=3)')}` : `<p>Nenhum item do recorte tem ruptura prevista nos próximos 120 dias.</p>${meta('base analítica', 'itens_proximos_ruptura')}`;
  }
  if (/itens criticos|lista de criticos|quantos criticos/.test(q)) {
    const L = ordenar(F.filter(i => i.risco === 'crit'));
    return `<p>Há <b>${L.length}</b> itens críticos no recorte${L.length ? ', os 5 mais urgentes:' : '.'}</p>${lista(L, 5)}${meta('base analítica (camada ouro)', 'itens_criticos()')}`;
  }
  if (/lead time|prazo/.test(q) && fo) {
    const l8 = mean(fo.lt.slice(-8)), s = slope(fo.lt) * 10;
    return `<p><b>${esc(nomeForn(fo))}</b>: lead time real das últimas 8 semanas de <b>${nf1.format(l8)} dias</b>, contra ${fo.prom} prometidos e ${nf1.format(fo.bench)} de referência setorial (fictícia). A tendência é ${s > .5 ? 'de piora' : s < -.5 ? 'de melhora' : 'estável'} (${s > 0 ? '+' : ''}${nf1.format(s)} dias a cada 10 semanas).</p>${meta('base analítica (camada ouro)', 'lead_time_fornecedor(' + fo.id + ')')}`;
  }
  if (/coerente|coerencia|esta certo|esta adequado/.test(q) && /seguranca/.test(q)) {
    const x = it[0] || ordenar(F.filter(i => i.risco === 'crit' && i.d > 0.05))[0] || F.find(i => i.d > 0.05);
    if (!x) return '<p>Não há itens no recorte para comparar.</p>';
    const obs = 100 * x.nrup / NW;
    return `<p>Pergunta mista: a teoria vem do acervo e os números, da base.</p><p><b>Teoria.</b> SS = z·√((R+L)·σd² + d̄²·σL²), com z = ${nf2.format(S.z)} para ${pc(S.nivel)}.</p><p><b>Item ${esc(x.nome)} (${x.cod}).</b> d̄ = ${nf2.format(x.d)} un/dia, σd = ${nf2.format(x.sdd)}, L = ${nf1.format(x.L)} dias, σL = ${nf1.format(x.sL)}. Resultado: SS = <b>${nf1.format(x.SS)} un</b> (${nf1.format(x.SS / Math.max(x.d, 1e-6))} dias de consumo) e PP = ${nf0.format(Math.ceil(x.PP))} un.</p><p><b>Leitura.</b> O item teve falta em ${x.nrup} de ${NW} semanas (${pc(obs)}); o risco admitido por ciclo é ${pc(100 - S.nivel)}. ${obs > 100 - S.nivel ? 'A taxa observada está acima do admitido, o que sugere revisar σL, o lote ou a previsão. É um indício, não uma prova.' : 'A taxa observada está dentro do admitido. Como os dados são simulados, isso só mostra coerência interna.'}</p>${meta('acervo + base analítica', 'parametros_politica(' + x.cod + ')')}`;
  }
  if (it.length && /previs|forecast|consumo/.test(q)) {
    if (it.length > 1) return `<p>Encontrei ${it.length} itens parecidos. Informe o código:</p><ul>${it.slice(0, 5).map(i => `<li>${i.cod}: ${esc(i.nome)}</li>`).join('')}</ul>${meta('base analítica', 'buscar_item')}`;
    const x = it[0], w = [0, 1, 2].map(m => wape([x], [...Array(NW).keys()], m));
    return `<p><b>${esc(x.nome)}</b> (${x.cod}): previsão de <b>${nf1.format(x.fn)} un/semana</b>, método em uso: ${x.metodo === 'SBA' ? 'Croston/SBA' : 'suavização exponencial'} (padrão ${x.padrao}). WAPE no histórico: ${w.map((v, i) => MET[i].replace(' (4 sem.)', '') + ' ' + pc(v)).join(' · ')}.</p>${meta('base analítica (camada ouro)', 'previsao_item(' + x.cod + ')')}`;
  }
  if (it.length && /risco|ruptura|falt|saldo|ponto|quando/.test(q)) {
    if (it.length > 1) return `<p>Encontrei ${it.length} itens parecidos. Informe o código:</p><ul>${it.slice(0, 5).map(i => `<li>${i.cod}: ${esc(i.nome)}</li>`).join('')}</ul>${meta('base analítica', 'buscar_item')}`;
    const x = it[0];
    return `<p>${stl(x.risco)} <b>${esc(x.nome)}</b> (${x.cod}): saldo ${nf0.format(x.saldo)} un${x.tr ? ' e ' + x.tr.q + ' em trânsito (chegam em ' + x.tr.eta + ' dias)' : ''}, ponto de pedido ${nf0.format(Math.ceil(x.PP))} un, ${x.rd == null ? 'sem ruptura prevista em 120 dias' : x.rd === 0 ? 'item já em falta' : 'ruptura prevista em ' + rdTxt(x)} e prazo de reposição de ${nf1.format(x.L)} dias.${x.risco !== 'ok' ? ' Sugestão: comprar ' + nf0.format(x.qtd) + ' un (' + brl.format(x.valor) + ').' : ''}</p>${meta('base analítica (camada ouro)', 'risco_ruptura(' + x.cod + ')')}`;
  }
  const ac = ACERVO.find(a => a.k.some(k => q.includes(k)) || (/como (se )?calcul/.test(q) && a.t === 'Estoque de segurança' && /estoque|seguranca/.test(q)));
  if (ac) return `${ac.r}${meta('acervo externo (simulado no protótipo): ' + ac.t, '')}`;
  return `<p>Ainda não sei responder isso no protótipo. Posso ajudar com:</p><ul><li><b>Conceitos</b>: estoque de segurança, ponto de pedido, nível de serviço, curva ABC, demanda intermitente, WAPE, lead time, LGPD.</li><li><b>Sobre a usina</b>: item mais perto de faltar, itens críticos, lead time de um fornecedor, risco ou previsão de um item (cite o código AL-… ou o nome).</li><li><b>Mista</b>: “meu estoque de segurança está coerente com a teoria?”</li></ul>${meta('nenhuma função aplicável', '')}`;
}
function conversa(q) {
  const c = $('#chat'); c.insertAdjacentHTML('beforeend', `<div class="msg-u">${esc(q)}</div>`);
  const a = document.createElement('div'); a.className = 'msg-a'; a.innerHTML = '<p class="nota">consultando…</p>'; c.appendChild(a); c.scrollTop = c.scrollHeight;
  setTimeout(() => {
    if (window.AgenteIA && typeof window.AgenteIA.processar === 'function') {
      const res = window.AgenteIA.processar(q);
      a.innerHTML = `${res.resposta}<div class="meta">Origem: <b>${res.origem}</b> · <code>${res.funcao}</code></div>`;
    } else {
      a.innerHTML = agente(q);
    }
    c.scrollTop = c.scrollHeight;
  }, 350);
}

/* ============================================================ detalhe do item e sobre */
function abrirItem(id) {
  const it = ITENS.find(i => i.id === id), f = FOR[it.forn], dg = $('#dg-item'), c = $('#dg-item-c');
  const all = [...Array(NW).keys()], w = [0, 1, 2].map(m => wape([it], all, m)), bi = w.indexOf(Math.min(...w));
  c.innerHTML = `<button class="btn peq fecha" id="fx-item">Fechar (Esc)</button>
    <div class="nota">${it.cod} · ${esc(FAM[it.fam].nome)} · curva ${it.abc} · padrão ${it.padrao}</div>
    <h2 style="margin:2px 0 4px;font-size:19px">${esc(it.nome)}</h2><div>${stl(it.risco)} <span class="nota">${esc(nomeForn(f))}</span></div>
    <h3>Consumo real × previsto</h3><div class="leg" id="lg-it"></div><div class="chart" id="ch-it"></div>
    <h3>Parâmetros do ponto de pedido</h3>
    <dl class="par num"><dt>Demanda média diária (d̄)</dt><dd>${nf2.format(it.d)} un/dia</dd><dt>Desvio diário (σd)</dt><dd>${nf2.format(it.sdd)} un/dia</dd>
      <dt>Prazo do fornecedor (Lf)</dt><dd>${nf1.format(it.Lf)} dias (prometido ${f.prom})</dd><dt>Aprovação interna (La)</dt><dd>${nf1.format(it.La)} dias</dd>
      <dt>Prazo total (L = Lf + La)</dt><dd>${nf1.format(it.L)} dias</dd><dt>Desvio do prazo (σL)</dt><dd>${nf1.format(it.sL)} dias</dd>
      <dt>Revisão (R)</dt><dd>${R} dias</dd><dt>Nível de serviço / z</dt><dd>${pc(S.nivel)} / ${nf2.format(S.z)}</dd></dl>
    <div class="formula num">SS = z · √((R+L)·σd² + d̄²·σL²) = ${nf2.format(S.z)} · √(${nf1.format(R + it.L)}·${nf2.format(it.sdd ** 2)} + ${nf2.format(it.d ** 2)}·${nf2.format(it.sL ** 2)}) = <b>${nf1.format(it.SS)} un</b><br>PP = d̄·(R+L) + SS = ${nf2.format(it.d)}·${nf1.format(R + it.L)} + ${nf1.format(it.SS)} = <b>${nf0.format(Math.ceil(it.PP))} un</b></div>
    <h3>Situação</h3>
    <dl class="par num"><dt>Saldo</dt><dd>${nf0.format(it.saldo)} un</dd><dt>Em trânsito</dt><dd>${it.tr ? nf0.format(it.tr.q) + ' un, chegam em ' + it.tr.eta + ' dias' : 'nada'}</dd>
      <dt>Posição de estoque</dt><dd>${nf0.format(it.pos)} un (${it.pos <= it.PP ? 'abaixo' : 'acima'} do ponto de pedido)</dd><dt>Ruptura prevista</dt><dd>${it.rd == null ? 'não em 120 dias' : it.rd === 0 ? 'já em falta' : 'em ' + rdTxt(it)}</dd>
      <dt>Lote de compra</dt><dd>${nf0.format(it.lote)} un</dd><dt>Sugestão</dt><dd>${it.qtd ? nf0.format(it.qtd) + ' un · ' + brl.format(it.valor) : 'nenhuma compra'}</dd><dt>Semanas com falta</dt><dd>${it.nrup} de ${NW}</dd></dl>
    <h3>Erro de previsão (WAPE, histórico completo)</h3><p class="num">${MET.map((n, i) => `${i === bi ? '<b>' : ''}${n.replace(' (4 sem.)', '')}: ${pc(w[i])}${i === bi ? ' ✓</b>' : ''}`).join(' · ')}</p>
    <p class="nota">Método em uso: ${it.metodo === 'SBA' ? 'Croston/SBA' : 'suavização exponencial'}, conforme o padrão de demanda.</p>`;
  legenda($('#lg-it'), [{name: 'Real', color: '#47682C', w: 2.6}, {name: 'Previsto', color: '#080F0F', dash: '6 4', w: 1.9}]);
  dg.showModal();
  lineChart($('#ch-it'), {labels: all.map(k => dm(WK[k])), tabLabels: all.map(k => dm(WK[k]) + ' a ' + dm(addDays(WK[k], 6))), series: [{name: 'Real', color: '#47682C', w: 2.6, values: it.r}, {name: 'Previsto', color: '#080F0F', dash: '6 4', w: 1.9, values: it.p}],
    yFmt: v => nf0.format(v), height: 200, shade: all.map(k => D.meta.cen[k] === 'chuvoso'), aria: 'Consumo real e previsto do item'});
  $('#fx-item').onclick = () => dg.close(); $('#fx-item').focus();
}
function abrirSobre() {
  $('#dg-sobre-c').innerHTML = `<button class="btn peq fecha" id="fx-sobre">Fechar (Esc)</button><h2 style="margin:0 0 4px">Governança, LGPD e metodologia</h2>
  <p class="nota">Descrição das medidas previstas para o sistema e do que este protótipo faz. Não é parecer jurídico.</p>
  <h3>1. Princípios da LGPD aplicados</h3>
  <table><tbody>
   <tr><td><b>Finalidade e necessidade</b></td><td>O painel usa dados de consumo, estoque, compras e clima para apoiar a reposição de peças. Não há dado pessoal na análise de estoque.</td></tr>
   <tr><td><b>Minimização</b></td><td>A camada ouro não guarda CPF, endereço nem contato. Fornecedor pessoa física aparece com nome protegido para quem não precisa dele.</td></tr>
   <tr><td><b>Segurança</b></td><td>Painel e agente de IA leem somente a camada ouro, em modo somente leitura e com perfis por função. Escrita só no registro de decisões.</td></tr>
   <tr><td><b>Transparência</b></td><td>Cada resposta do agente informa a origem (acervo ou base analítica) e a função chamada. Cada cálculo mostra a fórmula.</td></tr>
   <tr><td><b>Responsabilização</b></td><td>Decisões ficam em trilha de auditoria com perfil, data e justificativa. A decisão final é sempre humana.</td></tr></tbody></table>
  <h3>2. Perfis e permissões (teste trocando o perfil no topo)</h3>
  <table><thead><tr><th>Perfil</th><th>Vê</th><th>Pode fazer</th></tr></thead><tbody>
   <tr><td>Analista de almoxarifado/PCM</td><td>Tudo da camada ouro. Fornecedor pessoa física com nome protegido.</td><td>Aceitar ou recusar sugestões, com justificativa.</td></tr>
   <tr><td>Setor de compras</td><td>Tudo, inclusive o nome do fornecedor pessoa física (necessário para o pedido).</td><td>Aprovar ou devolver as sugestões aceitas.</td></tr>
   <tr><td>Gestor de suprimentos</td><td>Tudo, inclusive o nome do fornecedor pessoa física.</td><td>Somente leitura. Define a política de estoque fora do painel.</td></tr></tbody></table>
  <h3>3. Dados pessoais no escopo</h3>
  <ul><li>Fornecedores pessoa física: um dos 12 fornecedores simulados.</li><li>Colaboradores requisitantes: previstos no SAP, <b>não exibidos</b> neste protótipo.</li><li>Retenção e descarte: prazo a definir com o jurídico antes de qualquer uso real.</li></ul>
  <h3>4. O que este protótipo não faz</h3>
  <ul><li>Não há autenticação real: o perfil é um seletor de demonstração.</li><li>O registro de decisões fica só neste navegador (armazenamento local).</li><li>O agente de IA usa regras locais, sem modelo de linguagem nem RAG.</li></ul>
  <h3>5. Metodologia dos cálculos</h3>
  <p class="formula num">L = Lf + La<br>SS = z · √((R+L)·σd² + d̄²·σL²)<br>PP = d̄ · (R+L) + SS</p>
  <ul><li><b>Parâmetros:</b> d̄ e σd vêm das últimas ${ULT} semanas (desvio semanal ÷ √7). Lf é o lead time realizado do fornecedor nas últimas ${ULT} semanas, La é o tempo médio de aprovação e σL combina os desvios de Lf e La. R = ${R} dias (revisão semanal).</li>
   <li><b>Crítico:</b> a ruptura projetada cai dentro do prazo total L, então uma compra feita hoje chega tarde. <b>Atenção:</b> a posição de estoque (saldo + trânsito) está no ponto de pedido ou abaixo. <b>Sem risco:</b> o restante.</li>
   <li><b>Quantidade sugerida:</b> menor múltiplo do lote que leva a posição acima do ponto de pedido. Lote = máximo entre 3 e 30 dias de consumo.</li>
   <li><b>Previsão:</b> suavização exponencial (α = 0,3) para itens regulares e sazonais; Croston/SBA (α = 0,1) para intermitentes. Média móvel de 4 semanas como referência.</li>
   <li><b>Cenário climático:</b> regras do Quadro 6 do relatório, calculadas sobre uma janela de 7 dias.</li></ul>
  <h3>6. Limitações dos dados</h3>
  <p>Tudo é simulado com semente fixa. O efeito do clima e da safra no consumo foi embutido na simulação, então o gráfico não prova que o clima afeta o consumo. As referências setoriais do benchmarking são fictícias. A fórmula assume demanda normal e é uma aproximação para itens intermitentes.</p>`;
  const dg = $('#dg-sobre'); dg.showModal(); $('#fx-sobre').onclick = () => dg.close();
}

/* ============================================================ orquestração */
function render() {
  S.z = calcular(S.nivel / 100);
  const F = filtrados(true), idx = semanas();
  $('#v-nivel').textContent = pc(S.nivel);
  salvarFiltros();
  $('#resumo-compras').textContent = `${filtrados(false).filter(i => i.risco !== 'ok' && [null, 'devolvida'].includes(ultimoStatus(i.id))).length} sugestões pendentes no recorte. As ações ficam na página Compras.`;
  const nf = filtrados(false).length;
  $('#res-filtros').textContent = `${nf} de ${ITENS.length} itens · ${idx.length} semanas no período${idx.length ? ' (' + dm(WK[idx[0]]) + ' a ' + dm(addDays(WK[idx[idx.length - 1]], 6)) + ')' : ''}`;
  renderKPIs(F, idx); renderMain(F, idx); renderClima(); renderRisco(); renderCompras(filtrados(false)); renderBench(F, idx); renderLog();
}
function init() {
  prepararPaginas();
  prepararAjudaKPIs();
  const fam = $('#f-fam'); fam.innerHTML = '<option value="">Todos os tipos de item</option>' + D.familias.map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('');
  $('#f-forn').innerHTML = '<option value="">Todos os fornecedores</option>' + D.fornecedores.map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('');
  $('#dl-itens').innerHTML = ITENS.map(i => `<option value="${esc(i.nome)} — ${i.cod}"></option>`).join('');
  const bind = (id, k) => $(id).addEventListener('change', e => { S[k] = e.target.value; S.mostrar = 12; render(); });
  prepararControles();
  bind('#f-fam', 'fam'); bind('#f-forn', 'forn'); bind('#f-safra', 'safra'); bind('#f-pad', 'pad'); bind('#f-abc', 'abc');
  $('#f-item').addEventListener('input', e => { const v = e.target.value.trim(), x = ITENS.find(i => `${i.nome} — ${i.cod}` === v || i.cod.toLowerCase() === v.toLowerCase()); S.item = x ? String(x.id) : ''; if (x || !v) render(); });
  $('#f-nivel').addEventListener('input', e => { S.nivel = +e.target.value; render(); });
  $('#bt-limpar').onclick = () => { Object.assign(S, {fam: '', item: '', forn: '', inicio: '2026-07-20', fim: '2026-10-18', safra: '', pad: '', abc: '', risco: '', nivel: 95, mostrar: 12}); ['#f-fam', '#f-forn', '#f-safra', '#f-pad', '#f-abc'].forEach(s => $(s).value = ''); $('#f-item').value = ''; $('#f-inicio').value = S.inicio; $('#f-fim').value = S.fim; $('#f-fim').setCustomValidity(''); $('#f-nivel').value = 95; render(); };
  $('#perfil').addEventListener('change', e => { S.perfil = e.target.value; render(); toast('Perfil: ' + e.target.selectedOptions[0].text); });
  $$('.seg button').forEach(b => b.addEventListener('click', () => { S.met = b.dataset.m; $$('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b)); render(); }));
  $('#tb-main').onclick = e => { const h = $('#ch-main'); if (!$('svg', h)) return; const tab = h.classList.toggle('modo-tab'); $('svg', h).toggleAttribute('hidden', tab); $('.tabela', h).toggleAttribute('hidden', !tab); e.target.textContent = tab ? 'Ver gráfico' : 'Ver tabela'; };
  $('#sel-clima').addEventListener('change', e => { S.cl = e.target.value; renderClima(); });
  $('#chips-risco').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; S.risco = b.dataset.r; S.mostrar = 12; render(); });
  $('#tb-risco').addEventListener('click', e => { const o = e.target.closest('th.ord'); if (o) { S.ord = {k: o.dataset.o, dir: S.ord.k === o.dataset.o ? -S.ord.dir : 1}; renderRisco(); return; } const r = e.target.closest('tr[data-id]'); if (r) abrirItem(+r.dataset.id); });
  $('#tb-risco').addEventListener('keydown', e => { if (e.key === 'Enter') { const r = e.target.closest('tr[data-id]'); if (r) abrirItem(+r.dataset.id); } });
  $('#bt-mais').onclick = () => { const n = filtrados(false).length; S.mostrar = n > S.mostrar ? S.mostrar + 24 : 12; renderRisco(); };
  $('#compras-corpo').addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; const row = b.closest('.compra'), inp = $('input', row), ok = decidir(+row.dataset.id, b.dataset.a, inp.value);
    if (!ok) { inp.classList.add('erro'); inp.placeholder = 'Escreva a justificativa (mínimo de 8 caracteres)'; inp.focus(); return; }
    toast({aceita: 'Sugestão aceita e enviada ao compras', recusada: 'Sugestão recusada e registrada', aprovada: 'Aprovada: requisição sugerida ao SAP (simulada)', devolvida: 'Devolvida ao analista'}[b.dataset.a]); render(); });
  $('#abas').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.tab = b.dataset.t; renderBench(filtrados(true), semanas()); });
  $('#bench-corpo').addEventListener('click', e => { const r = e.target.closest('tr[data-f]'); if (!r) return; S.forn = S.forn === r.dataset.f ? '' : r.dataset.f; $('#f-forn').value = S.forn; render(); });
  $('#bench-corpo').addEventListener('keydown', e => { if (e.key === 'Enter') { const r = e.target.closest('tr[data-f]'); if (r) r.click(); } });
  $('#bt-csv').onclick = () => LOG.length ? csv() : toast('Ainda não há decisões para exportar');
  $('#bt-zerar').onclick = () => { if (LOG.length && confirm('Apagar o registro de decisões deste protótipo?')) { LOG = []; lsSet('alcar-proto-v1-log', LOG); render(); } };
  $('#bt-sobre').onclick = abrirSobre;
  $('#form-chat').addEventListener('submit', e => { e.preventDefault(); const q = $('#q').value.trim(); if (!q) return; $('#q').value = ''; conversa(q); });
  $('#sugs').innerHTML = ['Como calcular o estoque de segurança?', 'Qual item está mais perto de faltar?', 'Quais são os itens críticos?', 'Qual o lead time da Correias Ipê?', 'Meu estoque de segurança está coerente com a teoria?', 'O que é demanda intermitente?']
    .map(t => `<button class="chip" type="button">${t}</button>`).join('');
  $('#sugs').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) conversa(b.textContent); });
  $('#chat').innerHTML = '<div class="msg-a"><p>Olá! Sou o agente de consulta do painel. Pergunte sobre conceitos de estoque ou sobre a situação dos itens. Experimente um dos atalhos abaixo.</p></div>';
  let tr; window.addEventListener('resize', () => { clearTimeout(tr); tr = setTimeout(render, 160); });
  render();
}
