/* Reproducible demonstration baseline, isolated from AI and document settings. */
(() => {
  const baselineKey='smartworks-demo-baseline-v1', meetingKey='smartworks-meetings-v1', backupKey='smartworks-demo-reset-backup-v1';
  let baseline=null,fixture=null,lastResult='',ready=false,opener=null,busy=false;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy=value=>JSON.parse(JSON.stringify(value));
  const panel=document.createElement('div');panel.className='meeting-backdrop demo-admin-backdrop';panel.hidden=true;
  panel.innerHTML=`<section class="meeting-dialog demo-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="demoAdminTitle"><header><div><small>系统设置</small><h2 id="demoAdminTitle">演示数据后台</h2></div><button id="demoAdminClose" type="button" aria-label="关闭演示数据后台">×</button></header><div class="demo-admin-body"><p>恢复确认好的工程答疑默认流程，方便反复演示不同角色的操作。</p><div class="demo-admin-summary" id="demoAdminSummary"></div><table class="meeting-table"><thead><tr><th>默认状态</th><th>数量</th></tr></thead><tbody id="demoAdminCounts"></tbody></table><div class="demo-admin-scope"><strong>重置范围</strong><p>将工程答疑的节点、流转意见、已读与待办状态恢复为初始基准；会议预约与通知也恢复至基准，新产生的测试流程会移除。</p><p>账号密码、AI 设置和资料目录不受影响。基准保存在当前浏览器，重置不会重新随机生成数据。</p></div><p id="demoAdminResult" role="status"></p></div><footer><button id="demoAdminUndo" type="button">撤销本次重置</button><button id="demoAdminReset" class="meeting-primary" type="button">一键重置为默认状态</button></footer></section>`;
  document.body.append(panel);const $=id=>document.getElementById(id);
  const meetings=()=>{try{const data=JSON.parse(localStorage.getItem(meetingKey)||'[]');return Array.isArray(data)?data:[];}catch{return [];}};
  const stored=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
  const defaultMeetings=rows=>copy(rows).map(row=>{
    if(!row.demoMeetingFixture||!Number.isInteger(row.meetingStartOffsetDays))return row;
    const start=new Date();start.setDate(start.getDate()+row.meetingStartOffsetDays);start.setHours(10,0,0,0);
    const localStart=new Date(start.getTime()-start.getTimezoneOffset()*60000).toISOString().slice(0,16);
    return {...row,start:localStart};
  });
  function repaint(){
    const counts=fixture?.counts||{};
    const qaCount=fixture?(fixture.records.length+(fixture.coordinationRecords?.length||0)):'—';
    $('demoAdminSummary').innerHTML=`<div><b>${qaCount}</b><span>默认工程答疑问题</span></div><div><b>${fixture?.meetings?.length||0}</b><span>关联会议测试单</span></div><div><b>${Object.keys(smartWorksUsers).length}</b><span>测试账号已记住密码</span></div>`;
    $('demoAdminCounts').innerHTML='<tr><th colspan="2">原有工程答疑：17 条</th></tr>'+Object.entries(counts).map(([name,count])=>`<tr><td>${esc(name)}</td><td>${count} 条</td></tr>`).join('')+'<tr><th colspan="2">新增会议协调：9 条关联问题及 9 条会议单</th></tr>'+Object.entries(fixture?.meetingCounts||{}).map(([name,count])=>`<tr><td>${esc(name)}</td><td>${count} 条</td></tr>`).join('');
    $('demoAdminResult').textContent=lastResult||(!ready?'正在准备默认数据…':'已就绪，可以一键恢复默认流程。');
    $('demoAdminReset').disabled=!ready||busy;$('demoAdminUndo').disabled=!ready||busy||!stored(backupKey);
  }
  function rememberAccounts(){
    const passwords=getRememberedPasswords();Object.keys(smartWorksUsers).forEach(id=>{passwords[id]='Test123.';});
    localStorage.setItem(smartWorksRememberKey,JSON.stringify(passwords));
  }
  async function apply(records,meetingRecords){
    records=records.map(normalizeOwnerArchivedQa);
    if(qaUsesDatabase){
      const response=await fetch(qaDatabaseEndpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({records})});
      if(!response.ok)throw Error('工程答疑未能保存，请稍后重试。');
    }else localStorage.setItem(smartWorksRecordsKey,JSON.stringify(records));
    localStorage.setItem(meetingKey,JSON.stringify(meetingRecords));qaRecords=copy(records);
    closeQaDetail();
    window.reloadMeetings?.();renderQa();renderMatterPanel();window.renderQaAdmin?.();
  }
  async function initialise(){
    try{
      await Promise.all([window.smartWorksQaReady,window.smartWorksAccountsReady]);
      const response=await fetch('data/demo-qa-defaults.json',{cache:'no-store'});if(!response.ok)throw Error('默认流程文件未能载入。');fixture=await response.json();
      const existing=stored(baselineKey);
      if(existing?.version===fixture.version&&Array.isArray(existing.records)&&Array.isArray(existing.meetings)){baseline=existing;
        if(existing.descriptionRevision!==fixture.descriptionRevision){
          const defaults=new Map(fixture.records.map(row=>[row.no,row]));
          const updateDescription=row=>{const original=defaults.get(row.no);if(!original)return row;return {...row,title:original.title,description:original.description,replies:(row.replies||[]).map((reply,index)=>index===0&&reply.action==="施工单位发起"?{...reply,content:original.description}:reply)};};
          baseline={...existing,descriptionRevision:fixture.descriptionRevision,records:existing.records.map(updateDescription)};
          await apply(qaRecords.map(updateDescription),meetings());
          localStorage.setItem(baselineKey,JSON.stringify(baseline));
          const backup=stored(backupKey);if(backup?.records)localStorage.setItem(backupKey,JSON.stringify({...backup,records:backup.records.map(updateDescription)}));
          lastResult="已更新测试问题的功能说明；当前流程节点和处理记录保持不变。";
        }
      }
      else {
        const sampleQa=qaRecords.filter(r=>r.contactNo==='DEMO-MEETING-001');const sampleIds=sampleQa.map(r=>r.no);
        const cleanQa=qaRecords.filter(r=>r.contactNo!=='DEMO-MEETING-001'&&!r.demoFixture);
        const cleanMeetings=meetings().filter(r=>r.title!=='【样板】地下室机电与结构协调会'&&!r.issueIds?.some(id=>sampleIds.includes(id)));
        baseline={version:fixture.version,descriptionRevision:fixture.descriptionRevision,meetingRevision:fixture.meetingRevision,createdAt:new Date().toISOString(),records:[...copy(fixture.records),...copy(fixture.coordinationRecords||[]),...copy(cleanQa)],meetings:[...defaultMeetings(fixture.meetings||[]),...copy(cleanMeetings)]};
        // Keep a recovery snapshot before the one-time, explicitly requested setup.
        localStorage.setItem('smartworks-demo-install-backup-v1',JSON.stringify({records:qaRecords,meetings:meetings()}));
        await apply(baseline.records,baseline.meetings);
        localStorage.setItem(baselineKey,JSON.stringify(baseline));rememberAccounts();
        lastResult='已清理样板流程、记住全部测试账号密码，并建立 '+fixture.records.length+' 条默认测试流程。';
      }
      if(baseline.meetingRevision!==fixture.meetingRevision){
        const addedQa=copy(fixture.coordinationRecords||[]),addedMeetings=defaultMeetings(fixture.meetings||[]);
        const merge=(existing,added,field)=>[...existing,...added.filter(row=>!existing.some(item=>item[field]===row[field]))];
        const nextBaseline={...baseline,meetingRevision:fixture.meetingRevision,records:merge(baseline.records,addedQa,'no'),meetings:merge(baseline.meetings,addedMeetings,'id')};
        // Add the new examples once; preserve all existing user workflow progress and the reset undo snapshot.
        await apply(merge(qaRecords,addedQa,'no'),merge(meetings(),addedMeetings,'id'));
        localStorage.setItem(baselineKey,JSON.stringify(nextBaseline));baseline=nextBaseline;
        lastResult='已保留原有 17 条默认问题，新增 9 条会议协调关联问题及 9 条会议测试单；当前已有流程进度保留。';
      }
      ready=true;repaint();
    }catch(error){lastResult=error.message;repaint();}
  }
  async function reset(){
    if(!ready||busy)return;busy=true;repaint();
    try{
      const backup={records:copy(qaRecords),meetings:copy(meetings())};localStorage.setItem(backupKey,JSON.stringify(backup));
      await apply(copy(baseline.records),defaultMeetings(baseline.meetings));
      lastResult='已重置：工程答疑、会议预约及通知均已恢复到默认状态。';
    }catch(error){lastResult='重置失败：'+error.message;}finally{busy=false;repaint();}
  }
  $('demoAdminReset').addEventListener('click',reset);
  $('demoAdminUndo').addEventListener('click',async()=>{
    const backup=stored(backupKey);if(!backup||busy)return;busy=true;repaint();
    try{await apply(backup.records,backup.meetings);localStorage.removeItem(backupKey);lastResult='已撤销本次重置。';}catch(error){lastResult=error.message;}finally{busy=false;repaint();}
  });
  function close(){if(busy)return;panel.hidden=true;opener?.focus();}
  $('demoAdminClose').addEventListener('click',close);
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape')close();
    if(event.key==='Tab'){const controls=[...panel.querySelectorAll('button')].filter(el=>!el.disabled);if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}}
  });
  document.addEventListener('smartworks:settings',()=>{if(currentUser().admin){window.openAdminWorkspace?.();return;}opener=document.activeElement;panel.hidden=false;repaint();$('demoAdminClose').focus();});
  window.smartWorksDemoReady=initialise();
})();
