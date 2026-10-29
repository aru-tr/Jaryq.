const config = window.JARYQ_CONFIG || {};
function backendReady() { return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl) && !!config.supabasePublishableKey; }
const statusEl = document.querySelector('#sendStatus');
if (!backendReady()) statusEl.textContent = 'Жіберу әлі қосылмаған. Мұғалім ортақ дерекқорды баптауы керек. Жауаптарыңызды әзірге браузерде сақтаңыз.';
document.querySelector('#submissionForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!backendReady()) { statusEl.textContent = 'Дерекқор қосылмағандықтан жауап жіберілмеді. Мұғалімге хабарласыңыз.'; return; }
  const name = document.querySelector('#studentName').value.trim();
  const schoolClass = document.querySelector('#studentClass').value.trim();
  const notes = {};
  document.querySelectorAll('[data-note]').forEach(el => sessionStorage.setItem(el.dataset.note, el.value));
  for (const key of ['observation0','conclusion0','observation1','conclusion1','polar',...Array.from({length:4},(_,i)=>['compare'+i+'a','compare'+i+'b']).flat()]) notes[key] = sessionStorage.getItem(key) || '';
  if (name.length < 2 || !schoolClass) { statusEl.textContent = 'Аты-жөні мен сыныбын толтырыңыз.'; return; }
  if (!Object.values(notes).some(v=>v.trim()) && !state.rows.length) { statusEl.textContent = 'Алдымен бақылау, қорытынды немесе өлшеу нәтижелерін енгізіңіз.'; return; }
  const button = document.querySelector('#sendWork'); button.disabled = true;
  statusEl.textContent = 'Жіберіліп жатыр…';
  const fingerprint = JSON.stringify({name,schoolClass,notes,rows:state.rows});
  let pending; try { pending = JSON.parse(sessionStorage.getItem('jaryqPending')); } catch {}
  if (!pending || pending.fingerprint !== fingerprint) pending = {id:crypto.randomUUID(),fingerprint};
  sessionStorage.setItem('jaryqPending', JSON.stringify(pending));
  try {
    const response = await fetch(config.supabaseUrl+'/rest/v1/rpc/submit_lab', {
      method:'POST', headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey},
      body:JSON.stringify({submission_id:pending.id,student_name:name,student_class:schoolClass,answers:notes,measurements:state.rows}), signal:AbortSignal.timeout(20000)
    });
    if (!response.ok) throw Error('HTTP '+response.status);
    statusEl.textContent = 'Жұмысыңыз мұғалімге сәтті жіберілді! Жауап нөмірі: '+pending.id;
  } catch { statusEl.textContent = 'Жіберілгені расталмады. Интернетті тексеріп, қайта көріңіз. Жауаптарыңыз осы браузерде сақтаулы; бір жұмысты қайта жіберу көшірме жасамайды.'; }
  finally {button.disabled=false;}
});
