from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://fonts.googleapis.com/**',lambda route:route.abort())
 page.goto('http://127.0.0.1:8000/',wait_until='domcontentloaded')
 assert page.locator('#measure').is_disabled()
 # Manual assembly, including wrong slot feedback and keyboard-compatible buttons.
 page.locator('[data-piece="0"]').click();page.locator('[data-slot="1"]').click()
 assert 'басқа' in page.locator('#assemblyStatus').inner_text()
 for i in range(4):
  page.locator(f'[data-piece="{i}"]').click();page.locator(f'[data-slot="{i}"]').click()
 assert page.locator('#measure').is_enabled()
 page.locator('#gapNumber').fill('0.1375')
 assert abs(page.evaluate('state.gap')-.1375)<1e-8
 assert '100.00' in page.locator('#readout').inner_text()
 page.locator('#measure').click()
 assert page.locator('tbody tr').count()==1
 page.locator('.table-value').fill('0.275');page.locator('.table-value').press('Tab')
 assert abs(page.evaluate('state.data[0][0].ratio'))<1e-8
 page.locator('#sweep').click()
 assert page.locator('tbody tr').count()==25
 # Changing a fixed parameter starts a fresh series on manual recording.
 page.locator('#angleNumber').fill('30');page.locator('#measure').click()
 assert page.evaluate('state.data[0].length')==1
 page.locator('#sweep').click()
 for t in [1,2]:
  page.locator(f'[data-tab="{t}"]').click();assert page.locator('#measure').is_disabled()
  page.locator('#autoAssemble').click()
  if t==1:
   page.locator('#positionNumber').fill('1.1');assert page.evaluate('state.position')==1.1
   page.locator('#grating').select_option('1');assert page.locator('#positionNumber').get_attribute('max')=='75'
  else:
   page.locator('#alphaNumber').fill('90');assert '0.00' in page.locator('#readout').inner_text()
  page.locator('#sweep').click();assert page.locator('tbody tr').count()==25
  page.locator('#viewToggle').click();page.locator('#viewToggle').click()
 # Orbit camera changes rendered pixels.
 before=page.locator('#view').screenshot()
 page.locator('#view').focus();page.keyboard.press('ArrowRight')
 assert before!=page.locator('#view').screenshot()
 page.locator('[data-tab="3"]').click()
 assert page.locator('tbody tr').count()==75
 assert page.evaluate('state.data.every(rows=>rows.length===25)')
 with page.expect_download() as d:page.locator('#allCsv').click()
 csv_path=d.value.path()
 import csv
 with open(csv_path,encoding='utf-8-sig') as f:
  rows=list(csv.reader(f));assert len(rows)==76;assert all(len(row)==15 for row in rows)
 with page.expect_download() as d:page.locator('#graphPng').click()
 assert d.value.suggested_filename.endswith('.png')
 page.screenshot(path='/tmp/jaryq-summary.png',full_page=True)
 page.reload(wait_until='domcontentloaded')
 assert page.evaluate('state.data.every(rows=>rows.length===25)')
 for t in range(4):
  page.set_viewport_size({'width':390,'height':844});page.locator(f'[data-tab="{t}"]').click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'mobile overflow {t}'
 # Verify serialization and teacher rendering without writing to a remote database.
 captured=[]
 def submit(route):
  captured.append(route.request.post_data_json)
  route.fulfill(status=200,body='')
 page.route('**/rest/v1/rpc/submit_lab',submit)
 page.locator('#studentName').fill('Сынақ оқушысы');page.locator('#studentClass').fill('11 А');page.locator('#consent').check()
 page.locator('#sendWork').click();page.wait_for_function("document.querySelector('#sendStatus').textContent.includes('сәтті')")
 assert len(captured)==1
 payload=captured[0]
 import json
 assert len(payload['measurements'])==25
 assert len(json.loads(payload['answers']['interferenceMeasurements']))==25
 assert len(json.dumps(payload['answers']).encode())<40000
 page.goto('http://127.0.0.1:8000/teacher-portal.html',wait_until='domcontentloaded')
 page.evaluate("""payload=>{works=[{student_name:'Сынақ',student_class:'11 А',created_at:new Date().toISOString(),answers:payload.answers,measurements:payload.measurements}];renderWorks();}""",payload)
 assert page.locator('#results table').count()==3
 assert page.locator('#results table tr').count()==78
 assert not errors,errors
 b.close()
 print('PASS: manual/auto assembly, numeric inputs, editable tables, 75 measurements, fixed-setting series, 2D/3D, orbit, CSV/PNG, reload persistence, mobile, no JS exceptions')
