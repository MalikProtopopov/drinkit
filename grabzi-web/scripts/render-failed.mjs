import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const OUT = resolve(process.cwd(), '../docs/screens/diagrams');
const list=['d5','d7','d11','d13','d14','d15','d17','d19'];
const mermaidSrc = readFileSync('/tmp/mermaid.min.js','utf-8');
const b = await chromium.launch({channel:'chrome'});
let stillFail=[];
for(const n of list){
  const code=readFileSync(`/tmp/mmd/${n}.txt`,'utf-8');
  const ctx=await b.newContext({viewport:{width:1600,height:1200},deviceScaleFactor:2});
  const p=await ctx.newPage();
  await p.setContent('<!doctype html><html><body style="margin:0;background:#fff"><div id="c" style="display:inline-block;background:#fff;padding:18px"></div></body></html>');
  await p.addScriptTag({content:mermaidSrc});
  const res=await p.evaluate(async(code)=>{ try{
    window.mermaid.initialize({startOnLoad:false,theme:'default',securityLevel:'loose',flowchart:{useMaxWidth:false},sequence:{useMaxWidth:false}});
    const {svg}=await window.mermaid.render('g',code); document.getElementById('c').innerHTML=svg; return {ok:true};
  }catch(e){return {ok:false,err:String(e).slice(0,120)};}},code);
  if(res.ok){ await p.waitForTimeout(250); await (await p.$('#c')).screenshot({path:`${OUT}/${n}.png`}); console.log('OK',n);}
  else { stillFail.push(n); console.log('STILL-FAIL',n,res.err); }
  await ctx.close();
}
await b.close();
console.log('still failing:', stillFail.join(',')||'none');
