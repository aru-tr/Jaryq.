'use strict';
const $ = s => document.querySelector(s);
const kinds = ['interference','diffraction','polarization'];
const names = ['Интерференция','Дифракция','Поляризация'];
const colors = ['#2677dd','#e47b28','#8c52c5'];
const state = {tab:0, view:'3d', gap:.4,angle:0,light:'mono',wavelength:550,slit:.5,grating:false,position:0,distance:1,alpha:0,imax:100,rows:[],data:[[],[],[]],assembled:[[],[],[]]};
try {
  const saved=JSON.parse(sessionStorage.getItem('jaryq-lab-v2'));
  if(saved && Array.isArray(saved.data) && saved.data.length===3 && saved.data.every(a=>Array.isArray(a)&&a.length<=25&&a.every(r=>Number.isFinite(r.ratio)&&Number.isFinite(r.u)))) state.data=saved.data;
} catch {}
state.rows=state.data[2];
const equipment=[['Жарық көзі','Бірінші шыны','Екінші шыны','Бақылау экраны'],['Жарық көзі','Саңылау / тор','Экран','Фотоөлшеуіш'],['Жарық көзі','Поляризатор','Анализатор','Фотоэлемент']];
const canvas=$('#view'),ctx=canvas.getContext('2d');
function persist(){state.rows=state.data[2];try{sessionStorage.setItem('jaryq-lab-v2',JSON.stringify({data:state.data}));}catch{}}
function range(id,title,min,max,step,value,unit){return `<label for="${id}Number">${title}<output id="${id}Out">${value} ${unit}</output></label><div class="parameter-pair"><input id="${id}" aria-label="${title}: жүгірткі" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}"><input id="${id}Number" class="parameter-number" data-param="${id}" type="number" min="${min}" max="${max}" step="any" value="${value}" aria-label="${title}: сан енгізу"></div>`;}
function ready(){return state.tab<3&&state.assembled[state.tab].length===4;}
function setStatus(message){$('#labStatus').textContent=message;}
function render(){
  $('#tabs').innerHTML=[...names,'Ортақ график'].map((n,i)=>`<button data-tab="${i}" class="${state.tab===i?'active':''}" aria-pressed="${state.tab===i}"><b>0${i+1}</b>${n}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.tab=+b.dataset.tab;render();});
  const t=state.tab;
  $('#sceneTitle').textContent=t<3?names[t]+' · оптикалық үстел':'Үш тәжірибенің нәтижелері';
  $('#controlTitle').textContent=t<3?'Тәжірибе параметрлері':'Нәтижелерді салыстыру';
  $('#controls').innerHTML=t===0?range('gap','Ауа қабаты · d',0,2,.01,state.gap,'мкм')+range('angle','Түсу бұрышы · r',0,60,1,state.angle,'°'):t===1?range('slit','Саңылау ені · a',.5,.8,.01,state.slit,'мм')+range('distance','Экранға дейін · L',.5,2,.1,state.distance,'м')+range('position','Датчик орны · x',...(state.grating?[-75,75,1]:[-4,4,.01]),state.position,'мм')+`<label for="grating">Оптикалық элемент</label><select id="grating"><option value="0">Жіңішке саңылау</option><option value="1" ${state.grating?'selected':''}>Тор · 100 сызық/мм, N = 8</option></select>`:t===2?range('alpha','Анализатор бұрышы · α',0,360,15,state.alpha,'°')+range('imax','Ең үлкен фототок · I₀',10,100,10,state.imax,'мкА'):'<p>Кестелердегі өлшеулерді бір графикте салыстырыңыз. Әр сызықтың түсі тәжірибеге сәйкес келеді.</p><button id="openFirst">Бірінші тәжірибеге өту</button>';
  if(t<2)$('#controls').innerHTML+=`<label for="light">Жарық көзі</label><select id="light"><option value="mono">Монохроматты жарық</option><option value="white" ${state.light==='white'?'selected':''}>Ақ жарық · 400–700 нм</option></select>`+(state.light==='mono'?range('wavelength','Толқын ұзындығы · λ',400,700,10,state.wavelength,'нм'):'<p class="small">31 толқын ұзындығының орташа қарқындылығы есептеледі.</p>');
  if(t<3)$('#controls').innerHTML+='<div class="actions"><button id="measure" class="primary">Мәнді кестеге енгізу</button><button id="sweep">25 мәнді автоматты өлшеу</button></div><p id="labStatus" role="status" aria-live="polite"></p>';
  $('#controls').querySelectorAll('input').forEach(input=>input.oninput=()=>{
    const id=input.dataset.param||input.id, slider=$('#'+id),number=$('#'+id+'Number');
    if(input.value===''||!Number.isFinite(input.valueAsNumber)||input.valueAsNumber<+slider.min||input.valueAsNumber>+slider.max){
      input.setCustomValidity('Мән '+slider.min+' және '+slider.max+' аралығында болуы керек.');return;
    }
    input.setCustomValidity('');slider.setCustomValidity('');number.setCustomValidity('');state[id]=input.valueAsNumber;
    if(input!==slider)slider.value=input.value;if(input!==number)number.value=input.value;
    $('#'+id+'Out').textContent=input.value+' '+slider.dataset.unit;update();
  });
  ['light','grating'].forEach(id=>{const input=$('#'+id);if(input)input.onchange=()=>{state[id]=id==='grating'?input.value==='1':input.value;if(id==='grating')state.position=0;render();};});
  if(t<3){$('#measure').onclick=measure;$('#sweep').onclick=sweep;}
  else $('#openFirst').onclick=()=>{state.tab=0;render();};
  $('#stepsTitle').textContent=t<3?'Тәжірибені орындау':'Ортақ қорытынды';
  const steps=t===3?['Әр тәжірибеде құралдарды жинап, 25 мәнді автоматты өлшеңіз немесе мәндерді қолмен енгізіңіз.','Қисықтарды салыстырыңыз. Көлденең ось — әр тәжірибенің өз өлшеу аралығы (0–100%).','Кестелерді CSV, графикті PNG форматында сақтаңыз.']:['Құралды таңдап, үстелдегі тиісті орнына қойыңыз немесе «Автоматты жинау» батырмасын басыңыз.',t===0?'Қалыңдықты, түсу бұрышын және толқын ұзындығын өзгертіп, шағылған жарықтың қарқындылығын өлшеңіз.':t===1?'Саңылау енін және экран қашықтығын орнатыңыз. Датчикті экран бойымен жылжытып, қарқындылықты өлшеңіз.':'Анализаторды 0–360° аралығында бұрыңыз. 90° және 270° кезінде фототоктың нөлге түсуін бақылаңыз.','Бір мәнді тіркеңіз немесе 25 нүктелік толық өлшеуді бастаңыз. Автоматты өлшеу осы тәжірибенің алдыңғы кестесін жаңартады.','3D көріністі сүйреп бұрыңыз; 2D режимінде жарық жолақтарын қараңыз.'];
  $('#steps').innerHTML=steps.map(s=>`<li>${s}</li>`).join('');
  $('#formula').innerHTML=[
    '<b>Жұқа ауа қабатынан шағылу</b><br>Δ = 2d cos r<br>I/I₀ = sin²(2πd cos r / λ)<br>Максимум: 2d cos r = (m + ½)λ<br>Минимум: 2d cos r = mλ<br><span class="small">Тең амплитудалы екі сәуле, бір шағылуда π фазалық ығысу. I₀ — шағылған жарықтың ең үлкен қарқындылығы. Суретте қисық бет: d(ρ) = d + ρ²/(2R), R = 0,8 м. Датчик орталықтағы d мәнін өлшейді.</span>',
    '<b>Фраунгофер дифракциясы</b><br>I/I₀ = (sin β / β)²; β = πa sin θ / λ<br>sin θ = x / √(L² + x²)<br>Тор: I/I₀ = sinc²(β) · [sin(Nq)/(N sin q)]²<br>q = πp sin θ / λ; p = 10 мкм; N = 8<br><span class="small">Тор саңылауының ені 2 мкм. Орталық максимум x = 0 кезінде I/I₀ = 1.</span>',
    '<b>Малюс заңы</b><br>I = I₀ cos²α<br>0°, 180°, 360° → I = I₀<br>90°, 270° → I = 0<br><span class="small">Идеал анализатор, сызықтық фотоэлемент, қараңғылық тогы нөлге тең.</span>',
    '<b>Салыстыру осьтері</b><br>Тік ось: салыстырмалы қарқындылық I/I₀ (0–1).<br>Көлденең ось: өлшеу аралығының үлесі u (0–100%).<br>Интерференция: d = 0–2 мкм<br>Дифракция: x = −4…4 мм (тор: −75…75 мм)<br>Поляризация: α = 0–360°<br><span class="small">Бұл әртүрлі параметрлер бойынша алынған тәуелділіктерді салыстыру. Бірдей u бірдей физикалық жағдайды білдірмейді. Сызықтар тіркелген нүктелерді қосады.</span>'
  ][t];
  $('#legend').innerHTML='<button id="viewToggle" class="capture">'+(state.view==='3d'?'2D жарық көрінісі':'3D құралдар көрінісі')+'</button> <button id="capture" class="capture">Көріністі PNG сақтау</button><span class="scene-help">'+(state.view==='3d'?'Көріністі сүйреп бұрыңыз · + / − масштаб':'Жарықтылық көрнекілік үшін күшейтілген; өлшеу мәні күшейтілмейді.')+'</span>';
  $('#viewToggle').hidden=t===3;$('.scene-help').hidden=t===3;
  $('#viewToggle').onclick=()=>{state.view=state.view==='3d'?'2d':'3d';render();};
  $('#capture').onclick=()=>downloadCanvas(canvas,'jaryq-scene.png');
  renderAssembly();notebook();update();
}
function update(){
  const t=state.tab;
  if(t<3){
    const ratio=LabPhysics.intensity(kinds[t],state);
    $('#readout').innerHTML=`<span>${ready()?'Датчик көрсеткіші':'Алдымен құралдарды жинаңыз'}</span><strong>${ready()?(t===2?(ratio*state.imax).toFixed(2)+' мкА':(ratio*100).toFixed(2)+' %'):'—'}</strong>`+(t===2?'I/I₀ = '+ratio.toFixed(4):'Салыстырмалы қарқындылық · I/I₀')+(t===0?'<br>Δ = '+(2*state.gap*Math.cos(state.angle*Math.PI/180)).toFixed(3)+' мкм':t===1?'<br>x = '+state.position.toFixed(2)+' мм · L = '+state.distance.toFixed(1)+' м':'');
    $('#measure').disabled=$('#sweep').disabled=!ready();
  } else $('#readout').innerHTML=names.map((n,i)=>`<div style="color:${colors[i]}">${n}: ${state.data[i].length} нүкте</div>`).join('');
  draw();
}
function condition(row,t){return JSON.stringify(t===0?[row.angle,row.light,row.wavelength]:t===1?[row.slit,row.distance,row.grating,row.light,row.wavelength]:[row.imax]);}
function measure(){
  if(!ready())return;
  const t=state.tab,row=LabPhysics.sample(kinds[t],state),rows=state.data[t];
  let fresh=false;
  if(rows.length&&condition(rows[0],t)!==condition(row,t)){rows.length=0;fresh=true;}
  const index=rows.findIndex(r=>Math.abs(r.value-row.value)<1e-8);
  if(index>=0)rows[index]=row;
  else if(rows.length<25)rows.push(row);
  else{setStatus('Кестеде 25 мән бар. Жаңа өлшеу үшін кестені тазалаңыз.');return;}
  rows.sort((a,b)=>a.u-b.u);persist();notebook();setStatus((fresh?'Параметрлер өзгерді: жаңа өлшеу сериясы басталды. ':'')+'Мән кестеге енгізілді.');
}
function sweep(){if(!ready())return;state.data[state.tab]=LabPhysics.sweep(kinds[state.tab],state);persist();notebook();setStatus('25 мән есептеліп, кестеге және графикке енгізілді.');}
function table(t){
  const headers=t===0?['d, мкм','r, °','Жарық','Δ, мкм','I/I₀']:t===1?['x, мм','a, мм / тор','L, м','Жарық','I/I₀']:['α, °','cos α','cos²α','I, мкА','I₀, мкА'];
  const light=r=>r.light==='white'?'Ақ жарық':r.wavelength+' нм';
  return `<div class="table-scroll"><table><thead><tr><th>№</th>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${state.data[t].map((r,i)=>{
    const values=t===0?[r.gap.toFixed(3),r.angle,light(r),(2*r.gap*Math.cos(r.angle*Math.PI/180)).toFixed(3),r.ratio.toFixed(4)]:t===1?[r.position.toFixed(3),r.grating?'Тор · 100/мм':r.slit.toFixed(2),r.distance.toFixed(1),light(r),r.ratio.toFixed(4)]:[r.alpha.toFixed(0),r.cos.toFixed(4),r.sq.toFixed(4),r.i.toFixed(2),r.i0];
    return `<tr><td>${i+1}</td>${values.map((v,j)=>`<td>${j===0?`<input class="table-value" data-series="${t}" data-row="${i}" type="number" step="any" min="${LabPhysics.bounds(kinds[t],r)[0]}" max="${LabPhysics.bounds(kinds[t],r)[1]}" value="${r.value}" aria-label="${names[t]} ${i+1}-өлшеу: ${['d, мкм','x, мм','α, °'][t]}">`:v}</td>`).join('')}</tr>`;
  }).join('')||`<tr><td colspan="6">Өлшеулер әлі жоқ. Құралдарды жинап, мәндерді тіркеңіз.</td></tr>`}</tbody></table></div>`;
}
function notebook(){
  const t=state.tab;
  $('#notebookTitle').textContent=t<3?names[t]+' · өлшеу кестесі':'Барлық өлшеулер';
  $('#notebook').innerHTML=t<3?`<div class="actions"><button id="download">CSV жүктеу</button><button id="clear">Кестені тазарту</button><button id="toSummary">Ортақ график →</button></div><p class="small">${state.data[t].length}/25 мән · Әр кесте бірдей бекітілген параметрлермен алынған серияны сақтайды.</p>${table(t)}<canvas id="graph" width="660" height="310" aria-label="${names[t]} өлшеулерінің графигі"></canvas><label for="note">Бақылау және қорытынды</label><textarea id="note" data-note="${t===2?'polar':'observation'+t}" placeholder="Нәтижелерді түсіндіріңіз…"></textarea>`:
    '<p class="small">Көк — интерференция · Қызғылт сары — дифракция · Күлгін — поляризация</p><canvas id="graph" width="660" height="310" aria-label="Үш тәжірибенің ортақ графигі"></canvas><div class="actions"><button id="graphPng">Графикті PNG сақтау</button><button id="allCsv">Барлық кестені CSV сақтау</button></div>'+names.map((n,i)=>`<details open><summary style="color:${colors[i]}">${n} · ${state.data[i].length} мән</summary>${table(i)}</details>`).join('');
  if(t<3){$('#clear').onclick=()=>{state.data[t]=[];persist();notebook();};$('#download').onclick=()=>exportCsv([t]);$('#toSummary').onclick=()=>{state.tab=3;render();};}
  else{$('#graphPng').onclick=()=>downloadCanvas($('#graph'),'jaryq-common-graph.png');$('#allCsv').onclick=()=>exportCsv([0,1,2]);}
  document.querySelectorAll('[data-note]').forEach(el=>{try{el.value=sessionStorage.getItem(el.dataset.note)||'';}catch{}el.oninput=()=>{try{sessionStorage.setItem(el.dataset.note,el.value);}catch{}};});
  $('#notebook').querySelectorAll('.table-value').forEach(input=>input.onchange=()=>{
    const t=+input.dataset.series,index=+input.dataset.row,row=state.data[t][index],value=input.valueAsNumber;
    const [lo,hi]=LabPhysics.bounds(kinds[t],row);
    if(!Number.isFinite(value)||value<lo||value>hi){input.setCustomValidity('Мән '+lo+' және '+hi+' аралығында болуы керек.');input.reportValidity();return;}
    if(state.data[t].some((r,i)=>i!==index&&Math.abs(r.value-value)<1e-8)){input.setCustomValidity('Бұл мән кестеде бар. Басқа мәнді енгізіңіз.');input.reportValidity();return;}
    state.data[t][index]=LabPhysics.sample(kinds[t],{...row,[LabPhysics.parameter(kinds[t])]:value});
    state.data[t].sort((a,b)=>a.u-b.u);persist();notebook();update();
  });
  graph();
}
function graph(){
  const g=$('#graph').getContext('2d'),W=660,H=310;
  g.fillStyle='#f6f8f2';g.fillRect(0,0,W,H);g.font='12px Arial';
  for(let i=0;i<=5;i++){let y=250-i*42;g.strokeStyle='#dce5dd';g.beginPath();g.moveTo(55,y);g.lineTo(630,y);g.stroke();g.fillStyle='#526b60';g.fillText((i/5).toFixed(1),20,y+4);g.fillText(String(i*20),48+i*115,271);}
  g.fillText('I/I₀',12,20);g.fillText('Өлшеу аралығы, %',470,297);
  const indexes=state.tab===3?[0,1,2]:[state.tab];
  indexes.forEach(t=>{
    const rows=state.data[t];g.strokeStyle=g.fillStyle=colors[t];g.lineWidth=2.5;g.beginPath();rows.forEach((r,i)=>{const x=55+r.u*575,y=250-r.ratio*210;i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();
    rows.forEach(r=>{g.beginPath();g.arc(55+r.u*575,250-r.ratio*210,3,0,Math.PI*2);g.fill();});
    g.fillText(names[t]+(rows.length?'':' · мән жоқ'),65+(state.tab===3?t*190:0),25);
  });
  if(!indexes.some(t=>state.data[t].length)){g.fillStyle='#64756d';g.fillText('Өлшеу жүргізілгеннен кейін график пайда болады.',115,140);}
}
function exportCsv(indexes){
  const rows=[['Тәжірибе','Параметр','Мән','Бірлік','I/I₀','d, мкм','r, °','a, мм','L, м','Тор','Жарық','λ, нм','α, °','I, мкА','I₀, мкА']];
  indexes.forEach(t=>state.data[t].forEach(r=>rows.push([names[t],['d','x','α'][t],r.value,['мкм','мм','°'][t],r.ratio,t===0?r.gap:'',t===0?r.angle:'',t===1?r.slit:'',t===1?r.distance:'',t===1?r.grating:'',t<2?r.light:'',t<2&&r.light==='mono'?r.wavelength:'',t===2?r.alpha:'',t===2?r.i:'',t===2?r.i0:''])));
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')],{type:'text/csv;charset=utf-8'}));downloadUrl(url,'jaryq-measurements.csv');setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadUrl(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
function downloadCanvas(c,name){downloadUrl(c.toDataURL(),name);}
function renderAssembly(){
  let root=$('#assembly');if(!root){root=document.createElement('section');root.id='assembly';root.className='assembly';$('.workspace').before(root);}
  if(state.tab===3){root.hidden=true;return;}root.hidden=false;
  const t=state.tab,placed=state.assembled[t];
  root.innerHTML=`<div class="assembly-head"><div><div class="eyebrow">ҚҰРАЛДАРДЫ ҚҰРАСТЫРУ</div><h2>Оптикалық үстел <span>${placed.length}/4</span></h2></div><div class="actions"><button id="autoAssemble" class="primary">Автоматты жинау</button><button id="resetAssembly">Бөлшектеу</button></div></div><p class="small">Қолмен жинау: құралды таңдап, сәйкес бос орынға басыңыз. Құралды сүйреп апаруға да болады.</p><div class="equipment-tray">${equipment[t].map((n,i)=>`<button draggable="${!placed.includes(i)}" data-piece="${i}" ${placed.includes(i)?'disabled':''}><span>${['◉','▥','▥','▣'][i]}</span>${n}</button>`).join('')}</div><div class="equipment-slots">${equipment[t].map((n,i)=>`<button data-slot="${i}" class="${placed.includes(i)?'placed':''}" aria-label="${i+1}-орын: ${n}"><small>${i+1}-орын</small><span>${placed.includes(i)?'✓ '+n:n+' орны'}</span></button>`).join('')}</div><p id="assemblyStatus" role="status" aria-live="polite">${ready()?'Құралдар дайын. Өлшеуді бастауға болады.':'Барлық төрт құралды орналастырыңыз.'}</p>`;
  let selected=null;
  root.querySelectorAll('[data-piece]').forEach(b=>{b.onclick=()=>{selected=+b.dataset.piece;root.querySelectorAll('[data-piece]').forEach(n=>n.classList.toggle('selected',n===b));$('#assemblyStatus').textContent=equipment[t][selected]+': сәйкес орнын таңдаңыз.';};b.ondragstart=e=>{selected=+b.dataset.piece;e.dataTransfer.setData('text/plain',String(selected));};});
  const place=(slot,piece)=>{if(piece===null||piece!==slot){$('#assemblyStatus').textContent='Бұл орын басқа құралға арналған. Құрал атауын тексеріңіз.';return;}if(!placed.includes(piece))placed.push(piece);renderAssembly();update();};
  root.querySelectorAll('[data-slot]').forEach(b=>{b.onclick=()=>place(+b.dataset.slot,selected);b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const value=e.dataTransfer.getData('text/plain');place(+b.dataset.slot,/^[0-3]$/.test(value)?+value:null);};});
  $('#autoAssemble').onclick=()=>{state.assembled[t]=[0,1,2,3];renderAssembly();update();};
  $('#resetAssembly').onclick=()=>{state.assembled[t]=[];renderAssembly();update();};
}
function spectrum(w){let r=0,g=0,b=0;if(w<440){r=(440-w)/60;b=1;}else if(w<490){g=(w-440)/50;b=1;}else if(w<510){g=1;b=(510-w)/20;}else if(w<580){r=(w-510)/70;g=1;}else if(w<645){r=1;g=(645-w)/65;}else r=1;return[r,g,b];}
function drawPattern(){
  const w=600,h=320,im=ctx.createImageData(w,h),t=state.tab,kind=kinds[t];
  // Compute diffraction once per column; it is invariant along the slit height.
  const waves=state.light==='mono'?[state.wavelength]:Array.from({length:31},(_,i)=>400+i*10),rgb=waves.map(spectrum),p={...state};
  const column=t===1?Array.from({length:w},(_,x)=>{p.position=(x/(w-1)-.5)*(state.grating?150:8);return waves.map(wave=>LabPhysics.monochromatic(kind,p,wave));}):null;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(t===0){const rho=Math.hypot((x-w/2)/w*.007,(y-h/2)/h*.007);p.gap=state.gap+rho*rho/1.6*1e6;}
    const result=[0,0,0];waves.forEach((wave,j)=>{const I=t===0?LabPhysics.monochromatic(kind,p,wave):column[x][j];for(let k=0;k<3;k++)result[k]+=rgb[j][k]*I**.45;});
    const offset=(y*w+x)*4;for(let k=0;k<3;k++)im.data[offset+k]=Math.min(255,result[k]*255/(waves.length===1?1:11));im.data[offset+3]=255;
  }
  ctx.putImageData(im,200,70);ctx.strokeStyle='#edf2c4';ctx.beginPath();const x=t===0?500:200+(state.position/(state.grating?150:8)+.5)*600;ctx.moveTo(x,60);ctx.lineTo(x,400);ctx.stroke();
  sceneText(t===0?'Орталықтағы датчик · жұқа қабат':'Экрандағы датчик · x = '+state.position.toFixed(2)+' мм',260,450);
}
function sceneText(s,x,y,size=18){ctx.fillStyle='#d4e7de';ctx.font=size+'px Arial';ctx.fillText(s,x,y);}
function draw(){
  ctx.fillStyle='#101e20';ctx.fillRect(0,0,1000,520);
  if(state.tab===3){
    const plot=$('#graph');if(plot)ctx.drawImage(plot,50,40,900,423);
    sceneText(names.map((n,i)=>n+': '+state.data[i].length+' мән').join('   ·   '),100,500,16);return;
  }
  if(state.view==='3d'){LabScene.draw(ctx,state,equipment[state.tab]);return;}
  if(!ready()){sceneText('Құралдарды жинаңыз — жарық көрінісі осы жерде ашылады.',160,255);return;}
  if(state.tab<2)drawPattern();else{
    const I=LabPhysics.intensity('polarization',state);ctx.strokeStyle='#7ba48f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(90,250);ctx.lineTo(880,250);ctx.stroke();
    [300,580].forEach((x,i)=>{ctx.strokeStyle='#a1d6bc';ctx.beginPath();ctx.ellipse(x,250,45,110,0,0,Math.PI*2);ctx.stroke();ctx.save();ctx.translate(x,250);ctx.rotate(i?state.alpha*Math.PI/180:0);ctx.beginPath();ctx.moveTo(0,-100);ctx.lineTo(0,100);ctx.stroke();ctx.restore();});
    ctx.fillStyle='#ffe0a0';ctx.beginPath();ctx.arc(90,250,22,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(240,230,110,${.7*I})`;ctx.fillRect(625,220,220,60);ctx.fillStyle='#64977f';ctx.fillRect(845,190,25,120);
    sceneText('Жарық көзі',40,420);sceneText('Поляризатор',230,420);sceneText('Анализатор',510,420);sceneText('Фотоэлемент',800,420);sceneText('α = '+state.alpha+'° · I = '+(I*state.imax).toFixed(2)+' мкА',330,90,24);
  }
}
render();
