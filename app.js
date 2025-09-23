

/* === PRICE-LINE LAYOUT (final, stable) ==============================
   - Vždy 1 sloupec (komodita → distribuce → přetoky)
   - Každý řádek: [segmented | input | "Kč/MWh"] v JEDNOM kontejneru
   - Inputy formátované česky: tisíce mezerou, 2 desetinná místa čárkou
==================================================================== */
(function(){
  const MAP = [
    { key:'commodityMode',    id:'price-commodity',    title:'Jednotková cena komodity'   },
    { key:'distributionMode', id:'price-distribution', title:'Jednotková cena distribuce' },
    { key:'feedinMode',       id:'price-feedin',       title:'Jednotková cena přetoků'    },
  ];
  const mk = h => { const t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.firstElementChild; };
  const fmt = new Intl.NumberFormat('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2});
  const parseCZ = s => { const c=String(s??'').replace(/\s|\u00A0/g,'').replace(',', '.').replace(/[^0-9.+-]/g,''); const n=parseFloat(c); return isFinite(n)?n:NaN; };
  const move = (el,to)=>{ if(el && to && !to.contains(el) && el.parentElement!==to && !el.contains(to)) to.appendChild(el); };

  function forceOneColumn(){
    const seg = document.querySelector('.segmented[data-key="commodityMode"], .segmented[data-key="distributionMode"], .segmented[data-key="feedinMode"]');
    const container = seg?.closest('.grid'); if(!container) return;
    container.classList.remove('md:grid-cols-2','grid-cols-2','lg:grid-cols-2','md:grid-cols-3','grid-cols-3');
    container.classList.add('grid-cols-1','md:grid-cols-1');
    ['commodityMode','distributionMode','feedinMode'].forEach(k=>{
      const s = document.querySelector(`.segmented[data-key="${k}"]`)?.closest('.setting');
      if (s && s.parentElement===container) container.appendChild(s);
    });
  }

  function ensureRow(setting, after){
    let row = setting.querySelector(':scope > .price-line');
    if(!row){ row = mk('<div class="price-line"></div>'); setting.insertBefore(row, after?.nextSibling || setting.firstChild); }
    Object.assign(row.style,{ display:'grid', gridTemplateColumns:'max-content 12ch max-content', alignItems:'center', gap:'.75rem', marginTop:'.5rem' });
    const cell = cls => row.querySelector(':scope > .'+cls) || row.appendChild(mk('<div class="'+cls+'"></div>'));
    const seg = cell('col-seg'), inp = cell('col-inp'), lab = cell('col-lab');
    if (row.children[0]!==seg || row.children[1]!==inp || row.children[2]!==lab){ const els=[seg,inp,lab]; row.innerHTML=''; els.forEach(e=>row.appendChild(e)); }
    return {row,seg,inp,lab};
  }

  function apply(){
    forceOneColumn();
    MAP.forEach(({key,id,title})=>{
      const seg = document.querySelector(`.segmented[data-key="${key}"]`);
      const setting = seg?.closest('.setting'); if(!seg || !setting) return;
      const titleEl = setting.querySelector('.setting-title'); if(titleEl) titleEl.textContent = title;
      const {row,seg:colSeg,inp:colInp,lab:colLab} = ensureRow(setting, titleEl);

      move(seg, colSeg);
      Object.assign(seg.style, { display:'inline-flex', flexDirection:'row', flexWrap:'nowrap', gap:'0.5rem', width:'max-content' });
      seg.classList.remove('flex-col');
      seg.querySelectorAll('button.seg').forEach(b=> b.style.whiteSpace='nowrap');

      const input = document.getElementById(id);
      if(input){
        move(input, colInp);
        input.type='text'; input.setAttribute('inputmode','decimal');
        Object.assign(input.style,{ width:'12ch', maxWidth:'12ch', textAlign:'right' });
        if(!input.dataset.fmtBound){
          const n0 = parseCZ(input.value); if(!isNaN(n0)) input.value = fmt.format(n0);
          input.addEventListener('blur', ()=>{ const n=parseCZ(input.value); input.value = isNaN(n)?'':fmt.format(n); });
          input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ const n=parseCZ(input.value); input.value=isNaN(n)?'':fmt.format(n); input.blur(); }});
          input.dataset.fmtBound='1';
        }
      }
      let l = setting.querySelector(`label[for="${id}"]`) || mk('<label class="lbl"></label>');
      l.textContent='Kč/MWh'; l.setAttribute('for', id); move(l, colLab);

      setting.querySelectorAll('label').forEach(x=>{ if(x!==l && !row.contains(x) && /Kč\/MWh/.test(x.textContent||'')) x.remove(); });
      setting.querySelectorAll(`#${id}`).forEach(x=>{ if(input && x!==input && !row.contains(x)) x.remove(); });
    });
  }

  if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', apply); }
  else { apply(); }
  window.addEventListener('resize', forceOneColumn);
})();
