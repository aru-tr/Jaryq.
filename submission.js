const config = window.JARYQ_CONFIG || {};
function backendReady() { return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl) && !!config.supabasePublishableKey; }
const statusEl = document.querySelector('#sendStatus');
let pendingSubmission=null;
if (!backendReady()) statusEl.textContent = 'Жіберу әлі қосылмаған. Жауаптарыңызды CSV форматында сақтаңыз.';
// The existing database accepts 25 polarization rows per request. Send every row
// in idempotent parts instead of limiting or truncating the student's experiment.
function submissionParts(notes,data,groupId,ids){
  const count=Math.max(1,...data.map(rows=>Math.ceil(rows.length/25)));
  return Array.from({length:count},(_,part)=>{
    const answers={...notes,labGroupId:groupId,labPart:String(part+1),labParts:String(count)};
    for(const [index,key]of [[0,'interferenceMeasurements'],[1,'diffractionMeasurements']]){
      answers[key]=JSON.stringify(data[index].slice(part*25,(part+1)*25).map(({gap,angle,slit,distance,position,grating,light,wavelength,ratio})=>index===0?{gap,angle,light,wavelength,ratio}:{slit,distance,position,grating,light,wavelength,ratio}));
    }
    const measurements=data[2].slice(part*25,(part+1)*25).map(({alpha,cos,sq,i,i0})=>({alpha,cos,sq,i,i0}));
    return {submission_id:ids[part],answers,measurements};
  });
}
document.querySelector('#submissionForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!backendReady()) { statusEl.textContent = 'Дерекқор қосылмағандықтан жауап жіберілмеді.'; return; }
  if(state.measuring){statusEl.textContent='Өлшеу аяқталғанша күтіңіз.';return;}
  const name=document.querySelector('#studentName').value.trim(),schoolClass=document.querySelector('#studentClass').value.trim(),notes={};
  document.querySelectorAll('[data-note]').forEach(el=>{try{sessionStorage.setItem(el.dataset.note,el.value);}catch{}});
  for(const key of ['observation0','conclusion0','observation1','conclusion1','polar',...Array.from({length:4},(_,i)=>['compare'+i+'a','compare'+i+'b']).flat()]){
    try{notes[key]=sessionStorage.getItem(key)||'';}catch{notes[key]='';}
    const visible=document.querySelector(`[data-note="${key}"]`);if(visible)notes[key]=visible.value;
  }
  if(name.length<2||!schoolClass){statusEl.textContent='Аты-жөні мен сыныбын толтырыңыз.';return;}
  if(!Object.values(notes).some(v=>v.trim())&&!state.data.some(rows=>rows.length)){statusEl.textContent='Алдымен бақылау немесе өлшеу нәтижелерін енгізіңіз.';return;}
  const button=document.querySelector('#sendWork');button.disabled=true;
  const data=state.data.map(rows=>rows.slice());
  let sent=0,total=0;
  try{
    const bytes=new TextEncoder().encode(JSON.stringify({name,schoolClass,notes,data}));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const fingerprint=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
    let pending=pendingSubmission;try{pending=pending||JSON.parse(sessionStorage.getItem('jaryqPendingV3'));}catch{}
    total=Math.max(1,...data.map(rows=>Math.ceil(rows.length/25)));
    if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,groupId:crypto.randomUUID(),ids:Array.from({length:total},()=>crypto.randomUUID()),sent:0};
    pendingSubmission=pending;
    const savePending=()=>{try{sessionStorage.setItem('jaryqPendingV3',JSON.stringify(pending));}catch{}};
    savePending();
    const packets=submissionParts(notes,data,pending.groupId,pending.ids);
    // Check each request against the existing server limits before any writes.
    if(packets.some(packet=>new TextEncoder().encode(JSON.stringify(packet.answers)).length>35000))throw new Error('notes-too-long');
    sent=pending.sent;
    for(let part=pending.sent;part<packets.length;part++){
      statusEl.textContent=`Жіберіліп жатыр: ${part+1} / ${packets.length} бөлік…`;
      const response=await fetch(config.supabaseUrl+'/rest/v1/rpc/submit_lab',{
        method:'POST',headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey},
        body:JSON.stringify({...packets[part],student_name:name,student_class:schoolClass}),signal:AbortSignal.timeout(20000)
      });
      if(!response.ok)throw new Error('HTTP '+response.status);
      pending.sent=part+1;sent=pending.sent;savePending();
    }
    statusEl.textContent='Барлық өлшеу мұғалімге сәтті жіберілді! Жауап нөмірі: '+pending.groupId;
  }catch(error){
    statusEl.textContent=error.message==='notes-too-long'?'Жазба мәтіні тым ұзын. Мәтінді қысқартып, қайта жіберіңіз. Өлшеулеріңіз сақтаулы.':`Жіберілгені толық расталмады (${sent}/${total} бөлік). Қайта бассаңыз, қалған бөліктер жалғасады. Өлшеулерді CSV сақтап алуға болады.`;
  }finally{button.disabled=false;}
});
