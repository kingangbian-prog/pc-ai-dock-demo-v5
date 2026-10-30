import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState,reduce} from '../model.mjs';
import {launcherWindow,windowVisible,closeWindow,toggleWindow,toggleStart,claimAgentWindow,toggleAgent,releaseAgentHover} from '../surfaces.mjs';

function fixture(){
  const ui={windows:new Map(),launcher:false,pinnedAgent:null,agentSurfaces:{},suppressedAgents:new Set(),activeTasks:{research:'research-main'},botInput:'还没发送的指令',manual:'尚未保存的人工输入',activeDraft:'output-seed'};
  const open=id=>{const w=ui.windows.get(id)||{id,x:64,y:118,w:800,h:500};w.minimized=false;ui.windows.set(id,w);};
  return {ui,open};
}
test('Bot icon cycles open/close/reopen and keeps the same window and unsent text',()=>{
  const {ui,open}=fixture();
  assert.equal(toggleWindow(ui,'bot',open).open,true);const w=ui.windows.get('bot');
  assert.equal(toggleWindow(ui,'bot',open).open,false);assert.equal(windowVisible(ui,'bot'),false);
  assert.equal(toggleWindow(ui,'bot',open).open,true);assert.equal(ui.windows.get('bot'),w);
  assert.equal(ui.botInput,'还没发送的指令');
  for(let i=0;i<20;i++)toggleWindow(ui,'bot',open);
  assert.equal(windowVisible(ui,'bot'),true);assert.equal(ui.windows.size,1);
});
test('a minimized/closed app is reopened by the same launcher, never duplicated',()=>{
  const {ui,open}=fixture();const id=launcherWindow('app','files');open(id);closeWindow(ui,id);
  assert.equal(toggleWindow(ui,id,open).open,true);assert.equal(ui.windows.size,1);
  assert.equal(toggleWindow(ui,id,open).open,false);
});
test('Start icon open/close/reopen stays a single popup',()=>{
  const {ui}=fixture();assert.equal(toggleStart(ui).open,true);assert.equal(toggleStart(ui).open,false);
  assert.equal(toggleStart(ui).open,true);assert.equal(ui.windows.size,0);
});
test('Agent click popup closes with hover suppression and an explicit click can reopen it',()=>{
  const {ui,open}=fixture();
  assert.deepEqual(toggleAgent(ui,'research',open),{surface:'preview-research',open:true});
  assert.equal(toggleAgent(ui,'research',open).open,false);assert.ok(ui.suppressedAgents.has('research'));
  assert.equal(ui.pinnedAgent,null);assert.equal(toggleAgent(ui,'research',open).open,true);
  assert.equal(ui.suppressedAgents.has('research'),false);assert.equal(ui.windows.size,0);
});
test('clicking an already hover-open preview closes it until pointer leaves or an intentional click',()=>{
  const {ui,open}=fixture();
  assert.equal(toggleAgent(ui,'research',open,{previewVisible:true}).open,false);
  assert.ok(ui.suppressedAgents.has('research'));
  releaseAgentHover(ui,'research');assert.equal(ui.suppressedAgents.has('research'),false);
  toggleAgent(ui,'research',open,{previewVisible:true});
  assert.equal(toggleAgent(ui,'research',open,{previewVisible:false}).open,true);
});
test('a task card owns the Agent window; same icon closes/reopens its exact current task',()=>{
  const {ui,open}=fixture();claimAgentWindow(ui,'research');open('agent-research');
  assert.deepEqual(toggleAgent(ui,'research',open,{previewVisible:true}),{surface:'agent-research',open:false});
  assert.equal(ui.pinnedAgent,null);assert.ok(ui.suppressedAgents.has('research'));
  assert.deepEqual(toggleAgent(ui,'research',open),{surface:'agent-research',open:true});
  assert.equal(ui.activeTasks.research,'research-main');assert.equal(ui.windows.size,1);
});
test('Computer UI closing preserves human controller, session, saved and unsaved context',()=>{
  const {ui,open}=fixture();let state=reduce(seedState(),{type:'TAKEOVER'},1000);state=reduce(state,{type:'TICK'},2400);
  ui.business=state;const snapshot=structuredClone(state);const note=ui.manual;
  open('computer');toggleWindow(ui,'computer',open);toggleWindow(ui,'computer',open);
  assert.equal(windowVisible(ui,'computer'),true);assert.deepEqual(ui.business,snapshot);
  assert.equal(ui.business.session.controller,'human');assert.equal(ui.business.session.phase,'human');assert.equal(ui.manual,note);
});
test('ordinary editor aliases share one surface and preserve the active output draft',()=>{
  const {ui,open}=fixture();const id=launcherWindow('app','editor');assert.equal(id,'editor');
  open(id);const state=reduce(seedState(),{type:'OPEN_DRAFT',output:'output-seed'});ui.business=state;
  const before=structuredClone(state);toggleWindow(ui,id,open);toggleWindow(ui,id,open);
  assert.equal(ui.activeDraft,'output-seed');assert.deepEqual(ui.business,before);assert.equal(ui.windows.size,1);
});
