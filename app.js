'use strict';
const $ = s => document.querySelector(s);
const kinds = ['interference','diffraction','polarization'];
const names = ['Интерференция','Дифракция','Поляризация'];
const colors = ['#2677dd','#e47b28','#8c52c5'];
const state = {tab:0, view:'2d', gap:.02,angle:0,light:'white',wavelength:550,slit:.5,grating:false,position:0,distance:1,alpha:0,imax:100,rows:[],data:[[],[],[]],assembled:[[0,1,2,3],[0,1,2,3],[0,1,2,3]],positions:Array.from({length:3},()=>[{x:8,z:50},{x:24,z:50},{x:57.3333333333,z:50},{x:90,z:50}]),selected:0,page:[0,0,0],batchSize:101,storageWarning:''};
try {
  const saved=JSON.parse(sessionStorage.getItem('jaryq-lab-v2'));
  if(saved && Array.isArray(saved.data) && saved.data.length===3 && saved.data.every(a=>Array.isArray(a)&&a.every(r=>Number.isFinite(r.ratio)&&Number.isFinite(r.u)))) state.data=saved.data;
} catch {}
state.rows=state.data[2];
const equipment=[['Жарық көзі','Бірінші шыны','Екінші шыны','Бақылау экраны'],['Жарық көзі','Саңылау / тор','Экран','Фотоөлшеуіш'],['Жарық көзі','Поляризатор','Анализатор','Фотоэлемент']];
const canvas=$('#view'),ctx=canvas.getContext('2d');
function persist(){
  state.rows=state.data[2];
  const record={data:state.data};
  try{sessionStorage.setItem('jaryq-lab-v2',JSON.stringify(record));state.storageWarning='';}
  catch{state.storageWarning='Браузердің сессия жады толды. Мәндер ашық бетте сақтаулы; CSV жүктеп алыңыз.';}
  if(labDatabase)try{const tx=labDatabase.transaction('measurements','readwrite');tx.objectStore('measurements').put(record,labSession);tx.oncomplete=()=>{state.storageWarning='';};tx.onerror=()=>{state.storageWarning='Сақтау орны толды. Бетті жаппас бұрын CSV жүктеңіз.';};}catch{}
}
function range(id,title,min,max,step,value,unit){return `<label for="${id}Number">${title}<output id="${id}Out">${value} ${unit}</output></label><div class="parameter-pair"><input id="${id}" aria-label="${title}: жүгірткі" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}"><input id="${id}Number" class="parameter-number" data-param="${id}" type="number" min="${min}" max="${max}" step="any" value="${value}" aria-label="${title}: сан енгізу"></div>`;}
function alignment(t=state.tab){
  if(t>2||state.assembled[t].length!==4)return 'Барлық құралды үстелге қосыңыз.';
  const p=state.positions[t];
  if(p.some((v,i)=>i&&v.x-p[i-1].x<5))return 'Құралдарды жарық көзі → оптикалық элементтер → датчик ретімен орналастырыңыз.';
  if(p.some(v=>Math.abs(v.z-p[0].z)>5))return 'Құралдардың ортасын бір жарық осіне туралаңыз.';
  if(t===1&&(state.distance<.5-1e-8||state.distance>2+1e-8))return 'Саңылау мен экран аралығы 0,5–2 м болуы керек.';
  return '';
}
function ready(){return state.tab<3&&!alignment();}
function setStatus(message){$('#labStatus').textContent=message;}
function render(){
  $('#tabs').innerHTML=[...names,'Ортақ график'].map((n,i)=>`<button data-tab="${i}" class="${state.tab===i?'active':''}" aria-pressed="${state.tab===i}"><b>0${i+1}</b>${n}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.tab=+b.dataset.tab;render();});
  const t=state.tab;
  $('#sceneTitle').textContent=t<3?names[t]+' · оптикалық үстел':'Үш тәжірибенің нәтижелері';
  $('#controlTitle').textContent=t<3?'Тәжірибе параметрлері':'Нәтижелерді салыстыру';
  $('#controls').innerHTML=t===0?range('gap','Ауа қабаты · d',0,2,.01,state.gap,'мкм')+range('angle','Түсу бұрышы · r',0,60,1,state.angle,'°'):t===1?range('slit','Саңылау ені · a',.5,.8,.01,state.slit,'мм')+range('distance','Экранға дейін · L',.5,2,.1,state.distance,'м')+range('position','Датчик орны · x',...(state.grating?[-75,75,1]:[-4,4,.01]),state.position,'мм')+`<label for="grating">Оптикалық элемент</label><select id="grating"><option value="0">Жіңішке саңылау</option><option value="1" ${state.grating?'selected':''}>Тор · 100 сызық/мм, N = 8</option></select>`:t===2?range('alpha','Анализатор бұрышы · α',0,360,15,state.alpha,'°')+range('imax','Ең үлкен фототок · I₀',10,100,10,state.imax,'мкА'):'<p>Кестелердегі өлшеулерді бір графикте салыстырыңыз. Әр сызықтың түсі тәжірибеге сәйкес келеді.</p><button id="openFirst">Бірінші тәжірибеге өту</button>';
  if(t<2)$('#controls').innerHTML+=`<label for="light">Жарық көзі</label><select id="light"><option value="mono">Монохроматты жарық</option><option value="white" ${state.light==='white'?'selected':''}>Ақ жарық · 400–700 нм</option></select>`+(state.light==='mono'?range('wavelength','Толқын ұзындығы · λ',400,700,10,state.wavelength,'нм'):'<p class="small">31 толқын ұзындығының орташа қарқындылығы есептеледі.</p>');
  if(t<3)$('#controls').innerHTML+=`<label for="batchSize">Автоматты өлшеудегі нүкте саны</label><input id="batchSize" type="number" min="2" step="1" value="${state.batchSize}"><div class="actions"><button id="measure" class="primary">Мәнді кестеге қосу</button><button id="sweep">Өлшеу сериясын қосу</button></div><p id="labStatus" role="status" aria-live="polite"></p>`;
  $('#controls').querySelectorAll('.parameter-pair input').forEach(input=>input.oninput=()=>{
    const id=input.dataset.param||input.id, slider=$('#'+id),number=$('#'+id+'Number');
    if(input.value===''||!Number.isFinite(input.valueAsNumber)||input.valueAsNumber<+slider.min||input.valueAsNumber>+slider.max){
      input.setCustomValidity('Мән '+slider.min+' және '+slider.max+' аралығында болуы керек.');return;
    }
    input.setCustomValidity('');slider.setCustomValidity('');number.setCustomValidity('');state[id]=input.valueAsNumber;
    if(input!==slider)slider.value=input.value;if(input!==number)number.value=input.value;
    $('#'+id+'Out').textContent=input.value+' '+slider.dataset.unit;
    if(id==='distance'){const p=state.positions[1];p[2].x=p[1].x+state.distance/.03;if(p[2].x>88){p[1].x=88-state.distance/.03;p[2].x=88;}p[3].x=Math.max(p[3].x,p[2].x+6);updateBench();}
    update();
  });
  ['light','grating'].forEach(id=>{const input=$('#'+id);if(input)input.onchange=()=>{state[id]=id==='grating'?input.value==='1':input.value;if(id==='grating')state.position=0;render();};});
  if(t<3){$('#measure').onclick=measure;$('#sweep').onclick=sweep;$('#batchSize').oninput=e=>{const n=e.target.valueAsNumber;if(Number.isSafeInteger(n)&&n>=2){state.batchSize=n;e.target.setCustomValidity('');}else e.target.setCustomValidity('Кемінде 2 болатын бүтін санды енгізіңіз.');};}
  else $('#openFirst').onclick=()=>{state.tab=0;render();};
  $('#stepsTitle').textContent=t<3?'Тәжірибені орындау':'Ортақ қорытынды';
  const steps=t===3?['Әр тәжірибеде құралдарды жинап, қажетті мөлшерде мән өлшеңіз немесе мәндерді қолмен енгізіңіз.','Қисықтарды салыстырыңыз. Көлденең ось — әр тәжірибенің өз өлшеу аралығы (0–100%).','Кестелерді CSV, графикті PNG форматында сақтаңыз.']:['Құралдарды үстел үстінде сүйреп жылжытып, бір жарық осіне туралаңыз немесе «Автоматты жинау» батырмасын басыңыз.',t===0?'Қалыңдықты, түсу бұрышын және толқын ұзындығын өзгертіп, шағылған жарықтың қарқындылығын өлшеңіз.':t===1?'Саңылау енін және экран қашықтығын орнатыңыз. Датчикті экран бойымен жылжытып, қарқындылықты өлшеңіз.':'Анализаторды 0–360° аралығында бұрыңыз. 90° және 270° кезінде фототоктың нөлге түсуін бақылаңыз.','Мәнді тіркеңіз немесе нүкте санын енгізіп, автоматты серия қосыңыз. Жаңа өлшеулер алдыңғыларды өшірмейді.','Құралды сүйресеңіз — ол жылжиды; 3D көріністің бос жерін сүйресеңіз — камера бұрылады. Ақ жарық түрлі түсті жолақтар береді.'];
  $('#steps').innerHTML=steps.map(s=>`<li>${s}</li>`).join('');
  $('#formula').innerHTML=[
    '<b>Жұқа ауа қабатынан шағылу</b><br>Δ = 2d cos r<br>I/I₀ = sin²(2πd cos r / λ)<br>Максимум: 2d cos r = (m + ½)λ<br>Минимум: 2d cos r = mλ<br><span class="small">Тең амплитудалы екі сәуле, бір шағылуда π фазалық ығысу. I₀ — шағылған жарықтың ең үлкен қарқындылығы. Суретте қисық бет: d(ρ) = d + ρ²/(2R), R = 0,8 м. Датчик орталықтағы d мәнін өлшейді.</span>',
    '<b>Фраунгофер дифракциясы</b><br>I/I₀ = (sin β / β)²; β = πa sin θ / λ<br>sin θ = x / √(L² + x²)<br>Тор: I/I₀ = sinc²(β) · [sin(Nq)/(N sin q)]²<br>q = πp sin θ / λ; p = 10 мкм; N = 8<br><span class="small">Тор саңылауының ені 2 мкм. Орталық максимум x = 0 кезінде I/I₀ = 1.</span>',
    '<b>Малюс заңы</b><br>I = I₀ cos²α<br>0°, 180°, 360° → I = I₀<br>90°, 270° → I = 0<br><span class="small">Идеал анализатор, сызықтық фотоэлемент, қараңғылық тогы нөлге тең.</span>',
    '<b>Салыстыру осьтері</b><br>Тік ось: салыстырмалы қарқындылық I/I₀ (0–1).<br>Көлденең ось: өлшеу аралығының үлесі u (0–100%).<br>Интерференция: d = 0–2 мкм<br>Дифракция: x = −4…4 мм (тор: −75…75 мм)<br>Поляризация: α = 0–360°<br><span class="small">Бұл әртүрлі параметрлер бойынша алынған тәуелділіктерді салыстыру. Бірдей u бірдей физикалық жағдайды білдірмейді. Сызықтар тіркелген нүктелерді қосады.</span>'
  ][t];
  $('#legend').innerHTML='<button id="viewToggle" class="capture">'+(state.view==='3d'?'2D жарық көрінісі':'3D құралдар көрінісі')+'</button> <button id="capture" class="capture">Көріністі PNG сақтау</button><span class="scene-help">'+(state.view==='3d'?'Құралды сүйреп жылжытыңыз · Бос жерді сүйреп камераны бұрыңыз':'Жарықтылық көрнекілік үшін күшейтілген; өлшеу мәні күшейтілмейді.')+'</span>';
  $('#viewToggle').hidden=t===3;$('.scene-help').hidden=t===3;
  $('#viewToggle').onclick=()=>{state.view=state.view==='3d'?'2d':'3d';render();};
  if(t<3&&state.view==='3d'){
    const buttons=document.createElement('div');buttons.className='camera-presets';buttons.innerHTML='<button data-camera="top">Үстінен</button><button data-camera="front">Алдынан</button><button data-camera="angle">Қиғаш</button>';
    $('#legend').prepend(buttons);buttons.querySelectorAll('button').forEach(button=>button.onclick=()=>LabScene.camera(button.dataset.camera));
  }
  $('#capture').onclick=()=>downloadCanvas(canvas,'jaryq-scene.png');
  renderAssembly();notebook();update();
}
function update(){
  const t=state.tab;
  if(t<3){
    const ratio=LabPhysics.intensity(kinds[t],state);
    $('#readout').innerHTML=`<span>${ready()?'Датчик көрсеткіші':'Алдымен құралдарды жинаңыз'}</span><strong>${ready()?(t===2?(ratio*state.imax).toFixed(2)+' мкА':(ratio*100).toFixed(2)+' %'):'—'}</strong>`+(t===2?'I/I₀ = '+ratio.toFixed(4):'Салыстырмалы қарқындылық · I/I₀')+(t===0?'<br>Δ = '+(2*state.gap*Math.cos(state.angle*Math.PI/180)).toFixed(3)+' мкм':t===1?'<br>x = '+state.position.toFixed(2)+' мм · L = '+state.distance.toFixed(1)+' м':'');
    $('#measure').disabled=$('#sweep').disabled=!ready()||!!state.measuring;
  } else $('#readout').innerHTML=names.map((n,i)=>`<div style="color:${colors[i]}">${n}: ${state.data[i].length} нүкте</div>`).join('');
  updateBench();draw();
}
function condition(row,t){return JSON.stringify(t===0?[row.angle,row.light,row.wavelength]:t===1?[row.slit,row.distance,row.grating,row.light,row.wavelength]:[row.imax]);}
function measure(){
  if(!ready())return;
  const t=state.tab;state.data[t].push(LabPhysics.sample(kinds[t],state));
  state.page[t]=Math.floor((state.data[t].length-1)/100);
  persist();notebook();setStatus('Жаңа өлшеу қосылды. Барлығы: '+state.data[t].length+' мән.');
}
async function sweep(){
  if(!ready()||state.measuring)return;
  const count=$('#batchSize').valueAsNumber;
  if(!Number.isSafeInteger(count)||count<2){$('#batchSize').reportValidity();return;}
  const t=state.tab,settings={...state},[lo,hi]=LabPhysics.bounds(kinds[t],settings);
  state.measuring=true;$('#sweep').disabled=true;$('#measure').disabled=true;
  let added=0;
  try{
    for(let start=0;start<count;start+=500){
      const end=Math.min(count,start+500);
      for(let i=start;i<end;i++)state.data[t].push(LabPhysics.sample(kinds[t],{...settings,[LabPhysics.parameter(kinds[t])]:lo+(hi-lo)*i/(count-1)}));
      added=end;if(state.tab===t)setStatus(added+' / '+count+' мән есептелді…');
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }finally{
    state.measuring=false;state.page[t]=Math.floor((state.data[t].length-1)/100);persist();notebook();update();
    if(state.tab===t)setStatus(added+' мән қосылды. Барлығы: '+state.data[t].length+' мән.');
  }
}
function table(t){
  const headers=t===0?['d, мкм','r, °','Жарық','Δ, мкм','I/I₀']:t===1?['x, мм','a, мм / тор','L, м','Жарық','I/I₀']:['α, °','cos α','cos²α','I, мкА','I₀, мкА'];
  const light=r=>r.light==='white'?'Ақ жарық':r.wavelength+' нм';
  return `<div class="table-scroll"><table><thead><tr><th>№</th>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${state.data[t].slice(state.page[t]*100,(state.page[t]+1)*100).map((r,offset)=>{const i=state.page[t]*100+offset;
    const values=t===0?[r.gap.toFixed(3),r.angle,light(r),(2*r.gap*Math.cos(r.angle*Math.PI/180)).toFixed(3),r.ratio.toFixed(4)]:t===1?[r.position.toFixed(3),r.grating?'Тор · 100/мм':r.slit.toFixed(2),r.distance.toFixed(1),light(r),r.ratio.toFixed(4)]:[r.alpha.toFixed(0),r.cos.toFixed(4),r.sq.toFixed(4),r.i.toFixed(2),r.i0];
    return `<tr><td>${i+1}</td>${values.map((v,j)=>`<td>${j===0?`<input class="table-value" data-series="${t}" data-row="${i}" type="number" step="any" min="${LabPhysics.bounds(kinds[t],r)[0]}" max="${LabPhysics.bounds(kinds[t],r)[1]}" value="${r.value}" aria-label="${names[t]} ${i+1}-өлшеу: ${['d, мкм','x, мм','α, °'][t]}">`:v}</td>`).join('')}</tr>`;
  }).join('')||`<tr><td colspan="6">Өлшеулер әлі жоқ. Мәндерді тіркеңіз.</td></tr>`}</tbody></table></div><div class="table-pages"><button data-prev="${t}" ${state.page[t]===0?'disabled':''}>← Алдыңғы</button><span>${state.data[t].length?state.page[t]*100+1:0}–${Math.min((state.page[t]+1)*100,state.data[t].length)} / ${state.data[t].length} мән</span><button data-next="${t}" ${(state.page[t]+1)*100>=state.data[t].length?'disabled':''}>Келесі →</button></div>`;
}
function notebook(){
  const t=state.tab;
  $('#notebookTitle').textContent=t<3?names[t]+' · өлшеу кестесі':'Барлық өлшеулер';
  $('#notebook').innerHTML=t<3?`<div class="actions"><button id="download">CSV жүктеу</button><button id="clear">Кестені тазарту</button><button id="toSummary">Ортақ график →</button></div><p class="small">${state.data[t].length} мән · Жаңа өлшеулер үстіне қосылады. Әр жол өз параметрлерімен сақталады.</p>${table(t)}<canvas id="graph" width="660" height="310" aria-label="${names[t]} өлшеулерінің графигі"></canvas><label for="note">Бақылау және қорытынды</label><textarea id="note" data-note="${t===2?'polar':'observation'+t}" placeholder="Нәтижелерді түсіндіріңіз…"></textarea>`:
    '<p class="small">Көк — интерференция · Қызғылт сары — дифракция · Күлгін — поляризация</p><canvas id="graph" width="660" height="310" aria-label="Үш тәжірибенің ортақ графигі"></canvas><div class="actions"><button id="graphPng">Графикті PNG сақтау</button><button id="allCsv">Барлық кестені CSV сақтау</button></div>'+names.map((n,i)=>`<details open><summary style="color:${colors[i]}">${n} · ${state.data[i].length} мән</summary>${table(i)}</details>`).join('');
  if(t<3){$('#clear').onclick=()=>{state.data[t]=[];state.page[t]=0;persist();notebook();update();};$('#download').onclick=()=>exportCsv([t]);$('#toSummary').onclick=()=>{state.tab=3;render();};}
  else{$('#graphPng').onclick=()=>downloadCanvas($('#graph'),'jaryq-common-graph.png');$('#allCsv').onclick=()=>exportCsv([0,1,2]);}
  $('#notebook').querySelectorAll('[data-prev],[data-next]').forEach(button=>button.onclick=()=>{const t=+(button.dataset.prev??button.dataset.next);state.page[t]+=button.hasAttribute('data-prev')?-1:1;notebook();});
  if(state.storageWarning){const warning=document.createElement('p');warning.className='storage-warning';warning.textContent=state.storageWarning;$('#notebook').prepend(warning);}
  document.querySelectorAll('[data-note]').forEach(el=>{try{el.value=sessionStorage.getItem(el.dataset.note)||'';}catch{}el.oninput=()=>{try{sessionStorage.setItem(el.dataset.note,el.value);}catch{}};});
  $('#notebook').querySelectorAll('.table-value').forEach(input=>input.onchange=()=>{
    const t=+input.dataset.series,index=+input.dataset.row,row=state.data[t][index],value=input.valueAsNumber;
    const [lo,hi]=LabPhysics.bounds(kinds[t],row);
    if(!Number.isFinite(value)||value<lo||value>hi){input.setCustomValidity('Мән '+lo+' және '+hi+' аралығында болуы керек.');input.reportValidity();return;}
    state.data[t][index]=LabPhysics.sample(kinds[t],{...row,[LabPhysics.parameter(kinds[t])]:value});
    persist();notebook();update();
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
    const rows=state.data[t];g.strokeStyle=g.fillStyle=colors[t];g.lineWidth=2;
    const groups=new Map();for(const row of rows){const key=condition(row,t);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
    for(const group of groups.values()){
      g.beginPath();group.slice().sort((a,b)=>a.u-b.u).forEach((r,i)=>{const x=55+r.u*575,y=250-r.ratio*210;i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();
    }
    rows.forEach(r=>{g.beginPath();g.arc(55+r.u*575,250-r.ratio*210,3,0,Math.PI*2);g.fill();});
    g.fillText(names[t]+(rows.length?' · '+rows.length:' · мән жоқ'),65+(state.tab===3?t*190:0),25);
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
function moveEquipment(i,x,z){
  const t=state.tab;if(t>2)return;
  state.positions[t][i]={x:Math.max(5,Math.min(95,x)),z:Math.max(10,Math.min(90,z))};
  if(!state.assembled[t].includes(i))state.assembled[t].push(i);
  state.selected=i;
  if(t===1){state.distance=(state.positions[t][2].x-state.positions[t][1].x)*.03;
    const input=$('#distanceNumber');if(input){input.value=Number(state.distance.toFixed(4));$('#distance').value=state.distance;$('#distanceOut').textContent=state.distance.toFixed(3)+' м';}}
  update();
}
function updateBench(){
  if(state.tab>2)return;
  const t=state.tab,positions=state.positions[t];
  document.querySelectorAll('[data-bench-piece]').forEach(button=>{
    const i=+button.dataset.benchPiece,p=positions[i];button.style.left=p.x+'%';button.style.top=p.z+'%';button.hidden=!state.assembled[t].includes(i);button.classList.toggle('selected',state.selected===i);
    button.setAttribute('aria-label',equipment[t][i]+'. Бағыт пернелерімен жылжытыңыз.');
  });
  const beam=$('#benchBeam');if(beam){beam.setAttribute('points',positions.map(p=>`${p.x*10},${p.z*3}`).join(' '));beam.setAttribute('stroke',ready()?'#f8cd6b':'#b56c47');}
  const status=$('#assemblyStatus');if(status)status.textContent=alignment()||'Жарық жолы тураланған. Құралдарды еркін жылжытып, өлшей аласыз.';
}
function renderAssembly(){
  let root=$('#assembly');if(!root){root=document.createElement('section');root.id='assembly';root.className='assembly';$('.workspace').before(root);}
  if(state.tab===3){root.hidden=true;return;}root.hidden=false;
  const t=state.tab;
  root.innerHTML=`<div class="assembly-head"><div><div class="eyebrow">ҚҰРАЛДАРДЫ ҚҰРАСТЫРУ</div><h2>Еркін оптикалық үстел</h2></div><div class="actions"><button id="autoAssemble" class="primary">Автоматты жинау</button><button id="resetAssembly">Бөлшектеу</button></div></div><p class="small">Құралдың өзін ұстап, кез келген жерге сүйреңіз. Құралдар жарық жолының ретімен бір осьте тұруы керек. Таңдалған құралды бағыт пернелерімен де жылжытуға болады.</p><div class="equipment-tray">${equipment[t].map((n,i)=>`<button data-piece="${i}"><span>${['◉','▥','▥','▣'][i]}</span>${n}</button>`).join('')}</div><div id="opticalBench" class="optical-bench" aria-label="Құралдарды еркін жылжыту үстелі"><svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true"><path d="M 30 150 H 970" stroke="#66877b" stroke-dasharray="8 8"/><polyline id="benchBeam" fill="none" stroke-width="4"/></svg><span class="bench-caption">ЖАРЫҚ ОСІ · ҮСТІНЕН КӨРІНІС</span>${equipment[t].map((n,i)=>`<button data-bench-piece="${i}" class="bench-piece"><span class="bench-icon">${['◉','▥','▥','▣'][i]}</span><span>${n}</span></button>`).join('')}</div><p id="assemblyStatus" role="status" aria-live="polite"></p>`;
  root.querySelectorAll('[data-piece]').forEach(button=>button.onclick=()=>{const i=+button.dataset.piece;if(!state.assembled[t].includes(i)){state.assembled[t].push(i);state.positions[t][i]={x:15+i*20,z:78};}state.selected=i;update();root.querySelector(`[data-bench-piece="${i}"]`).focus();});
  root.querySelectorAll('[data-bench-piece]').forEach(button=>{
    const i=+button.dataset.benchPiece;let offset=null;
    button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const rect=$('#opticalBench').getBoundingClientRect(),p=state.positions[t][i];offset={x:(e.clientX-rect.left)/rect.width*100-p.x,z:(e.clientY-rect.top)/rect.height*100-p.z};state.selected=i;button.focus();button.setPointerCapture(e.pointerId);updateBench();};
    button.onpointermove=e=>{if(!offset)return;const rect=$('#opticalBench').getBoundingClientRect();moveEquipment(i,(e.clientX-rect.left)/rect.width*100-offset.x,(e.clientY-rect.top)/rect.height*100-offset.z);};
    button.onpointerup=button.onpointercancel=()=>{offset=null;};
    button.onkeydown=e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();const p=state.positions[t][i],step=e.shiftKey?5:1;moveEquipment(i,p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),p.z+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));};
  });
  $('#autoAssemble').onclick=()=>{
    if(t===1&&(state.distance<.5||state.distance>2))state.distance=1;
    const lens=t===1?Math.min(24,88-state.distance/.03):24,screen=t===1?lens+state.distance/.03:58;
    state.positions[t]=[{x:8,z:50},{x:lens,z:50},{x:screen,z:50},{x:95,z:50}];state.assembled[t]=[0,1,2,3];
    if(t===1){$('#distanceNumber').value=state.distance;$('#distance').value=state.distance;$('#distanceOut').textContent=state.distance.toFixed(3)+' м';}update();
  };
  $('#resetAssembly').onclick=()=>{state.assembled[t]=[];update();};
  updateBench();
}
function spectrum(w){let r=0,g=0,b=0;if(w<440){r=(440-w)/60;b=1;}else if(w<490){g=(w-440)/50;b=1;}else if(w<510){g=1;b=(510-w)/20;}else if(w<580){r=(w-510)/70;g=1;}else if(w<645){r=1;g=(645-w)/65;}else r=1;return[r,g,b];}
let patternCache={key:'',canvas:null};
function patternSurface(){
  const t=state.tab,key=JSON.stringify([t,state.gap,state.angle,state.light,state.wavelength,state.slit,state.grating,state.distance]);
  if(patternCache.key===key)return patternCache.canvas;
  const surface=document.createElement('canvas'),w=600,h=320;surface.width=w;surface.height=h;
  const context=surface.getContext('2d'),im=context.createImageData(w,h),kind=kinds[t];
  const waves=state.light==='mono'?[state.wavelength]:Array.from({length:31},(_,i)=>400+i*10),rgb=waves.map(spectrum),p={...state};
  const weights=[0,1,2].map(k=>rgb.reduce((sum,c)=>sum+c[k],0)||1);
  const column=t===1?Array.from({length:w},(_,x)=>{p.position=(x/(w-1)-.5)*(state.grating?150:8);return waves.map(wave=>LabPhysics.monochromatic(kind,p,wave));}):null;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(t===0){const rho=Math.hypot((x-w/2)/h*.003,(y-h/2)/h*.003);p.gap=state.gap+rho*rho/1.6*1e6;}
    const result=[0,0,0];waves.forEach((wave,j)=>{const I=t===0?LabPhysics.monochromatic(kind,p,wave):column[x][j];for(let k=0;k<3;k++)result[k]+=rgb[j][k]*I;});
    const offset=(y*w+x)*4;for(let k=0;k<3;k++)im.data[offset+k]=255*Math.pow(Math.min(1,result[k]/(waves.length===1?1:weights[k])),.5);im.data[offset+3]=255;
  }
  context.putImageData(im,0,0);patternCache={key,canvas:surface};return surface;
}
function drawPattern(){
  ctx.drawImage(patternSurface(),100,70,800,360);
  ctx.strokeStyle='#edf2c4';const x=state.tab===0?500:100+(state.position/(state.grating?150:8)+.5)*800,y=250;
  ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x+8,y);ctx.moveTo(x,y-8);ctx.lineTo(x,y+8);ctx.stroke();
  sceneText(state.tab===0?'Шағылған жарық · түрлі түсті интерференция сақиналары':'Ақ орталық максимум · екі жақтағы дифракция спектрлері',170,475);
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
let labDatabase=null,labSession='';
try{labSession=sessionStorage.getItem('jaryq-session-id')||crypto.randomUUID();sessionStorage.setItem('jaryq-session-id',labSession);
 const request=indexedDB.open('jaryq-measurements',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('measurements');
 request.onsuccess=()=>{labDatabase=request.result;const read=labDatabase.transaction('measurements').objectStore('measurements').get(labSession);
  read.onsuccess=()=>{const saved=read.result;if(saved&&Array.isArray(saved.data)&&saved.data.length===3&&saved.data.every(a=>Array.isArray(a)&&a.every(r=>Number.isFinite(r.ratio)&&Number.isFinite(r.u)))&&saved.data.reduce((n,a)=>n+a.length,0)>state.data.reduce((n,a)=>n+a.length,0)){state.data=saved.data;state.rows=state.data[2];render();}};
 };
}catch{}
render();
