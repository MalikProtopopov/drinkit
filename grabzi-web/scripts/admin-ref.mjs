import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
const APP='http://localhost:3007';
const OUT=resolve(process.cwd(),'../docs/screens/grabzi-admin');
mkdirSync(OUT,{recursive:true});
const TOK=process.env.ADMIN||'';
const routes=[
  ['adm-login','/admin/login', false],
  ['adm-dashboard','/admin', true],
  ['adm-orders','/admin/orders', true],
  ['adm-catalog-products','/admin/catalog/products', true],
  ['adm-catalog-addons','/admin/catalog/addons', true],
  ['adm-catalog-groups','/admin/catalog/groups', true],
  ['adm-catalog-categories','/admin/catalog/categories', true],
  ['adm-outlets','/admin/outlets', true],
  ['adm-customers','/admin/customers', true],
  ['adm-payments','/admin/payments', true],
  ['adm-coupons','/admin/coupons', true],
  ['adm-staff','/admin/staff', true],
];
const b=await chromium.launch({channel:'chrome'});
for(const [slug,path,auth] of routes){
  const ctx=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const p=await ctx.newPage();
  if(auth){ await p.goto(APP+'/',{waitUntil:'domcontentloaded'}).catch(()=>{});
    await p.evaluate(t=>localStorage.setItem('juicy-staff-token',t),TOK); }
  try{ await p.goto(APP+path,{waitUntil:'networkidle',timeout:30000}); }
  catch{ await p.goto(APP+path,{waitUntil:'domcontentloaded'}).catch(()=>{}); }
  await p.waitForTimeout(1800);
  await p.screenshot({path:`${OUT}/${slug}.png`,fullPage:true});
  const t=await p.evaluate(()=>document.body.innerText.slice(0,60).replace(/\n/g,' '));
  console.log(slug, '=>', JSON.stringify(t));
  await ctx.close();
}
await b.close(); console.log('done',OUT);
