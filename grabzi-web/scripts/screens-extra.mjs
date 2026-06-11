import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
const BASE='http://localhost:3001';
const OUT=resolve(process.cwd(),'../docs/screens/grabzi');
mkdirSync(OUT,{recursive:true});
const CUST=process.env.CUST||'', EMPTY=process.env.EMPTY||'';
const b=await chromium.launch({channel:'chrome'});
async function shot(slug, path, {token, failApi}={}) {
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const p=await ctx.newPage();
  if(token){ await p.goto(BASE+'/',{waitUntil:'domcontentloaded'}).catch(()=>{});
    await p.evaluate(t=>localStorage.setItem('grabzi_token',t),token); }
  if(failApi) await p.route('**/api/drinks**', r=>r.abort());
  try{ await p.goto(BASE+path,{waitUntil:'networkidle',timeout:30000}); }
  catch{ await p.goto(BASE+path,{waitUntil:'domcontentloaded'}).catch(()=>{}); }
  await p.waitForTimeout(1800);
  await p.screenshot({path:`${OUT}/${slug}.png`,fullPage:true});
  const t=await p.evaluate(()=>document.body.innerText.slice(0,70).replace(/\n/g,' '));
  console.log(slug,'=>',JSON.stringify(t));
  await ctx.close();
}
await shot('order-status--making', '/orders/3', {token:CUST});   // in_progress + I'm here btn
await shot('order-status--ready',  '/orders/4', {token:CUST});   // ready + I'm here btn
await shot('orders--empty',        '/orders',   {token:EMPTY});  // signed-in, no orders
await shot('product--error',       '/product/no-such-drink-xyz');// not found
await shot('admin-kitchen--session-expired', '/admin/kitchen');  // no staff token
// order load error (abort drinks) — need a location in draft; set draft then fail api
{
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const p=await ctx.newPage();
  await p.goto(BASE+'/',{waitUntil:'domcontentloaded'}).catch(()=>{});
  await p.evaluate(()=>localStorage.setItem('grabzi-draft',JSON.stringify({state:{locationId:1,items:{}},version:1})));
  await p.route('**/api/drinks**', r=>r.abort());
  try{ await p.goto(BASE+'/order',{waitUntil:'networkidle',timeout:20000}); }catch{}
  await p.waitForTimeout(1500);
  await p.screenshot({path:`${OUT}/order--error.png`,fullPage:true});
  console.log('order--error done'); await ctx.close();
}
await b.close(); console.log('extra done');
