/* Single coordination problem: original details and an owner instruction in one dialog. */
(() => {
  const D=window.MeetingDomain,key='smartworks-meetings-v1';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const host=document.createElement('div');host.className='meeting-backdrop issue-instruction-backdrop';host.hidden=true;
  host.innerHTML=`<section class="meeting-dialog issue-instruction-dialog" role="dialog" aria-modal="true" aria-labelledby="coordinationIssueTitle"><header><div><small>协调问题详情</small><h2 id="coordinationIssueTitle">查看问题 / 批示</h2></div><button type="button" id="coordinationIssueClose" aria-label="关闭问题详情">×</button></header><form id="coordinationIssueForm"><div class="meeting-dialog-body"><div id="coordinationIssueMeta" class="meeting-identity"></div><h3 id="coordinationIssueSubject"></h3><section class="issue-original"><h4>原始问题说明</h4><p id="coordinationIssueDescription"></p><div id="coordinationIssueAttachments"></div></section><section class="meeting-history"><h3>完整流转记录与批示</h3><div id="coordinationIssueHistory"></div></section><label class="meeting-review-label" id="coordinationIssueOpinionLabel">业主批示意见<textarea id="coordinationIssueOpinion" rows="4" maxlength="2000" placeholder="查看问题后，在此填写具体批示意见" required></textarea></label><p class="issue-instruction-note" id="coordinationIssueNote">提交后，此问题将移出待协调列表，直接进入“已归档”，并通知其他单位。无需预约会议。</p><p id="coordinationIssueError" role="alert"></p></div><footer><button type="button" id="coordinationIssueCancel">关闭</button><button type="submit" class="meeting-primary" id="coordinationIssueSave">提交批示并归档</button></footer></form></section>`;
  document.body.append(host);const $=id=>document.getElementById(id);
  let no=null,openedAccount=null,openedProject=null,opener=null,busy=false;
  function close(){if(busy)return;host.hidden=true;document.body.classList.toggle('meeting-modal-open',Boolean(document.querySelector('.meeting-backdrop:not([hidden])')));opener?.focus();}
  $('coordinationIssueClose').addEventListener('click',close);$('coordinationIssueCancel').addEventListener('click',close);
  host.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}if(event.key==='Tab'){const controls=[...host.querySelectorAll('button,textarea')].filter(el=>!el.disabled&&el.getClientRects().length);if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}}});
  window.openCoordinationIssue=issueNo=>{
    const issue=qaRecords.find(row=>row.no===issueNo&&row.project===currentProject);if(!issue)return;
    no=issueNo;openedAccount=currentAccountId;openedProject=currentProject;opener=document.activeElement;
    const editable=D.isReviewer(currentUser())&&D.needsCoordination(issue)&&!issue.ownerDirective;
    $('coordinationIssueTitle').textContent=editable?'查看问题 / 批示':'协调问题详情';
    $('coordinationIssueSubject').textContent=issue.title;
    $('coordinationIssueMeta').textContent=(issue.contactNo||issue.no)+' · '+issue.status+' · '+(issue.unit||'')+' · '+(issue.location||'未填写位置');
    $('coordinationIssueDescription').textContent=issue.description||'暂无问题说明。';
    $('coordinationIssueAttachments').innerHTML=(issue.attachments||[]).length?'<h4>原始附件</h4><ul>'+issue.attachments.map(file=>'<li>'+esc(file.name)+'</li>').join('')+'</ul>':'';
    $('coordinationIssueHistory').innerHTML=(issue.replies||[]).map(reply=>'<div><b>'+esc(reply.action)+'</b><span>'+esc(reply.unit)+' · '+esc(reply.user)+' · '+esc(reply.time)+'</span><p>'+esc(reply.content)+'</p></div>').join('')||'<p>暂无流转记录。</p>';
    $('coordinationIssueOpinion').value='';$('coordinationIssueOpinion').disabled=!editable;
    $('coordinationIssueOpinionLabel').hidden=!editable;$('coordinationIssueSave').hidden=!editable;$('coordinationIssueNote').hidden=!editable;$('coordinationIssueError').textContent='';
    host.hidden=false;document.body.classList.add('meeting-modal-open');$('coordinationIssueClose').focus();
  };
  $('coordinationIssueForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;$('coordinationIssueSave').disabled=true;
    try{
      if(openedAccount!==currentAccountId||openedProject!==currentProject)throw Error('账号或项目已变化，请重新打开问题。');
      if(!qaUsesDatabase){const latest=JSON.parse(localStorage.getItem(smartWorksRecordsKey)||'null');if(Array.isArray(latest))qaRecords=latest;}
      const issue=qaRecords.find(row=>row.no===no&&row.project===currentProject);if(!issue)throw Error('问题不存在，请刷新。');
      const result=D.instructIssue(issue,currentUser(),$('coordinationIssueOpinion').value,currentAccountId,Object.keys(smartWorksUsers));
      const nextQa=qaRecords.map(row=>row.no===no&&row.project===currentProject?result.issue:row);
      const records=JSON.parse(localStorage.getItem(key)||'[]');
      const updated=records.map(record=>{
        if(record.status!=='pending'||record.project!==currentProject||!record.issueIds?.includes(no))return record;
        const related=record.issueIds.map(id=>nextQa.find(row=>row.no===id&&row.project===currentProject));
        if(!related.every(row=>row?.ownerDirective))return record;
        return {...record,status:'directed',suppressNotice:true,reviewer:currentUser().name,publishedAt:new Date().toISOString(),issueInstructions:related.map(row=>({no:row.no,...row.ownerDirective})),history:[...record.history,{action:'全部关联问题已由业主分别批示，无需开会',actor:currentUser().name,unit:currentUser().unit,time:new Date().toISOString(),note:'请在各问题详情查看批示。'}]};
      });
      const oldQa=localStorage.getItem(smartWorksRecordsKey),oldMeetings=localStorage.getItem(key);
      if(qaUsesDatabase){const response=await fetch(qaDatabaseEndpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({records:nextQa})});if(!response.ok)throw Error('批示未能保存，请重试。');}
      try{if(!qaUsesDatabase)localStorage.setItem(smartWorksRecordsKey,JSON.stringify(nextQa));localStorage.setItem(key,JSON.stringify([result.decision,...updated]));}
      catch(error){if(!qaUsesDatabase){if(oldQa===null)localStorage.removeItem(smartWorksRecordsKey);else localStorage.setItem(smartWorksRecordsKey,oldQa);}if(oldMeetings===null)localStorage.removeItem(key);else localStorage.setItem(key,oldMeetings);throw error;}
      qaRecords=nextQa;busy=false;close();window.refreshCoordinationAfterIssue?.();renderQa();renderMatterPanel();window.renderQaAdmin?.();
    }catch(error){$('coordinationIssueError').textContent=error.message;}finally{busy=false;$('coordinationIssueSave').disabled=false;}
  });
  window.smartWorksOwnerArchiveReady=(async()=>{
    await window.smartWorksQaReady;
    await window.smartWorksDemoReady;
    if(!qaRecords.some(row=>row.ownerDirective||row.status==='业主已批示'||row.step==='owner_directed'))return;
    qaRecords=qaRecords.map(normalizeOwnerArchivedQa);
    saveSharedQaRecords();renderQa();renderMatterPanel();window.renderMeetings?.();window.renderQaAdmin?.();
  })();
})();
