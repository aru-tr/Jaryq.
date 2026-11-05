"""Run against the local HTTP server; remote submission is mocked."""
import csv,json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1100})
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('https://fonts.googleapis.com/**',lambda route:route.abort())
 page.goto('http://127.0.0.1:8000/',wait_until='domcontentloaded')
 assert page.locator('#measure').is_enabled()
 assert page.locator('#light').input_value()=='white'
 assert page.locator('[data-slot]').count()==0
 # Rendered white-light rings contain distinct spectral colors, not a single tint.
 assert page.evaluate("""()=>{const c=patternSurface(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let colors=new Set();for(let i=0;i<d.length;i+=4){const [r,g,b]=[d[i],d[i+1],d[i+2]];if(Math.max(r,g,b)-Math.min(r,g,b)>30)colors.add([r>>4,g>>4,b>>4].join(','));}return colors.size>20;}""")
 page.screenshot(path='/tmp/jaryq-rings.png',full_page=True)
 # Continuous free movement, no snapping to numbered slots.
 piece=page.locator('[data-bench-piece="1"]')
 box=piece.bounding_box();bench=page.locator('#opticalBench').bounding_box()
 old=page.evaluate('state.positions[0][1].z')
 page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
 page.mouse.down();page.mouse.move(box['x']+box['width']/2+17,box['y']+box['height']/2+bench['height']*.18,steps=6);page.mouse.up()
 assert page.evaluate('state.positions[0][1].z')>old+10
 assert page.locator('#measure').is_disabled()
 page.locator('#autoAssemble').click();assert page.locator('#measure').is_enabled()
 piece.focus();page.keyboard.press('ArrowRight')
 assert abs(page.evaluate('state.positions[0][1].x')-25)<1e-8
 page.locator('#resetAssembly').click();assert page.locator('#measure').is_disabled()
 for i in range(4):page.locator(f'[data-piece="{i}"]').click()
 page.locator('#autoAssemble').click()
 # Manual duplicates and changed conditions must append rather than replace/reset.
 page.locator('#light').select_option('mono');page.locator('#gapNumber').fill('0.1375')
 assert '100.00' in page.locator('#readout').inner_text()
 page.locator('#measure').click();page.locator('#measure').click()
 page.locator('#angleNumber').fill('30');page.locator('#measure').click()
 assert page.evaluate('state.data[0].length')==3
 page.locator('.table-value').first.fill('0.275');page.locator('.table-value').first.press('Tab')
 assert abs(page.evaluate('state.data[0][0].ratio'))<1e-8
 # Every experiment accepts >25 points and repeated sweeps append all rows.
 counts=[]
 for t in range(3):
  page.locator(f'[data-tab="{t}"]').click();page.locator('#autoAssemble').click()
  if t==1:
   page.locator('#light').select_option('white');page.locator('#positionNumber').fill('1.1')
   assert page.evaluate('state.position')==1.1
   assert page.evaluate("LabPhysics.intensity('diffraction',state)")>0
   assert page.evaluate("""()=>{const c=patternSurface(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])>30)n++;return n>1000;}""")
   page.locator('#distanceNumber').fill('2');page.locator('#autoAssemble').click()
   assert abs(page.evaluate('state.distance')-2)<1e-8
   page.locator('#distanceNumber').fill('1');page.locator('#autoAssemble').click()
   page.screenshot(path='/tmp/jaryq-diffraction.png',full_page=True)
  if t==2:page.locator('#alphaNumber').fill('90');assert '0.00' in page.locator('#readout').inner_text()
  page.locator('#batchSize').fill('151')
  before=page.evaluate(f'state.data[{t}].length')
  for run in range(2):
   page.locator('#sweep').click();page.wait_for_function('!state.measuring')
   assert page.evaluate(f'state.data[{t}].length')==before+151*(run+1)
  counts.append(before+302)
  assert page.locator('.table-value').count()<=100
 # Above/front/angled views and 3D equipment dragging.
 page.locator('[data-tab="0"]').click();page.locator('#viewToggle').click()
 page.locator('[data-camera="front"]').click();front=page.locator('#view').screenshot()
 page.locator('[data-camera="top"]').click();top=page.locator('#view').screenshot()
 assert front!=top
 assert page.evaluate('LabScene.project([0,100,0]).depth < LabScene.project([0,0,0]).depth')
 page.screenshot(path='/tmp/jaryq-top.png',full_page=True)
 # Screen-space dragging changes a 3D object's world position.
 page.locator('#view').scroll_into_view_if_needed()
 pos=page.evaluate("(()=>{const p=state.positions[0][1];return LabScene.project([(p.x-50)*10,30,(p.z-50)*4]);})()")
 box=page.locator('#view').bounding_box()
 x=box['x']+pos['x']/1000*box['width'];y=box['y']+pos['y']/520*box['height']
 before=page.evaluate('state.positions[0][1].x')
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+25,y+12,steps=6);page.mouse.up()
 assert abs(page.evaluate('state.positions[0][1].x')-before)>1
 page.locator('#autoAssemble').click();page.locator('[data-camera="angle"]').click()
 page.locator('#view').focus();before=page.locator('#view').screenshot();page.keyboard.press('ArrowUp');assert before!=page.locator('#view').screenshot()
 page.locator('[data-tab="3"]').click()
 assert page.evaluate('state.data.map(a=>a.length)')==counts
 assert all(str(count) in page.locator('#readout').inner_text() for count in counts)
 with page.expect_download() as download:page.locator('#allCsv').click()
 with open(download.value.path(),encoding='utf-8-sig') as file:
  rows=list(csv.reader(file));assert len(rows)==sum(counts)+1;assert all(len(row)==15 for row in rows)
 with page.expect_download() as download:page.locator('#graphPng').click()
 assert download.value.suggested_filename.endswith('.png')
 page.screenshot(path='/tmp/jaryq-summary.png',full_page=True)
 # Reload retains >25 rows, including IndexedDB fallback when sessionStorage is full.
 page.wait_for_function('labDatabase!==null')
 page.evaluate("sessionStorage.removeItem('jaryq-lab-v2')")
 page.reload(wait_until='domcontentloaded');page.wait_for_function('(counts)=>state.data.every((a,i)=>a.length===counts[i])',arg=counts)
 for t in range(4):
  page.set_viewport_size({'width':390,'height':844});page.locator(f'[data-tab="{t}"]').click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'mobile overflow {t}'
 # All measurements are sent in existing-backend-compatible parts; retry resumes.
 captured=[];failed=[False]
 def submit(route):
  packet=route.request.post_data_json
  captured.append(packet)
  if len(captured)==2 and not failed[0]:
   failed[0]=True;route.fulfill(status=503,body='temporary');return
  route.fulfill(status=200,body='')
 page.route('**/rest/v1/rpc/submit_lab',submit)
 page.locator('#studentName').fill('Сынақ оқушысы');page.locator('#studentClass').fill('11 А');page.locator('#consent').check()
 page.locator('#sendWork').click();page.wait_for_function("!document.querySelector('#sendWork').disabled")
 assert '1/' in page.locator('#sendStatus').inner_text()
 failed_id=captured[1]['submission_id']
 page.locator('#sendWork').click();page.wait_for_function("document.querySelector('#sendStatus').textContent.includes('сәтті')")
 assert captured[2]['submission_id']==failed_id
 unique={packet['submission_id']:packet for packet in captured}
 packets=list(unique.values())
 assert len(packets)==(max(counts)+24)//25
 assert sum(len(packet['measurements']) for packet in packets)==counts[2]
 for t,key in [(0,'interferenceMeasurements'),(1,'diffractionMeasurements')]:
  assert sum(len(json.loads(packet['answers'][key])) for packet in packets)==counts[t]
 assert all(len(packet['measurements'])<=25 and len(json.dumps(packet['answers']).encode())<35000 for packet in packets)
 page.goto('http://127.0.0.1:8000/teacher-portal.html',wait_until='domcontentloaded')
 page.evaluate("""packets=>{works=packets.map((p,i)=>({id:p.submission_id,student_name:p.student_name,student_class:p.student_class,created_at:new Date().toISOString(),answers:p.answers,measurements:p.measurements}));renderWorks();}""",packets)
 assert page.locator('#results>article').count()==1
 assert page.locator('#results table').count()==3
 assert page.locator('#results table tr').count()==sum(counts)+3
 assert not errors,errors
 b.close()
 print('PASS: unlimited append, mixed conditions, 909+ rows, paginated tables, all-row CSV/graphs, colorful spectra, continuous 2D/3D equipment movement, top camera, IndexedDB reload, chunked submission retry, merged teacher results, mobile')
