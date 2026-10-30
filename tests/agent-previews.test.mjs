import test from 'node:test';
import assert from 'node:assert/strict';
import {AGENT_ORDER,seedState,ensureAgentDemoTasks,loadState,STORAGE_KEY} from '../model.mjs';

test('a fresh session has three distinct simulated tasks for each Dock Agent',()=>{
 const s=seedState();
 for(const agent of AGENT_ORDER){const tasks=s.tasks.filter(t=>t.agent===agent);assert.equal(tasks.length,3);assert.equal(new Set(tasks.map(t=>t.id)).size,3);assert.equal(new Set(tasks.map(t=>t.title)).size,3);for(const t of tasks)assert.ok(s.goals.some(g=>g.id===t.goal));}
});
test('old sessions receive stable missing tasks without changing existing user state',()=>{
 const old=seedState();old.tasks=old.tasks.filter(t=>!t.demo);old.tasks.push({id:'user-task',agent:'writer',goal:'launch',title:'用户任务',status:'paused',instructions:[{text:'用户补充'}]});old.drafts.personal.text='用户编辑原文';old.session.controller='human';old.session.phase='human';
 const before=structuredClone(old),next=ensureAgentDemoTasks(old);
 assert.deepEqual(old,before);for(const task of before.tasks)assert.deepEqual(next.tasks.find(t=>t.id===task.id),task);
 assert.deepEqual(next.drafts,before.drafts);assert.deepEqual(next.outputs,before.outputs);assert.deepEqual(next.goals,before.goals);assert.deepEqual(next.session,before.session);
 for(const agent of AGENT_ORDER)assert.equal(next.tasks.filter(t=>t.agent===agent).length,3);
 assert.equal(ensureAgentDemoTasks(next),next);assert.equal(new Set(next.tasks.map(t=>t.id)).size,next.tasks.length);
});
test('populated Agents receive no extra tasks and reserved ID collisions are not overwritten',()=>{
 const s=seedState();assert.equal(ensureAgentDemoTasks(s),s);
 s.tasks=s.tasks.filter(t=>t.agent!=='design');s.tasks.push({id:'demo-hover-design-icons',agent:'writer',goal:'desktop',title:'保留原记录',status:'failed'});
 const next=ensureAgentDemoTasks(s);assert.deepEqual(next.tasks.find(t=>t.id==='demo-hover-design-icons'),s.tasks.at(-1));assert.equal(next.tasks.filter(t=>t.agent==='design').length,2);
});
test('loading and reloading an old saved session injects missing cards only once',()=>{
 const old=seedState();old.tasks=old.tasks.filter(t=>!t.demo);const store=new Map([[STORAGE_KEY,JSON.stringify(old)]]);let writes=0;
 const storage={getItem:k=>store.get(k),setItem:(k,v)=>{writes++;store.set(k,v);}};
 const first=loadState(storage),second=loadState(storage);assert.deepEqual(first,second);assert.equal(writes,1);for(const agent of AGENT_ORDER)assert.equal(second.tasks.filter(t=>t.agent===agent).length,3);
});
