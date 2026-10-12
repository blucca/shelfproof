"""One real browser flow, with the bundled fictional raster PDF. Requires Playwright and a running CDP browser."""
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright, expect

async def main():
 parser=argparse.ArgumentParser()
 parser.add_argument('--url',default='http://127.0.0.1:8138/')
 parser.add_argument('--cdp',default='http://127.0.0.1:19222')
 parser.add_argument('--out',default='temp/shelfproof-smoke')
 args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 result={'url':args.url,'errors':[],'requests':[]}
 async with async_playwright() as p:
  browser=await p.chromium.connect_over_cdp(args.cdp)
  page=await browser.contexts[0].new_page()
  page.on('pageerror',lambda error:result['errors'].append(str(error)))
  page.on('request',lambda request:result['requests'].append({'method':request.method,'url':request.url}))
  await page.set_viewport_size({'width':1440,'height':1000})
  try:
   await page.goto(args.url,wait_until='networkidle',timeout=45000)
   await page.evaluate('document.fonts.ready')
   await page.screenshot(path=str(out/'home-desktop.png'),full_page=True)
   await page.evaluate('''() => {
     window.ocrRuns=[];
     const create=Tesseract.createWorker;
     Tesseract.createWorker=async (...args)=>{
       const worker=await create(...args), recognize=worker.recognize;
       worker.recognize=async (...inputs)=>{const result=await recognize(...inputs);window.ocrRuns.push({text:result.data.text,tsv:result.data.tsv});return result;};
       return worker;
     };
   }''')
   await page.get_by_role('button',name='Try the sample proof',exact=True).click()
   await page.wait_for_function("!document.getElementById('results').hidden || !document.getElementById('error').hidden",timeout=120000)
   assert await page.locator('#error').is_hidden(),await page.locator('#error').inner_text()
   await expect(page.locator('#results')).to_be_visible()
   result['rows']=await page.locator('.sku-row').evaluate_all('(nodes)=>nodes.map(n=>({text:n.innerText,status:n.className}))')
   result['ocr']=await page.evaluate('window.ocrRuns')
   result['summary']=await page.locator('#summary').inner_text()
   result['error_text']=await page.locator('#error').inner_text()
   await page.screenshot(path=str(out/'review-desktop.png'),full_page=True)
   assert len(result['rows'])==7,result['rows']
   states=[r['status'] for r in result['rows']]
   assert states[0] in ('sku-row review','sku-row mismatch'),states
   assert states[1:]==['sku-row mismatch','sku-row match','sku-row match','sku-row match','sku-row mismatch','sku-row notFound'],states
   await expect(page.locator('#observed-price')).to_have_value('12.00')
   await page.get_by_role('button',name='Choose a price area',exact=True).click()
   await page.locator('#proof-stage').scroll_into_view_if_needed()
   box=await page.locator('#proof-overlay').bounding_box()
   x=lambda v:box['x']+v*box['width']/1400
   y=lambda v:box['y']+v*box['height']/1800
   await page.mouse.move(x(425),y(598));await page.mouse.down()
   await page.mouse.move(x(656),y(677),steps=4);await page.mouse.up()
   await expect(page.locator('#message')).to_have_text('Price area read. Confirm the value beside the selected SKU.',timeout=45000)
   await expect(page.locator('#observed-price')).to_have_value('12.00')
   await page.get_by_role('button',name='Confirm reading',exact=True).click()
   await expect(page.locator('#review-count')).to_have_text('1 of 7 SKU decisions confirmed by you.')
   for index,price in [(1,'8.50'),(2,'14.50'),(3,'18.00'),(4,'6.75'),(5,'23.00')]:
    await page.locator(f'[data-row="{index}"]').click()
    await expect(page.locator('#observed-price')).to_have_value(price)
    await page.get_by_role('button',name='Confirm reading',exact=True).click()
   await page.locator('[data-row="6"]').click()
   await page.get_by_role('button',name='Mark SKU missing from artwork',exact=True).click()
   await expect(page.locator('#review-count')).to_have_text('7 of 7 SKU decisions confirmed by you.')
   async with page.expect_download() as pending:
    await page.get_by_role('button',name='Download review',exact=True).click()
   download=await pending.value
   await download.save_as(out/'shelfproof-review.html')
   report=(out/'shelfproof-review.html').read_text()
   assert report.count('<section>')==7
   assert 'Fictional sample / seeded price errors' in report
   assert '7 of 7 decisions confirmed' in report
   assert 'data:image/png;base64,' in report
   assert 'Original OCR: $12.00' in report
   result['export']={'sections':7,'bytes':len(report),'source_crops':report.count('data:image/png;base64,'),'confirmed':7}
   result['final_summary']=await page.locator('#summary').inner_text()
   await page.set_viewport_size({'width':390,'height':844})
   await page.locator('[data-row="0"]').click()
   await page.screenshot(path=str(out/'review-mobile.png'),full_page=True)
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile width overflow'
   result['mobile_width']=True
   await page.get_by_role('button',name='Start another proof',exact=True).click()
   await page.screenshot(path=str(out/'home-mobile.png'),full_page=True)
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile home overflow'
   assert not result['errors'],result['errors']
   result['state']='passed'
  finally:
   if 'ocr' not in result:
    try: result['ocr']=await page.evaluate('window.ocrRuns')
    except Exception: pass
   result['page_url']=page.url
   (out/'receipt.json').write_text(json.dumps(result,indent=2)+'\n')
   print(json.dumps({k:v for k,v in result.items() if k not in ('requests','ocr')}))

asyncio.run(main())
