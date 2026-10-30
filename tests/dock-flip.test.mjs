import test from 'node:test';
import assert from 'node:assert/strict';
import {DockFlip,FLIP_HALF_MS} from '../dock-flip.mjs';

function harness({reduced=false,failCommit=false}={}){
  let mode='ai',serial=0;const pending=new Map(),events=[];
  const flip=new DockFlip({getMode:()=>mode,commit:target=>{events.push(['commit',target]);if(failCommit)throw Error('save failed');mode=target;},prepare:()=>events.push(['prepare']),phaseChanged:p=>events.push(['phase',p]),finished:()=>events.push(['finished']),reduced:()=>reduced,schedule:(fn,ms)=>{const id=++serial;pending.set(id,{fn,ms});return id;},cancel:id=>pending.delete(id)});
  return {flip,pending,events,get mode(){return mode;},tick(){const [id,item]=pending.entries().next().value;pending.delete(id);assert.equal(item.ms,FLIP_HALF_MS);item.fn();}};
}
test('both directions switch mode only at the concealed midpoint, then settle',()=>{
  const h=harness();
  for(const target of ['normal','ai']){
    const before=h.mode;assert.equal(h.flip.change(target),true);
    assert.equal(h.mode,before);assert.equal(h.flip.phase,'out');assert.equal(h.pending.size,1);
    h.tick();assert.equal(h.mode,target);assert.equal(h.flip.phase,'in');assert.equal(h.pending.size,1);
    h.tick();assert.equal(h.flip.active,false);assert.equal(h.flip.phase,'idle');assert.equal(h.pending.size,0);
  }
  assert.deepEqual(h.events.filter(e=>e[0]==='commit'),[['commit','normal'],['commit','ai']]);
});
test('rapid requests cannot create duplicate timers or swap mismatched content',()=>{
  const h=harness();h.flip.change('normal');
  for(let i=0;i<20;i++)assert.equal(h.flip.change(i%2?'ai':'normal'),false);
  assert.equal(h.pending.size,1);h.tick();
  for(let i=0;i<20;i++)assert.equal(h.flip.change('ai'),false);
  h.tick();assert.equal(h.mode,'normal');assert.equal(h.events.filter(e=>e[0]==='commit').length,1);
  assert.equal(h.flip.change('ai'),true);h.tick();h.tick();assert.equal(h.mode,'ai');
});
test('reduced motion changes immediately with no animation phase or timers',()=>{
  const h=harness({reduced:true});h.flip.change('normal');
  assert.equal(h.mode,'normal');assert.equal(h.pending.size,0);assert.equal(h.flip.active,false);
  assert.deepEqual(h.events,[['prepare'],['commit','normal'],['phase','idle'],['finished']]);
  assert.equal(h.flip.change('normal'),false);assert.equal(h.flip.change('invalid'),false);
});
test('reduced-motion changes mid-flight settle once from either half',()=>{
  for(const half of ['out','in']){
    const h=harness();h.flip.change('normal');if(half==='in')h.tick();h.flip.settle();
    assert.equal(h.mode,'normal');assert.equal(h.pending.size,0);assert.equal(h.flip.phase,'idle');
    assert.equal(h.events.filter(e=>e[0]==='commit').length,1);assert.equal(h.flip.active,false);
  }
});
test('a failed midpoint callback releases the lock and leaves no orphan timer',()=>{
  const h=harness({failCommit:true});h.flip.change('normal');assert.throws(()=>h.tick(),/save failed/);
  assert.equal(h.flip.active,false);assert.equal(h.flip.phase,'idle');assert.equal(h.pending.size,0);
});
