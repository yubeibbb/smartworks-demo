/* A separate, deliberately small administrator workspace. */
(() => {
  const D=window.AdminFlowDomain,stage=document.querySelector('#adminWorkspaceStage');
  const keys={qa:smartWorksRecordsKey,meeting:'smartworks-meetings-v1',drawing:'smartworks-drawing-changes-v1',logs:'smartworks-admin-deletions-v1'};
  const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(key,fallback=[])=>{try{const data=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(data)?data:fallback;}catch{return fallback;}};
  const state=()=>({qa:qaUsesDatabase?qaRecords:read(keys.qa,qaRecords),meeting:read(keys.meeting),drawing:read(keys.drawing),logs:read(keys.logs)});
  const rows=()=>{const data=state();return D.catalog(data.qa,data.meeting,data.drawing);};
  const status=item=>item.kind==='meeting'?({pending:'待建设单位审核',published:'已发布',returned:'已退回修改',directed:'已批示'}[item.status]||item.status):item.kind==='drawing'?(window.DrawingChangeDomain.labels[item.status]||item.status):item.status;
  const time=value=>new Date(value).toLocaleString('zh-CN',{hour12:false});
  const selected=new Set();let ready=false,busy=false,pending=null,opener=null,lastProject=null;
  stage.innerHTML=`<header class="admin-heading"><div><small>ADMINISTRATION</small><h2>流程管理</h2><p>查询、删除流程。删除记录独立保留，业务办理在各单位账号中进行。</p></div><button type="button" id="adminRefresh" class="admin-refresh">刷新</button></header><div class="admin-filters"><label>项目<select id="adminProject"><option value="all">全部项目</option></select></label><label>流程类型<select id="adminKind"><option value="all">全部流程</option><option value="qa">工程答疑</option><option value="meeting">会议协调</option><option value="drawing">图纸变更</option></select></label><input id="adminSearch" type="search" aria-label="搜索流程" placeholder="搜索编号、主题或状态"/></div><div class="admin-actions"><span id="adminCount">正在加载流程…</span><button type="button" id="adminDeleteSelected" class="admin-delete-button" disabled>删除所选流程</button><button type="button" id="adminDeleteFiltered" class="admin-delete-all" disabled>删除全部筛选结果</button></div><div class="admin-table-wrap"><table class="admin-table" aria-label="管理员流程列表"><thead><tr><th><input id="adminSelectAll" type="checkbox" aria-label="全选筛选结果"/></th><th>流程类型</th><th>编号 / 主题</th><th>所属项目</th><th>当前状态</th><th>操作</th></tr></thead><tbody id="adminRows"></tbody></table><p id="adminEmpty" class="admin-empty" hidden>没有符合条件的流程。</p></div><p id="adminResult" role="status"></p><details id="adminLog" class="admin-log"><summary id="adminLogSummary">删除记录</summary><div id="adminLogRows"></div></details>`;
  const confirm=document.createElement('div');confirm.className='meeting-backdrop';confirm.hidden=true;
  confirm.innerHTML=`<section class="meeting-dialog admin-confirm" role="dialog" aria-modal="true" aria-labelledby="adminDeleteTitle"><header><div><small>管理后台</small><h2 id="adminDeleteTitle">确认删除流程</h2></div><button type="button" id="adminDeleteClose" aria-label="关闭删除确认">×</button></header><form id="adminDeleteForm"><div class="meeting-dialog-body"><p id="adminDeleteNote" class="admin-confirm-note"></p><div class="admin-confirm-list"><table aria-label="待删除流程"><tbody id="adminDeletePreview"></tbody></table></div><label class="meeting-review-label">删除原因（必填）<textarea id="adminDeleteReason" maxlength="1000" rows="3" required placeholder="填写本次删除的原因"></textarea></label><p id="adminDeleteError" role="alert"></p></div><footer><button type="button" id="adminDeleteCancel">取消</button><button type="submit" id="adminDeleteConfirm" class="meeting-primary">确认删除</button></footer></form></section>`;
  document.body.append(confirm);
  const nav=document.createElement('button');nav.type='button';nav.className='admin-nav-entry';nav.dataset.adminEntry='true';nav.textContent='流程管理';nav.hidden=true;document.querySelector('.primary-menu').append(nav);
  function visible(){const project=$('adminProject').value,kind=$('adminKind').value,term=$('adminSearch').value.trim().toLowerCase();return rows().filter(row=>(project==='all'||row.project===project)&&(kind==='all'||row.kind===kind)&&(!term||[row.no,row.title,row.project,status(row)].join(' ').toLowerCase().includes(term)));}
  function render(){
    if(!currentUser().admin){stage.hidden=true;$('adminRows').innerHTML='';$('adminLogRows').innerHTML='';return;}
    if(!ready)return;
    const all=rows(),data=visible();for(const id of selected)if(!all.some(row=>row.key===id))selected.delete(id);
    $('adminCount').textContent='共 '+data.length+' 条流程 · 已选 '+selected.size+' 条';
    $('adminRows').innerHTML=data.map(row=>`<tr><td><input type="checkbox" data-admin-select="${esc(row.key)}" aria-label="选择 ${esc(row.no)}" ${selected.has(row.key)?'checked':''}/></td><td>${esc(D.labels[row.kind])}</td><td><small>${esc(row.no)}</small><strong>${esc(row.title)}</strong></td><td>${esc(row.project)}</td><td>${esc(status(row))}</td><td><button type="button" class="admin-row-delete" data-admin-delete="${esc(row.key)}">删除</button></td></tr>`).join('');
    $('adminEmpty').hidden=data.length>0;$('adminDeleteSelected').disabled=!selected.size||busy;$('adminDeleteFiltered').disabled=!data.length||busy;
    $('adminSelectAll').checked=Boolean(data.length&&data.every(row=>selected.has(row.key)));$('adminSelectAll').indeterminate=data.some(row=>selected.has(row.key))&&!$('adminSelectAll').checked;
    const logs=read(keys.logs);$('adminLogSummary').textContent='删除记录（'+logs.length+' 次）';
    $('adminLogRows').innerHTML=logs.map(log=>`<article class="admin-log-entry"><b>${esc(log.actor)} · 删除 ${log.count} 条流程</b><small> · ${esc(time(log.time))}</small><p>原因：${esc(log.reason)}</p><details><summary>查看被删除的流程</summary><ul>${log.items.map(row=>`<li>${esc(row.project)} · ${esc(D.labels[row.kind])} · ${esc(row.no)} · ${esc(row.title)}（${esc(status(row))}）</li>`).join('')}</ul></details></article>`).join('')||'<p class="admin-empty">暂无删除记录。</p>';
  }
  function close(){if(busy)return;confirm.hidden=true;pending=null;document.body.classList.toggle('meeting-modal-open',Boolean(document.querySelector('.meeting-backdrop:not([hidden])')));opener?.focus();}
  function review(ids){
    if(!currentUser().admin||!ready||busy)return;
    try{
      const result=D.plan(rows(),ids);pending={ids,items:result.items,account:currentAccountId,fingerprint:JSON.stringify(result.items)};opener=document.activeElement;
      $('adminDeleteNote').textContent='即将删除 '+result.items.length+' 条流程'+(result.linked?'，其中包含 '+result.linked+' 条关联会议或图纸变更':'')+'。相关待办和通知会同步移除，删除记录及原始流程快照会保留。';
      $('adminDeletePreview').innerHTML=result.items.map(row=>`<tr><td>${esc(D.labels[row.kind])}</td><td>${esc(row.no)}<br>${esc(row.title)}</td><td>${esc(row.project)}</td></tr>`).join('');
      $('adminDeleteReason').value='';$('adminDeleteError').textContent='';$('adminDeleteConfirm').textContent='确认删除 '+result.items.length+' 条流程';confirm.hidden=false;document.body.classList.add('meeting-modal-open');$('adminDeleteReason').focus();
    }catch(error){$('adminResult').textContent=error.message;render();}
  }
  async function commit(){
    if(busy||!pending)return;busy=true;$('adminDeleteConfirm').disabled=true;
    try{
      const run=async()=>{
        if(!currentUser().admin||pending.account!==currentAccountId)throw Error('账号已变化，请重新打开管理后台。');
        const data=state(),latest=D.plan(D.catalog(data.qa,data.meeting,data.drawing),pending.ids);
        if(JSON.stringify(latest.items)!==pending.fingerprint)throw Error('流程已被更新，请关闭此窗口后重新选择。');
        const result=D.deletion(data.qa,data.meeting,data.drawing,pending.ids,currentUser(),currentAccountId,$('adminDeleteReason').value,crypto.randomUUID());
        const previous=new Map(Object.values(keys).map(key=>[key,localStorage.getItem(key)]));let remoteSaved=false;
        try{
          localStorage.setItem(keys.logs,JSON.stringify([result.log,...data.logs]));
          if(qaUsesDatabase&&result.qa.length!==data.qa.length){const response=await fetch(qaDatabaseEndpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({records:result.qa})});if(!response.ok)throw Error('工程答疑删除未能保存，请重试。');remoteSaved=true;}
          if(!qaUsesDatabase)localStorage.setItem(keys.qa,JSON.stringify(result.qa));
          localStorage.setItem(keys.meeting,JSON.stringify(result.meetings));localStorage.setItem(keys.drawing,JSON.stringify(result.drawings));qaRecords=result.qa;
        }catch(error){for(const [key,value] of previous){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}if(remoteSaved)await fetch(qaDatabaseEndpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({records:data.qa})});throw error;}
        return result.log.count;
      };
      const count=await(navigator.locks?navigator.locks.request('smartworks-admin-delete',run):run());
      busy=false;close();selected.clear();$('adminResult').textContent='已删除 '+count+' 条流程，删除记录已保存。';render();renderQa();renderMatterPanel();window.renderMeetings?.();window.renderDrawingChanges?.();
    }catch(error){$('adminDeleteError').textContent=error.message;}finally{busy=false;$('adminDeleteConfirm').disabled=false;render();}
  }
  function resetFilters(){selected.clear();render();}
  $('adminProject').addEventListener('change',resetFilters);$('adminKind').addEventListener('change',resetFilters);$('adminSearch').addEventListener('input',resetFilters);$('adminRefresh').addEventListener('click',()=>{selected.clear();render();});
  $('adminSelectAll').addEventListener('change',()=>{visible().forEach(row=>{if($('adminSelectAll').checked)selected.add(row.key);else selected.delete(row.key);});render();});
  $('adminRows').addEventListener('change',event=>{const id=event.target.dataset.adminSelect;if(id){if(event.target.checked)selected.add(id);else selected.delete(id);render();}});
  $('adminRows').addEventListener('click',event=>{const button=event.target.closest('[data-admin-delete]');if(button)review([button.dataset.adminDelete]);});
  $('adminDeleteSelected').addEventListener('click',()=>review([...selected]));$('adminDeleteFiltered').addEventListener('click',()=>review(visible().map(row=>row.key)));
  $('adminDeleteForm').addEventListener('submit',event=>{event.preventDefault();commit();});$('adminDeleteClose').addEventListener('click',close);$('adminDeleteCancel').addEventListener('click',close);
  confirm.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}if(event.key==='Tab'){const controls=[...confirm.querySelectorAll('button,textarea')].filter(el=>!el.disabled&&el.getClientRects().length);if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}}});
  window.openAdminWorkspace=()=>{
    if(!currentUser().admin)return;
    switchArea('business');document.querySelectorAll('.business-stage > [id]').forEach(element=>element.hidden=element!==stage);stage.hidden=false;
    document.querySelector('.open-tabs').innerHTML='';document.querySelector('.business-head p').textContent='管理后台 · 流程管理';nav.classList.add('active');primaryMenus.forEach(button=>button.classList.remove('active'));
    if(lastProject!==currentProject){$('adminProject').innerHTML='<option value="all">全部项目</option>'+smartWorksProjects.map(project=>'<option value="'+esc(project)+'">'+esc(project)+'</option>').join('');$('adminProject').value=currentProject;selected.clear();lastProject=currentProject;}
    render();
  };
  nav.addEventListener('click',()=>window.openAdminWorkspace());
  window.syncAdminWorkspace=()=>{
    const admin=Boolean(currentUser().admin),wasAdmin=document.body.classList.contains('admin-mode');window.smartWorksIsAdmin=admin;document.body.classList.toggle('admin-mode',admin);nav.hidden=!admin;
    businessButton.textContent=admin?'管理后台':'业务栏';document.querySelector('.primary-menu-title').textContent=admin?'管理后台':'业务栏';businessContent.setAttribute('aria-label',admin?'管理后台':'业务栏');document.querySelector('[data-account-action="settings"]').textContent=admin?'管理后台':'设置';
    if(admin)window.openAdminWorkspace();else{if(!confirm.hidden&&!busy)close();stage.hidden=true;if(wasAdmin)openBusinessDirectory('项目信息','项目看板');render();}
  };
  window.openAdminFlowDeletion=no=>{if(!currentUser().admin)return;window.openAdminWorkspace();const row=rows().find(item=>item.kind==='qa'&&item.id===no);if(row)review([row.key]);};
  window.renderAdminWorkspace=render;
  window.addEventListener('storage',event=>{if(Object.values(keys).includes(event.key))render();});
  window.syncAdminWorkspace();
  window.smartWorksAdminReady=(async()=>{await window.smartWorksDemoReady;await window.smartWorksQaReady;ready=true;render();})();
})();
