import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
const OUT = resolve(process.cwd(), '../docs/screens/diagrams');
const MMD = '/tmp/mmd';
const files = readdirSync(MMD).filter(f=>f.endsWith('.txt')).sort((a,b)=>parseInt(a.slice(1))-parseInt(b.slice(1)));
const mermaidSrc = readFileSync('/tmp/mermaid.min.js','utf-8');
const b = await chromium.launch({channel:'chrome'});
let ok=0, fail=[];
for (const f of files){
  const n = f.replace('.txt','');
  const code = readFileSync(`${MMD}/${f}`,'utf-8');
  const ctx = await b.newContext({viewport:{width:1600,height:1200},deviceScaleFactor:2});
  const p = await ctx.newPage();
  await p.setContent('<!doctype html><html><body style="margin:0;background:#fff"><div id="c" style="display:inline-block;background:#fff;padding:18px"></div></body></html>');
  await p.addScriptTag({content: mermaidSrc});
  const res = await p.evaluate(async (code)=>{
    try{
      window.mermaid.initialize({startOnLoad:false, theme:'default', securityLevel:'loose',
        flowchart:{useMaxWidth:false, htmlLabels:true}, sequence:{useMaxWidth:false}, er:{useMaxWidth:false}});
      const {svg} = await window.mermaid.render('g', code);
      document.getElementById('c').innerHTML = svg;
      return {ok:true};
    }catch(e){ return {ok:false, err:String(e).slice(0,160)}; }
  }, code);
  if(res.ok){
    await p.waitForTimeout(250);
    const el = await p.$('#c');
    await el.screenshot({path:`${OUT}/${n}.png`});
    ok++;
  } else { fail.push([n,res.err]); console.log('FAIL',n,res.err); }
  await ctx.close();
}
await b.close();
console.log(`rendered ${ok}/${files.length}; failed:`, fail.map(x=>x[0]).join(',')||'none');
