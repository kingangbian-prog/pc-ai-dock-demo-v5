// Launcher ownership and visibility only. Task/session/document state lives elsewhere.
export function launcherWindow(kind, key) {
  if(kind==='app') return key==='editor'?'editor':`app-${key}`;
  if(kind==='agent') return `agent-${key}`;
  return kind;
}
export function windowVisible(ui,id) {
  const window=ui.windows.get(id);
  return !!window&&!window.minimized;
}
export function closeWindow(ui,id) {
  const window=ui.windows.get(id);
  if(window)window.minimized=true;
  if(id.startsWith('agent-')){
    const agent=id.slice(6);
    ui.agentSurfaces[agent]='window';
    if(ui.pinnedAgent===agent)ui.pinnedAgent=null;
    ui.suppressedAgents.add(agent);
  }
}
export function toggleWindow(ui,id,open) {
  if(windowVisible(ui,id)){closeWindow(ui,id);return {surface:id,open:false};}
  open(id);
  return {surface:id,open:true};
}
export function toggleStart(ui) {
  ui.launcher=!ui.launcher;
  ui.pinnedAgent=null;
  return {surface:'start',open:ui.launcher};
}
export function claimAgentWindow(ui,agent) {
  ui.agentSurfaces[agent]='window';
  ui.pinnedAgent=null;
  ui.suppressedAgents.add(agent);
}
export function toggleAgent(ui,agent,open,{previewVisible=false}={}) {
  const id=launcherWindow('agent',agent);
  if(windowVisible(ui,id)){
    closeWindow(ui,id);
    return {surface:id,open:false};
  }
  if(ui.pinnedAgent===agent||previewVisible){
    ui.agentSurfaces[agent]='preview';
    ui.pinnedAgent=null;
    ui.suppressedAgents.add(agent);
    return {surface:`preview-${agent}`,open:false};
  }
  if(ui.agentSurfaces[agent]==='window'){
    ui.pinnedAgent=null;
    ui.suppressedAgents.add(agent);
    return toggleWindow(ui,id,open);
  }
  ui.agentSurfaces[agent]='preview';
  ui.suppressedAgents.delete(agent);
  ui.pinnedAgent=agent;
  return {surface:`preview-${agent}`,open:true};
}
// Only actual pointer movement outside the owner releases close suppression.
// Re-rendering a node under a stationary pointer cannot reopen it.
export function releaseAgentHover(ui,agent) { ui.suppressedAgents.delete(agent); }
// Minimized documents still exist. A Computer session remains accessible in every control phase.
export function canDismissTaskHover(windows,session,task){
 if(!task)return false;
 return ![...windows.values()].some(w=>w.task===task&&w.output)&&session?.task!==task;
}
export function runningAppKeys(windows){
 return [...new Set([...windows.values()].map(w=>w.app||(w.id==='editor'?'editor':null)).filter(Boolean))];
}
