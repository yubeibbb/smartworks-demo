/* Local, shared-browser meeting coordination prototype. No external messages are sent. */
(() => {
  const D = window.MeetingDomain, key = 'smartworks-meetings-v1';
  const stage = document.querySelector('#meetingStage');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {pending:'待建设单位审核',published:'已预约 · 已发布',returned:'已退回修改',directed:'已逐项批示 · 不召开会议'};
  const coordinationSelection = new Set();
  let records = [], editingId = null, opener = null, openedAccount = null, openedProject = null;
  function load() { try { const saved=JSON.parse(localStorage.getItem(key)||'[]'); records=Array.isArray(saved)?saved.filter(r=>r&&r.id&&r.project&&typeof r.title==='string'&&typeof r.location==='string'&&Array.isArray(r.history)&&Array.isArray(r.issueIds)&&Array.isArray(r.attendees)&&['pending','published','returned','directed'].includes(r.status)):[]; } catch {records=[];} }
  load();
  const units = () => [...new Set(Object.values(smartWorksUsers).map(user=>user.unit).filter(unit=>unit!=='系统管理员'))];
  const issues = () => qaRecords.filter(issue=>issue.project===currentProject && D.unresolved(issue));
  const canEdit = row => !row || (row.status==='pending'&&D.isReviewer(currentUser())) || (row.status==='returned'&&row.creatorId===currentAccountId);
  const format = time => time ? new Date(time).toLocaleString('zh-CN',{hour12:false}) : '—';
  function persist(next) {
    localStorage.setItem(key,JSON.stringify(next)); records=next;
    render(); renderMatterPanel();
  }
  const dialog = document.createElement('div');
  dialog.className='meeting-backdrop';dialog.hidden=true;
  dialog.innerHTML=`<section class="meeting-dialog" role="dialog" aria-modal="true" aria-labelledby="meetingDialogTitle"><header><div><small>设计管理 / 会议协调</small><h2 id="meetingDialogTitle">新增会议预约</h2></div><button type="button" id="meetingClose" aria-label="关闭会议单">×</button></header><form id="meetingForm"><div class="meeting-dialog-body"><div id="meetingFlow" class="meeting-flow"></div><div id="meetingIdentity" class="meeting-identity"></div><div class="meeting-fields"><label class="full">会议主题<input id="meetingTitle" required maxlength="100" placeholder="例如：地下室机电与结构争议问题协调会" /></label><label class="full">会议时间<input id="meetingStart" type="datetime-local" required /></label><label class="full">会议地点<input id="meetingLocation" required maxlength="160" placeholder="请输入会议室、现场位置或线上会议地址" /></label><label class="full">会议说明<textarea id="meetingDescription" maxlength="1500" rows="3" placeholder="说明问题分歧、协调目标和需准备的资料"></textarea></label></div><fieldset><legend>关联工程答疑问题 <span>可勾选多项，不改变原问题状态</span></legend><div id="meetingIssueChoices" class="meeting-issues"></div></fieldset><fieldset><legend>参会单位</legend><div id="meetingAttendees" class="meeting-unit-choices"></div></fieldset><label class="meeting-review-label" id="meetingReviewLabel">审核意见 / 退回原因<textarea id="meetingReviewNote" rows="2" maxlength="800" placeholder="退回时必须填写原因"></textarea></label><div class="meeting-notice-note">建设单位审核通过即预约成功，系统向当前项目所有账号分发站内待读通知，无需参会单位确认。</div><section class="meeting-history"><h3>流转记录</h3><div id="meetingHistory"></div></section><p id="meetingError" role="alert"></p></div><footer><button type="button" id="meetingCancel">关闭</button><button type="button" class="meeting-return" id="meetingReturn">退回修改</button><button type="submit" class="meeting-primary" id="meetingSubmit">提交建设单位审核</button></footer></form></section>`;
  document.body.append(dialog);
  const $ = id => document.getElementById(id);
  const value = (id,val) => {$(id).value=val||'';};
  function close(){dialog.hidden=true;document.body.classList.remove('meeting-modal-open');opener?.focus();}
  $('meetingClose').addEventListener('click',close);$('meetingCancel').addEventListener('click',close);

  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='Tab'){const controls=[...dialog.querySelectorAll('button,input,textarea')].filter(e=>!e.disabled&&e.getClientRects().length);if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}}
  });
  function choices(host, selected, disabled) {
    host.innerHTML=units().map(unit=>`<label><input type="checkbox" value="${esc(unit)}" ${selected.includes(unit)?'checked':''} ${disabled?'disabled':''}/><span>${esc(unit)}</span></label>`).join('');
  }
  function open(id=null, preselected=null) {
    const row=records.find(r=>r.id===id);
    if(id&&(!row||row.project!==currentProject))return;
    editingId=id;openedAccount=currentAccountId;openedProject=currentProject;opener=document.activeElement;
    if(['published','directed'].includes(row?.status)&&row.recipients?.includes(currentAccountId)&&!row.readBy?.[currentAccountId]) {
      const next=records.map(item=>item.id===id?{...item,readBy:{...item.readBy,[currentAccountId]:new Date().toISOString()}}:item);
      try{persist(next);}catch{$('meetingError').textContent='读取状态未能保存，请重试。';}
    }
    const editable=canEdit(row),review=Boolean(row?.status==='pending'&&D.isReviewer(currentUser()));
    $('meetingDialogTitle').textContent=!row?'新增会议预约':review?'审核会议预约':row.status==='directed'?'业主批示单':row.status==='returned'&&editable?'修改会议预约':'会议预约单';
    $('meetingFlow').innerHTML=['发起预约','建设单位审核',row?.status==='directed'?'逐项批示并通知':'发布会议通知'].map((name,index)=>`<span class="${!row?index===0?'current':'':['published','directed'].includes(row.status)?'complete':index===(row.status==='returned'?0:1)?'current':''}"><b>${index+1}</b>${name}</span>`).join('<i>›</i>');
    $('meetingIdentity').textContent=row?`${row.no} · ${labels[row.status]} · 发起：${row.creatorName}（${row.creatorUnit}）`:`当前项目：${currentProject} · 发起：${currentUser().name}（${currentUser().unit}）`;
    for(const [id,field] of [['meetingTitle','title'],['meetingStart','start'],['meetingLocation','location'],['meetingDescription','description']]){value(id,row?.[field]);$(id).disabled=!editable;}
    value('meetingReviewNote','');$('meetingReviewLabel').hidden=!review;

    const available=qaRecords.filter(issue=>issue.project===currentProject),selected=preselected??(row?.issueIds||[]).filter(no=>row?.status!=='pending'||!qaRecords.find(issue=>issue.no===no&&issue.project===currentProject)?.ownerDirective);
    const issueRows=[...available,...(row?.issueSnapshots||[]).filter(issue=>!available.some(i=>i.no===issue.no))];
    const renderIssue=issue=>'<div class="meeting-issue-row"><label><input type="checkbox" value="'+esc(issue.no)+'" '+(selected.includes(issue.no)?'checked ':'')+(!editable||!available.some(i=>i.no===issue.no)||Boolean(issue.ownerDirective)?'disabled':'')+'/><span><strong>'+esc(issue.contactNo||issue.no)+' · '+esc(issue.title)+'</strong><small>'+esc(issue.status)+' · '+esc(issue.discipline||'未分类专业')+'</small></span></label><button type="button" data-view-coordination-issue="'+esc(issue.no)+'">'+(D.isReviewer(currentUser())&&D.needsCoordination(issue)&&!issue.ownerDirective?'查看问题 / 批示':'查看问题')+'</button></div>';
    const {coordination:pending,other:otherIssues}=D.groupIssues(issueRows);
    const showOther=otherIssues.some(issue=>selected.includes(issue.no));
    $('meetingIssueChoices').innerHTML='<div class="meeting-issue-group"><h4>待协调问题 <span>'+pending.length+' 项</span></h4>'+ (pending.length?pending.map(renderIssue).join(''):'<p class="meeting-empty">当前没有需业主协调的问题，可以展开其他问题进行选择。</p>')+'</div><label class="meeting-other-toggle"><input type="checkbox" id="meetingShowOther" '+(showOther?'checked':'')+'/><span>显示其他问题（'+otherIssues.length+' 项，可选）</span></label><div id="meetingOtherIssues" class="meeting-issue-group" '+(showOther?'':'hidden')+'><h4>其他问题</h4><p class="meeting-other-note">包含待监理确认、待设计确认、待施工确认及已闭环等其他状态，仅关联会议，不改变原答疑状态。</p>'+(otherIssues.length?otherIssues.map(renderIssue).join(''):'<p class="meeting-empty">当前没有其他问题。</p>')+'</div>';
    $('meetingIssueChoices').onclick=event=>{const button=event.target.closest('[data-view-coordination-issue]');if(button)window.openCoordinationIssue?.(button.dataset.viewCoordinationIssue);};
    $('meetingShowOther').addEventListener('change',()=>{$('meetingOtherIssues').hidden=!$('meetingShowOther').checked;});
    if(!row&&preselected?.length){const source=available.find(issue=>issue.no===preselected[0]);if(source){value('meetingTitle',preselected.length>1?'协调会议：'+preselected.length+' 项问题':'协调会议：'+source.title);value('meetingDescription',preselected.length>1?available.filter(issue=>preselected.includes(issue.no)).map((issue,index)=>(index+1)+'. '+issue.title).join('\n'):source.description);}}

    choices($('meetingAttendees'),[...new Set([...(row?.attendees||[]),...(row?.cc||[])])],!editable);
    $('meetingHistory').innerHTML=row?.history.length?row.history.map(item=>`<div><b>${esc(item.action)}</b><span>${esc(item.actor)} · ${esc(item.unit)} · ${esc(format(item.time))}</span>${item.note?`<p>${esc(item.note)}</p>`:''}</div>`).join(''):'<p>提交后生成流转记录。</p>';
    if(row?.returnReason&&row.status==='returned')$('meetingHistory').insertAdjacentHTML('afterbegin',`<p class="meeting-error">退回原因：${esc(row.returnReason)}</p>`);
    $('meetingError').textContent='';$('meetingSubmit').hidden=!editable;$('meetingReturn').hidden=!review;
    $('meetingSubmit').textContent=review?'审核通过并发布会议通知':row?'重新提交建设单位审核':'提交建设单位审核';
    dialog.hidden=false;document.body.classList.add('meeting-modal-open');$('meetingClose').focus();
  }
  function draft() {
    const checked=id=>[...$(id).querySelectorAll('input:checked')].filter(input=>input.id!=='meetingShowOther').map(input=>input.value);
    return {project:currentProject,title:$('meetingTitle').value.trim(),start:$('meetingStart').value,location:$('meetingLocation').value.trim(),description:$('meetingDescription').value.trim(),issueIds:checked('meetingIssueChoices'),attendees:checked('meetingAttendees'),cc:[],issueInstructions:[...document.querySelectorAll('[data-issue-instruction]')].filter(input=>input.value.trim()).map(input=>({no:input.dataset.issueInstruction,opinion:input.value.trim(),author:currentUser().name,unit:currentUser().unit,time:new Date().toISOString()})),reviewNote:$('meetingReviewNote').value.trim()};
  }
  $('meetingForm').addEventListener('submit',event=>{
    event.preventDefault();const button=$('meetingSubmit');button.disabled=true;
    try{
      if((openedAccount!==currentAccountId||openedProject!==currentProject))throw Error('账号已切换，请重新打开预约单。');
      load();const row=records.find(r=>r.id===editingId),data=draft();
      if(editingId&&!row)throw Error('预约单不存在，请重新打开。');
      if(!canEdit(row))throw Error('此预约已处理或当前账号无权修改。');
      D.validate(data,qaRecords);
      const now=new Date().toISOString(),issueSnapshots=qaRecords.filter(issue=>data.issueIds.includes(issue.no)).map(issue=>({no:issue.no,contactNo:issue.contactNo,title:issue.title,status:issue.status,project:issue.project,discipline:issue.discipline}));
      let result;
      if(row?.status==='pending')result=D.approve(row,currentUser(),{...data,issueSnapshots},qaRecords,Object.keys(smartWorksUsers));
      else {
        const reviewers=Object.entries(smartWorksUsers).filter(([,user])=>D.isReviewer(user)).map(([id])=>id);
        if(!reviewers.length)throw Error('尚未配置建设单位负责人账号。');
        const base=row||{id:crypto.randomUUID(),no:'HY-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-8),creatorId:currentAccountId,creatorName:currentUser().name,creatorUnit:currentUser().unit,createdAt:now,history:[]};
        result={...base,...data,issueSnapshots,status:'pending',reviewers,recipients:[],readBy:{},returnReason:'',history:[...base.history,{action:row?'修改后重新提交':'发起会议预约',actor:currentUser().name,unit:currentUser().unit,time:now,note:data.description}]};
      }
      persist(row?records.map(r=>r.id===result.id?result:r):[result,...records]);
      if(!row&&D.isReviewer(currentUser())){
        qaRecords.filter(issue=>issue.project===currentProject&&data.issueIds.includes(issue.no)&&D.needsCoordination(issue)).forEach(issue=>markQaHandledBy(issue,currentAccountId));
        saveSharedQaRecords();renderQa();renderMatterPanel();
      }
      close();
    }catch(error){$('meetingError').textContent=error.message;}finally{button.disabled=false;}
  });
  $('meetingReturn').addEventListener('click',()=>{
    try{load();if((openedAccount!==currentAccountId||openedProject!==currentProject))throw Error('账号已切换，请重新打开预约单。');const row=records.find(r=>r.id===editingId);if(!row)throw Error('预约单不存在。');const result=D.reject(row,currentUser(),$('meetingReviewNote').value);persist(records.map(r=>r.id===result.id?result:r));close();}catch(error){$('meetingError').textContent=error.message;}
  });
  stage.innerHTML=`<header class="meeting-page-head"><div><small>DESIGN COORDINATION</small><h2>会议协调</h2><p>把未解决的工程答疑汇集成会议，由建设单位审核并统一发布。</p></div><button type="button" class="meeting-primary" id="meetingNew">＋ 新增会议预约</button></header><div class="meeting-summary" id="meetingSummary"></div><section class="meeting-coordination-inbox"><header><div><h3>需业主协调的问题</h3><p>施工单位转来的问题会自动进入此处，可直接发起预约。</p></div><span id="meetingCoordinationCount"></span></header><div class="coordination-tools"><label>协调状态<select id="coordinationFilter"><option value="pending">待协调问题</option><option value="resolved">已协调问题</option><option value="all">全部协调问题</option></select></label><span id="coordinationSelectedCount">已选 0 项</span><button type="button" id="coordinationBookSelected" class="meeting-primary" disabled>发起预约</button></div><div class="meeting-table-wrap"><table class="meeting-table coordination-table"><thead><tr><th><input id="coordinationSelectAll" type="checkbox" aria-label="全选可预约的问题" /></th><th>答疑编号</th><th>问题主题</th><th>发起单位</th><th>转协调时间</th><th>协调状态</th><th>操作</th></tr></thead><tbody id="meetingCoordinationIssues"></tbody></table><p id="coordinationEmpty" class="meeting-empty" hidden>当前没有符合筛选条件的问题。</p></div></section><div class="meeting-list-toolbar"><label>状态<select id="meetingStatusFilter"><option value="all">全部预约</option><option value="pending">待建设单位审核</option><option value="published">已预约 · 已发布</option><option value="returned">已退回修改</option><option value="directed">已批示 · 不召开会议</option></select></label><input type="search" id="meetingSearch" aria-label="搜索会议" placeholder="搜索会议主题、编号或地点"/><span>建设单位审核通过即预约成功</span></div><div class="meeting-table-wrap"><table class="meeting-table"><thead><tr><th>会议单号 / 主题</th><th>会议安排</th><th>关联问题 / 参会单位</th><th>发起人</th><th>状态 / 操作</th></tr></thead><tbody id="meetingRows"></tbody></table></div><div id="meetingListEmpty" class="meeting-empty" hidden>当前没有会议预约。点击“新增会议预约”，选择需协调的问题并提交。</div><p class="meeting-prototype-note">样板：会议单和阅读状态保存在当前浏览器，各测试账号共享；通知为站内通知。</p>`;
  $('meetingNew').addEventListener('click',()=>open());$('meetingStatusFilter').addEventListener('change',render);$('meetingSearch').addEventListener('input',render);
  $('coordinationFilter').addEventListener('change',()=>{coordinationSelection.clear();render();});
  $('coordinationBookSelected').addEventListener('click',()=>open(null,[...coordinationSelection]));
  function render(){
    load();
    if(!dialog.hidden&&(openedAccount!==currentAccountId||openedProject!==currentProject))close();
    const scoped=records.filter(r=>r.project===currentProject&&r.kind!=='issue-instruction'),term=$('meetingSearch').value.trim().toLowerCase(),status=$('meetingStatusFilter').value;
    $('meetingSummary').innerHTML=[['预约总数',scoped.length],['待建设单位审核',scoped.filter(r=>r.status==='pending').length],['已发布会议',scoped.filter(r=>r.status==='published').length]].map(([name,count])=>`<div><span>${name}</span><strong>${count}</strong></div>`).join('');


    const coordinationIssues=qaRecords.filter(issue=>issue.project===currentProject&&(D.needsCoordination(issue)||issue.ownerDirective));
    const filter=$('coordinationFilter').value;
    const visibleIssues=coordinationIssues.map(issue=>({issue,...D.coordinationState(issue,records)})).filter(item=>filter==='all'||(filter==='resolved'?item.resolved:!item.resolved));
    const eligible=new Set(visibleIssues.filter(item=>item.canBook).map(item=>item.issue.no));
    for(const no of coordinationSelection)if(!eligible.has(no))coordinationSelection.delete(no);
    $('meetingCoordinationCount').textContent=coordinationIssues.filter(issue=>!D.coordinationState(issue,records).resolved).length+' 项待协调';
    $('meetingCoordinationIssues').innerHTML=visibleIssues.map(({issue,meeting,canBook,label})=>{
      const transfer=issue.replies?.filter(reply=>reply.action==='转为需业主协调').at(-1)?.time||issue.relatedItem?.time||issue.initiatedAt||issue.date;
      return '<tr><td><input type="checkbox" aria-label="选择 '+esc(issue.contactNo||issue.no)+'" data-coordination-select="'+esc(issue.no)+'" '+(coordinationSelection.has(issue.no)?'checked ':'')+(!canBook?'disabled':'')+'/></td><td>'+esc(issue.contactNo||issue.no)+'</td><td><strong>'+esc(issue.title)+'</strong></td><td>'+esc(issue.unit||'施工单位')+'</td><td>'+esc(transfer||'—')+'</td><td><span class="meeting-badge '+(meeting?.status||'')+'">'+esc(label)+'</span></td><td>'+('<button type="button" data-view-coordination-issue="'+esc(issue.no)+'">'+(D.isReviewer(currentUser())&&D.needsCoordination(issue)&&!issue.ownerDirective?'查看问题 / 批示':'查看问题')+'</button>')+'</td></tr>';
    }).join('');
    $('coordinationEmpty').hidden=visibleIssues.length>0;
    const updateSelection=()=>{
      const selected=[...coordinationSelection].filter(no=>eligible.has(no));
      $('coordinationSelectedCount').textContent='已选 '+selected.length+' 项';
      $('coordinationBookSelected').disabled=selected.length===0;
      $('coordinationSelectAll').disabled=eligible.size===0;
      $('coordinationSelectAll').checked=eligible.size>0&&selected.length===eligible.size;
      $('coordinationSelectAll').indeterminate=selected.length>0&&selected.length<eligible.size;
    };
    stage.querySelectorAll('[data-coordination-select]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)coordinationSelection.add(input.dataset.coordinationSelect);else coordinationSelection.delete(input.dataset.coordinationSelect);updateSelection();}));
    $('coordinationSelectAll').onchange=()=>{eligible.forEach(no=>{if($('coordinationSelectAll').checked)coordinationSelection.add(no);else coordinationSelection.delete(no);});render();};
    updateSelection();

    stage.querySelectorAll('[data-view-coordination-issue]').forEach(button=>button.addEventListener('click',()=>window.openCoordinationIssue?.(button.dataset.viewCoordinationIssue)));
    stage.querySelectorAll('[data-coordination-meeting]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.coordinationMeeting)));
    const visible=scoped.filter(r=>(status==='all'||r.status===status)&&[r.title,r.no,r.location].some(v=>v.toLowerCase().includes(term)));
    $('meetingRows').innerHTML=visible.map(row=>`<tr><td><small>${esc(row.no)}</small><strong>${esc(row.title)}</strong></td><td><span>${row.status==='directed'?'无需召开会议':esc(format(row.start))}</span><small>${row.status==='directed'?'已按问题逐项批示':esc(row.location)}</small></td><td><span>${row.issueIds.length} 个问题</span><small>${esc(row.attendees.join('、'))}</small></td><td>${esc(row.creatorName)}<small>${esc(row.creatorUnit)}</small></td><td><span class="meeting-badge ${row.status}">${labels[row.status]}</span><button type="button" data-meeting-open="${esc(row.id)}">${row.status==='pending'&&D.isReviewer(currentUser())?'审核预约':row.status==='returned'&&row.creatorId===currentAccountId?'修改并重提':'查看会议单'}</button></td></tr>`).join('');
    $('meetingListEmpty').hidden=visible.length>0;
    stage.querySelectorAll('[data-meeting-open]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.meetingOpen)));
  }

  window.refreshCoordinationAfterIssue=()=>{
    const saved=!dialog.hidden?draft():null, id=editingId;
    load();render();renderMatterPanel();renderQa();
    if(saved){
      const row=records.find(item=>item.id===id);
      if(row?.status==='directed'){close();return;}
      open(id,saved.issueIds.filter(no=>!qaRecords.find(issue=>issue.no===no&&issue.project===currentProject)?.ownerDirective));
      for(const [field,name]of [['meetingTitle','title'],['meetingStart','start'],['meetingLocation','location'],['meetingDescription','description']])value(field,saved[name]);
      choices($('meetingAttendees'),saved.attendees, !canEdit(row));value('meetingReviewNote',saved.reviewNote);
    }
  };
  window.isQaCoordinationPending=row=>D.coordinationPending(row,records);
  window.openQaCoordination=no=>{
    const issue=qaRecords.find(row=>row.no===no&&row.project===currentProject);if(!issue)return;
    closeQaDetail();
    if(window.openCoordinationIssue){window.openCoordinationIssue(no);return;}
    const linked=records.find(meeting=>meeting.project===issue.project&&meeting.issueIds.includes(no));
    if(linked)open(linked.id);else open(null,[no]);
  };
  window.openMeetingCoordination=()=>{switchArea('business');openBusinessDirectory('设计管理','会议协调');};
  const ownerButton=document.createElement('button');ownerButton.type='button';ownerButton.className='qa-detail-coordinate';ownerButton.id='qaOwnerMeeting';ownerButton.textContent='发起协调会议';ownerButton.hidden=true;
  document.querySelector('.qa-detail-foot').append(ownerButton);
  ownerButton.addEventListener('click',()=>window.openQaCoordination(qaViewingNo));
  window.syncQaCoordinationControls=row=>{ownerButton.hidden=!(row&&(D.needsCoordination(row)||row.ownerDirective)&&D.isReviewer(currentUser()));ownerButton.textContent=row?.ownerDirective?'查看业主批示':'查看问题 / 批示';};

  document.querySelector('#quickList').addEventListener('click',event=>{if(event.target.closest('button')?.textContent.trim()==='我的会议')window.openMeetingCoordination();});
  window.reloadMeetings=()=>{close();load();render();renderMatterPanel();};
  window.closeMeetingDialog=close;
  window.renderMeetings=()=>{load();render();renderMatterPanel();};
  window.appendMeetingMatters=({host,filter,unreadCount,todoCount})=>{
    load();
    const scoped=records.filter(r=>r.project===currentProject),withKind=scoped.map(row=>({row,kind:D.kind(row,currentAccountId,currentUser())}));
    $('matterUnreadCount').textContent=(unreadCount+withKind.filter(item=>item.kind==='unread').length)||'';
    $('matterTodoCount').textContent=(todoCount+withKind.filter(item=>item.kind==='todo').length)||'';
    const visible=withKind.filter(({kind,row})=>filter==='all'?kind==='unread'||kind==='todo':filter==='done'?row.history.some(item=>item.actor===currentUser().name&&['审核通过并发布通知','退回修改','逐项批示并通知（不召开会议）'].includes(item.action))&&kind!=='todo':kind===filter);
    if(visible.length)host.querySelector('.matter-empty')?.remove();
    visible.forEach(({row,kind})=>{
      const article=document.createElement('article');article.className='matter';article.dataset.unread=String(kind==='unread');
      article.dataset.matterTime=String(Date.parse(row.publishedAt||row.history.at(-1)?.time||row.createdAt)||0);
      article.innerHTML=`<span class="dot"></span><div><span class="module">会议协调${row.status==='published'?' · 会议通知':row.status==='directed'?' · 业主批示':''}</span><h3><button class="meeting-matter-title ${kind==='unread'?'unread':''}" type="button">${esc(row.title)}</button></h3></div><div class="date"><span>${row.status==='published'?'会议时间':row.status==='directed'?'批示时间':'提交时间'}</span><time>${esc(format(row.status==='published'?row.start:row.status==='directed'?row.publishedAt:row.createdAt))}</time></div><button type="button" class="state-link matter-state">${kind==='todo'?row.status==='returned'?'修改预约':'审核预约':kind==='unread'?'待读通知':'已读通知'}</button>`;
      article.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>open(row.id)));host.append(article);
    });
  };
  window.addEventListener('storage',event=>{if(event.key===key){load();render();renderMatterPanel();}});
  render();renderMatterPanel();
})();
