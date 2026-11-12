/* Shared local workflow, with attachment bytes persisted in IndexedDB. */
(() => {
  const D=window.DrawingChangeDomain,key='smartworks-drawing-changes-v1';
  const stage=document.querySelector('#drawingChangeStage');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id),money=cents=>Number.isSafeInteger(cents)?(cents/1000000).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:6})+' 万元':'未填写';
  const inputMoney=cents=>Number.isSafeInteger(cents)?(cents/1000000).toFixed(6).replace(/\.?0+$/, ''):'';
  const time=value=>new Date(value).toLocaleString('zh-CN',{hour12:false});
  const load=()=>{try{const rows=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(rows)&&rows.some(row=>row?.status==='supervision_first')){const migrated=rows.map(row=>D.normalizeLegacy(row));localStorage.setItem(key,JSON.stringify(migrated));return migrated.filter(row=>row?.id&&row.project&&D.labels[row.status]&&Array.isArray(row.history)&&Array.isArray(row.attachments)&&Array.isArray(row.qaIds));}return Array.isArray(rows)?rows.filter(row=>row?.id&&row.project&&D.labels[row.status]&&Array.isArray(row.history)&&Array.isArray(row.attachments)&&Array.isArray(row.qaIds)):[];}catch{return [];}};
  const lock=callback=>navigator.locks?navigator.locks.request(key,callback):callback();
  let editingId=null,openedAccount=null,openedProject=null,openedRevision=null,opener=null,busy=false,files=[],historyFiles=[],selectedQa=new Set(),sourceSnapshots=[],dbPromise;
  function database(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open('smartworks-drawing-attachments-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>{dbPromise=null;reject(Error('附件存储未能打开，请重试。'));};
    });return dbPromise;
  }
  async function writeFiles(items){
    if(!items.length)return;
    const db=await database();await new Promise((resolve,reject)=>{
      const transaction=db.transaction('files','readwrite');items.forEach(item=>transaction.objectStore('files').put({id:item.id,blob:item.file}));
      transaction.oncomplete=resolve;transaction.onerror=()=>reject(Error('附件未能保存，请检查浏览器存储空间后重试。'));transaction.onabort=transaction.onerror;
    });
  }
  async function download(id){
    try{
      const item=files.find(file=>file.id===id)||historyFiles.find(file=>file.id===id);if(!item)return;
      let blob=item.file;
      if(!blob){const db=await database();blob=await new Promise((resolve,reject)=>{const request=db.transaction('files').objectStore('files').get(id);request.onsuccess=()=>resolve(request.result?.blob);request.onerror=()=>reject(Error('附件读取失败。'));});}
      if(!blob)throw Error('未找到附件文件，请联系发起人补充。');
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=item.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(error){$('drawingError').textContent=error.message;}
  }
  stage.innerHTML=`<header class="meeting-page-head"><div><small>DESIGN CHANGE</small><h2>图纸变更</h2><p>设计发起 → 施工审核及造价预估 → 监理复核及造价确认 → 业主审核</p></div><button type="button" class="meeting-primary" id="drawingNew">＋ 发起图纸变更</button></header><div class="meeting-summary" id="drawingSummary"></div><div class="meeting-list-toolbar"><label class="drawing-filter-label">流程状态<select id="drawingStatus"><option value="all">全部状态</option>${Object.entries(D.labels).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label class="drawing-filter-label"><input id="drawingOnlyTodo" type="checkbox"/> 仅看我的待办</label><input id="drawingSearch" type="search" aria-label="搜索图纸变更" placeholder="搜索编号、主题或发起人"/></div><div class="meeting-table-wrap"><table class="meeting-table" aria-label="图纸变更列表"><thead><tr><th>变更号 / 主题</th><th>变更依据</th><th>造价变动（万元）</th><th>发起人 / 最近处理</th><th>当前状态 / 操作</th></tr></thead><tbody id="drawingRows"></tbody></table></div><p id="drawingEmpty" class="meeting-empty">暂无图纸变更。由设计单位发起后，系统会分发下一节点待办。</p>`;
  const dialog=document.createElement('div');dialog.className='meeting-backdrop';dialog.hidden=true;
  dialog.innerHTML=`<section class="meeting-dialog drawing-dialog" role="dialog" aria-modal="true" aria-labelledby="drawingDialogTitle"><header><div><small>设计管理 / 图纸变更</small><h2 id="drawingDialogTitle">发起图纸变更</h2></div><button type="button" id="drawingClose" aria-label="关闭图纸变更">×</button></header><form id="drawingForm" novalidate><div class="meeting-dialog-body"><div id="drawingIdentity" class="meeting-identity"></div><div id="drawingFlow" class="meeting-flow"></div><div id="drawingTaskHeader" class="drawing-task-header"><p id="drawingActionHint"></p></div><section id="drawingBasics" class="drawing-section drawing-basics"><header><h3>变更信息与依据</h3><span>设计单位填写</span></header><div class="meeting-fields"><label class="full"><span>变更号<span class="drawing-required" aria-hidden="true">*</span></span><input id="drawingChangeNo" maxlength="60" required placeholder="例如：设计变更-2026-001"/></label><label class="full"><span>变更主题<span class="drawing-required" aria-hidden="true">*</span></span><input id="drawingTitle" maxlength="100" required placeholder="填写需要审核的图纸变更主题"/></label><label class="full"><span>变更说明<span class="drawing-required" aria-hidden="true">*</span></span><textarea id="drawingDescription" class="drawing-description" maxlength="4000" required placeholder="说明变更原因、图纸调整范围及实施影响"></textarea></label><label class="full"><span>变更依据<span class="drawing-required" aria-hidden="true">*</span></span><select id="drawingBasisType" required><option value="">请选择变更依据</option>${D.basisTypes.map((name,index)=>`<option value="${name}">${index+1}. ${name}</option>`).join('')}</select></label><section id="drawingQaSub" class="drawing-qa-sub" hidden><h4>关联工程答疑 <small>选填，可多选</small></h4><div class="drawing-basis-filters"><label>答疑编号<input id="drawingBasisNo" type="search" placeholder="输入答疑编号"/></label><label>问题主题<input id="drawingBasisSearch" type="search" aria-label="问题主题筛选" placeholder="输入主题关键词"/></label><label>专业<select id="drawingBasisDiscipline" aria-label="专业筛选"><option value="">全部专业</option></select></label><label class="drawing-only-selected"><input id="drawingBasisSelected" type="checkbox"/>仅看已选</label><button id="drawingBasisReset" type="button">重置筛选</button></div><p id="drawingBasisCount" class="drawing-basis-count" aria-live="polite"></p><div id="drawingBasis" class="drawing-basis"></div></section></div></section><fieldset id="drawingCostSection" class="drawing-section drawing-cost-section"><legend>造价审核 <span>请直接填写金额，对应处理节点必填</span></legend><div class="meeting-fields"><label class="drawing-cost-card" data-cost-unit="设计单位"><span>设计预估造价变动<span class="drawing-required drawing-cost-required" aria-hidden="true">*</span></span><small class="drawing-cost-state"></small><span class="drawing-cost-input"><input id="drawingDesignCost" type="text" inputmode="decimal" autocomplete="off" placeholder="由设计单位填写"/><span>万元</span></span></label><label class="drawing-cost-card" data-cost-unit="施工单位"><span>施工预估造价变动<span class="drawing-required drawing-cost-required" aria-hidden="true">*</span></span><small class="drawing-cost-state"></small><span class="drawing-cost-input"><input id="drawingConstructionCost" type="text" inputmode="decimal" autocomplete="off" placeholder="由施工单位审核时填写"/><span>万元</span></span></label><label class="drawing-cost-card" data-cost-unit="监理单位"><span>监理确认造价变动<span class="drawing-required drawing-cost-required" aria-hidden="true">*</span></span><small class="drawing-cost-state"></small><span class="drawing-cost-input"><input id="drawingConfirmedCost" type="text" inputmode="decimal" autocomplete="off" placeholder="由监理复核时确认"/><span>万元</span></span></label></div><p class="drawing-files-note">三方金额和审核意见会保留在流转记录中，供业主审核。退回后，后续节点须重新审核确认。</p></fieldset><fieldset id="drawingAttachmentsSection" class="drawing-section drawing-attachments-section"><legend>各单位附件 / 纪要 <span>选填</span></legend><p id="drawingAttachmentHint" class="drawing-attachment-hint"></p><label id="drawingUploadLabel" class="drawing-file-label">上传本单位附件<input id="drawingFilesInput" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.dwg,.dxf,.zip,.txt"/></label><p class="drawing-files-note">支持图纸、PDF、纪要、办公文档和图片；单份不超过 20 MB。文件保存后，各审核单位可下载。</p><ul id="drawingFiles" class="drawing-files"></ul></fieldset><section id="drawingOpinionSection" class="drawing-section drawing-opinion-section" hidden><header><h3>本节点处理意见</h3><span id="drawingOpinionUnit"></span></header><label id="drawingOpinionLabel" class="meeting-review-label"><span>审核意见 / 退回原因 / 作废原因<span class="drawing-required" aria-hidden="true">*</span></span><textarea id="drawingOpinion" maxlength="2000" rows="3" placeholder="填写处理意见；退回或作废时说明原因"></textarea></label></section><section class="meeting-history drawing-history-section"><h3>完整流转记录</h3><div id="drawingHistory"></div></section><p id="drawingError" role="alert"></p></div><footer><button type="button" id="drawingCancel">关闭</button><div id="drawingReturnGroup" class="drawing-return-group"><button type="button" id="drawingReturn" class="meeting-return">退回上一节点</button><button type="button" id="drawingReturnMore" aria-label="更多退回操作" aria-haspopup="menu" aria-expanded="false">▾</button><div id="drawingReturnMenu" class="drawing-return-menu" role="menu" aria-label="退回或作废" hidden><p>选择退回节点</p><div id="drawingReturnTargets"></div><div class="drawing-return-divider"></div><button type="button" id="drawingVoid" class="drawing-void" role="menuitem">作废整个流程</button></div></div><button type="submit" id="drawingSubmit" class="meeting-primary">确定</button></footer></form></section>`;
  document.body.append(dialog);
  const rowNow=()=>load().find(row=>row.id===editingId&&row.project===currentProject);
  const mayEditFiles=()=>D.canManageAttachments(editingId?rowNow():null,currentUser());
  const mayEdit=()=>!editingId?currentUser().unit==='设计单位':rowNow()?.status==='design'&&D.canHandle(rowNow(),currentUser());
  function closeReturnMenu(){$('drawingReturnMenu').hidden=true;$('drawingReturnMore').setAttribute('aria-expanded','false');}
  function close(){if(busy)return;closeReturnMenu();dialog.hidden=true;document.body.classList.toggle('meeting-modal-open',Boolean(document.querySelector('.meeting-backdrop:not([hidden])')));opener?.focus();}
  function renderFiles(){
    const row=editingId?rowNow():null,groups=new Map();
    files.forEach(file=>{const owned=D.attachmentOwner(file,row);if(!groups.has(owned.uploaderUnit))groups.set(owned.uploaderUnit,[]);groups.get(owned.uploaderUnit).push(owned);});
    $('drawingFiles').innerHTML=[...groups].map(([unit,items])=>'<li class="drawing-file-group"><div class="drawing-file-group-head"><b>'+esc(unit)+'</b><span>'+items.length+' 份附件</span></div><ul>'+items.map(file=>'<li><div class="drawing-file-meta"><strong>'+esc(file.name)+'</strong><small>'+esc(file.uploaderUnit)+' · '+esc(file.uploader)+(file.uploadedAt?' · '+esc(time(file.uploadedAt)):'')+' · '+Math.ceil(file.size/1024)+' KB'+(file.file?' · 本次新增':'')+'</small></div><button type="button" data-drawing-download="'+esc(file.id)+'">下载</button>'+(D.canRemoveAttachment(file,row,currentUser())?'<button type="button" data-drawing-remove="'+esc(file.id)+'">删除</button>':'<small class="drawing-file-locked">仅上传单位在本节点可删除</small>')+'</li>').join('')+'</ul></li>').join('')||'<li class="drawing-files-empty">暂无附件。各单位可在自己的处理节点补充文件。</li>';
    $('drawingAttachmentHint').textContent=mayEditFiles()?'当前可上传'+currentUser().unit+'附件，或删除本单位上传的附件。其他单位附件仅可查看、下载。':'当前为查看状态，附件仅可下载。';
  }
  function basisRows(){
    const current=qaRecords.filter(row=>row.project===currentProject);
    return [...current.filter(row=>D.eligibleQa(row)||selectedQa.has(row.no)),...sourceSnapshots.filter(row=>!current.some(item=>item.no===row.no))];
  }
  function syncBasisSub(){$('drawingQaSub').hidden=$('drawingBasisType').value!=='工程答疑';}
  function renderBasis(){
    const term=$('drawingBasisSearch').value.trim().toLowerCase(),number=$('drawingBasisNo').value.trim().toLowerCase(),discipline=$('drawingBasisDiscipline').value,editable=mayEdit();
    const rows=basisRows().filter(row=>(editable||selectedQa.has(row.no))&&(!term||row.title.toLowerCase().includes(term))&&(!number||[row.no,row.contactNo].join(' ').toLowerCase().includes(number))&&(!discipline||(row.discipline||'未分类')===discipline)&&(!$('drawingBasisSelected').checked||selectedQa.has(row.no)));
    $('drawingBasisCount').textContent='筛选结果 '+rows.length+' 项 · 已选 '+selectedQa.size+' 项（切换筛选保留勾选）';
    $('drawingBasis').innerHTML='<table class="drawing-basis-table"><thead><tr><th>选择</th><th>答疑编号</th><th>问题主题 / 具体内容</th><th>专业</th><th>状态</th></tr></thead><tbody>'+rows.map(row=>'<tr><td><input type="checkbox" aria-label="选择 '+esc(row.contactNo||row.no)+'" data-drawing-qa="'+esc(row.no)+'" '+(selectedQa.has(row.no)?'checked ':'')+(editable?'':'disabled')+'/></td><td>'+esc(row.contactNo||row.no)+'</td><td><strong>'+esc(row.title)+'</strong><details><summary>查看具体问题</summary><p>'+esc(row.description||'暂无问题说明。')+'</p></details></td><td>'+esc(row.discipline||'未分类')+'</td><td>'+esc(row.status)+'</td></tr>').join('')+'</tbody></table>'+(rows.length?'':'<p class="drawing-basis-empty">暂无符合条件的答疑，请调整筛选条件。</p>');
  }
  function renderList(){
    const rows=load().filter(row=>row.project===currentProject).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
    $('drawingNew').disabled=currentUser().unit!=='设计单位';$('drawingNew').title=$('drawingNew').disabled?'仅设计单位可发起':'';
    $('drawingSummary').innerHTML=[['变更总数',rows.length],['我的待办',rows.filter(row=>D.canHandle(row,currentUser())).length],['已归档',rows.filter(row=>row.status==='archived').length],['已作废',rows.filter(row=>row.status==='voided').length]].map(([name,count])=>`<div><span>${name}</span><strong>${count}</strong></div>`).join('');
    const term=$('drawingSearch').value.trim().toLowerCase(),status=$('drawingStatus').value;
    const visible=rows.filter(row=>(status==='all'||row.status===status)&&(!$('drawingOnlyTodo').checked||D.canHandle(row,currentUser()))&&(!term||[row.changeNo,row.no,row.title,row.creatorName].join(' ').toLowerCase().includes(term)));
    $('drawingEmpty').hidden=visible.length>0;
    $('drawingRows').innerHTML=visible.map(row=>`<tr><td><small>${esc(row.changeNo||row.no)}</small><strong>${esc(row.title)}</strong></td><td>${esc(row.basisType||'其他')}<small>${row.qaIds.length} 条工程答疑</small><small>${row.attachments.length} 份依据附件</small></td><td>设计：${money(row.designCostCents)}<small>施工：${money(row.constructionCostCents)}</small><small>监理确认：${money(row.confirmedCostCents)}</small></td><td>${esc(row.creatorName)} · ${esc(row.creatorUnit)}<small>${esc(time(row.updatedAt))}</small></td><td><span class="meeting-badge ${esc(row.status)}">${esc(D.labels[row.status])}</span><button type="button" data-drawing-open="${esc(row.id)}">${D.canHandle(row,currentUser())?'查看 / 处理':'查看详情'}</button></td></tr>`).join('');
  }
  async function open(id=null){
    if(busy)return;
    const account=currentAccountId,project=currentProject;
    if(!id&&currentUser().unit!=='设计单位')return;
    if(id){
      await lock(()=>{if(account!==currentAccountId||project!==currentProject)return;const rows=load(),row=rows.find(item=>item.id===id&&item.project===project);if(!row)return;if(row.recipients?.includes(account)&&!row.readBy?.[account]){row.readBy={...row.readBy,[account]:new Date().toISOString()};localStorage.setItem(key,JSON.stringify(rows));}});
      if(account!==currentAccountId||project!==currentProject)return;
    }
    const row=id?load().find(item=>item.id===id&&item.project===project):null;if(id&&!row)return;
    editingId=id;openedAccount=account;openedProject=project;openedRevision=row?.revision;opener=document.activeElement;
    files=(row?.attachments||[]).map(file=>D.attachmentOwner(file,row));historyFiles=(row?.history||[]).flatMap(item=>[...(item.attachments||[]),...(item.attachmentChanges||[]).map(change=>change.attachment)]);selectedQa=new Set(row?.qaIds||[]);sourceSnapshots=row?.qaSnapshots||[];
    const editable=mayEdit(),handler=row&&D.canHandle(row,currentUser());
    $('drawingDialogTitle').textContent=!row?'发起图纸变更':handler?'处理图纸变更':'图纸变更详情';
    $('drawingIdentity').textContent=row?`${row.changeNo||row.no} · ${D.labels[row.status]} · 发起：${row.creatorName}（${row.creatorUnit}）`:`当前项目：${project} · 发起：${currentUser().name}（设计单位）`;
    $('drawingFlow').innerHTML=D.stages.map((value,index)=>`<span class="${row?.status===value?'current':row?.status==='archived'||(row&&D.stages.indexOf(row.status)>index)?'complete':''}"><b>${index+1}</b>${['设计发起','施工审核 / 估价','监理复核 / 造价确认','业主审核'][index]}</span>`).join('<i>›</i>');
    $('drawingChangeNo').value=row?.changeNo||row?.no||'';$('drawingBasisType').value=row?.basisType||(row?(row.qaIds.length?'工程答疑':'其他'):'');$('drawingChangeNo').disabled=!editable;$('drawingBasisType').disabled=!editable;
    $('drawingTitle').value=row?.title||'';$('drawingDescription').value=row?.description||'';
    $('drawingTitle').disabled=!editable;$('drawingDescription').disabled=!editable;
    for(const [field,value,enabled] of [['drawingDesignCost',row?.designCostCents,editable],['drawingConstructionCost',row?.constructionCostCents,handler&&row.status==='construction'],['drawingConfirmedCost',row?.confirmedCostCents,handler&&row.status==='supervision_final']]){$(field).value=inputMoney(value);$(field).disabled=!enabled;$(field).required=Boolean(enabled);$(field).closest('label').querySelector('.drawing-cost-required').hidden=!enabled;const card=$(field).closest('.drawing-cost-card');card.classList.toggle('is-active',Boolean(enabled));card.querySelector('.drawing-cost-state').textContent=enabled?'本节点填写 · 必填':Number.isSafeInteger(value)?'已填写 · 供核对':'等待'+card.dataset.costUnit+'填写';}
    $('drawingUploadLabel').hidden=!mayEditFiles();$('drawingFilesInput').value='';$('drawingBasisSearch').value='';$('drawingBasisNo').value='';$('drawingBasisSelected').checked=false;
    const disciplines=[...new Set(basisRows().map(row=>row.discipline||'未分类'))].sort();$('drawingBasisDiscipline').innerHTML='<option value="">全部专业</option>'+disciplines.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('');
    $('drawingOpinion').value='';$('drawingOpinionLabel').hidden=!row||!handler;
    $('drawingTaskHeader').hidden=Boolean(row&&!handler);$('drawingOpinionSection').hidden=!row||!handler;$('drawingOpinionUnit').textContent=currentUser().unit+' · 本节点填写';$('drawingOpinion').required=Boolean(handler);$('drawingBasics').classList.toggle('is-active',editable);
    $('drawingActionHint').textContent=row?.status==='construction'?'施工审核时请填写施工预估造价变动及意见，提交后进入监理复核。':row?.status==='supervision_final'?'请对比设计与施工估价，填写监理确认造价变动，并在意见中说明核定依据。':row?.status==='owner'?'请结合三方造价和意见审核。点击“确定”归档；退回按钮右侧箭头可选择退回节点，或作废整个流程。':editable?'请填写变更信息、设计预估造价，可上传设计单位附件。填写完成后点击“确定”。':'请填写本节点处理意见，可补充本单位附件。';
    $('drawingSubmit').hidden=Boolean(row&&!handler);$('drawingReturn').hidden=!row||!handler||row.status==='design';$('drawingVoid').hidden=!row||!D.canVoid(row,currentUser());
    $('drawingReturnGroup').hidden=$('drawingReturn').hidden;$('drawingReturnMore').hidden=!row||!D.canVoid(row,currentUser());$('drawingReturnGroup').classList.toggle('has-menu',!$('drawingReturnMore').hidden);
    $('drawingReturnTargets').innerHTML=(row&&D.canVoid(row,currentUser())?D.returnTargets(row,currentUser()):[]).map(target=>'<button type="button" role="menuitem" data-drawing-return-target="'+target+'">'+({design:'退回设计修改',construction:'退回施工审核',supervision_final:'退回监理复核'}[target])+'</button>').join('');closeReturnMenu();
    $('drawingSubmit').textContent='确定';
    $('drawingHistory').innerHTML=row?.history.map(item=>`<div><b>${esc(item.action)}</b><span>${esc(item.actor)} · ${esc(item.unit)} · ${esc(time(item.time))}</span><p>${esc(item.note)}</p>${item.costs?`<p>设计估价：${money(item.costs.designCostCents)}；施工估价：${money(item.costs.constructionCostCents)}；监理确认：${money(item.costs.confirmedCostCents)}</p>`:''}${item.attachments?.length?`<p>本次依据附件：${item.attachments.map(file=>'<button type="button" data-drawing-download="'+esc(file.id)+'">'+esc(file.uploaderUnit||item.unit)+' · '+esc(file.name)+'</button>').join('、')}</p>`:''}${item.attachmentChanges?.some(change=>change.type==='删除附件')?'<p>本次删除：'+item.attachmentChanges.filter(change=>change.type==='删除附件').map(change=>esc(change.attachment.uploaderUnit)+' · '+esc(change.attachment.name)).join('、')+'</p>':''}<small>下一节点：${esc(D.labels[item.to]||item.to)}</small></div>`).join('')||'<p>提交后生成流转和造价审核记录。</p>';
    $('drawingError').textContent='';syncBasisSub();renderFiles();renderBasis();dialog.hidden=false;document.body.classList.add('meeting-modal-open');$('drawingClose').focus();renderList();renderMatterPanel();
  }
  const draft=()=>({project:currentProject,changeNo:$('drawingChangeNo').value.trim(),basisType:$('drawingBasisType').value,title:$('drawingTitle').value.trim(),description:$('drawingDescription').value.trim(),designCost:$('drawingDesignCost').value,constructionCost:$('drawingConstructionCost').value,confirmedCost:$('drawingConfirmedCost').value,qaIds:$('drawingBasisType').value==='工程答疑'?[...selectedQa]:[],attachments:files.map(({file,...metadata})=>metadata)});
  async function submit(action,returnTarget=null){
    if(busy)return;busy=true;dialog.querySelectorAll('footer button').forEach(button=>button.disabled=true);
    try{
      await lock(async()=>{
        if(openedAccount!==currentAccountId||openedProject!==currentProject)throw Error('账号或项目已切换，请重新打开流程。');
        const rows=load(),row=rows.find(item=>item.id===editingId&&item.project===currentProject);
        if(editingId&&(!row||row.revision!==openedRevision))throw Error('流程已经更新，请关闭后重新打开查看最新节点。');
        const data=draft();if(returnTarget)data.returnTarget=returnTarget;
        if((!row||row.status==='design')&&rows.some(item=>item.project===currentProject&&item.id!==row?.id&&(item.changeNo||item.no).trim().toLowerCase()===data.changeNo.toLowerCase()))throw Error('当前项目已存在这个变更号，请使用其他编号。');
        const result=row?D.transition(row,currentUser(),currentAccountId,action,$('drawingOpinion').value,data,qaRecords):D.create(data,currentUser(),currentAccountId,qaRecords,Object.keys(smartWorksUsers),crypto.randomUUID());
        const addedIds=new Set((result.history.at(-1).attachmentChanges||[]).filter(change=>change.type==='新增附件').map(change=>change.attachment.id));
        await writeFiles(files.filter(file=>file.file&&addedIds.has(file.id)));
        if(openedAccount!==currentAccountId||openedProject!==currentProject)throw Error('账号或项目已切换，本次操作未提交。');
        localStorage.setItem(key,JSON.stringify(row?rows.map(item=>item.id===result.id?result:item):[result,...rows]));
      });
      busy=false;close();renderList();renderMatterPanel();
    }catch(error){$('drawingError').textContent=error.message;if(!$('drawingOpinion').value.trim()&&!$('drawingOpinionSection').hidden)$('drawingOpinion').focus();}finally{busy=false;dialog.querySelectorAll('footer button').forEach(button=>button.disabled=false);}
  }
  $('drawingNew').addEventListener('click',()=>open());$('drawingRows').addEventListener('click',event=>{const button=event.target.closest('[data-drawing-open]');if(button)open(button.dataset.drawingOpen);});
  $('drawingStatus').addEventListener('change',renderList);$('drawingOnlyTodo').addEventListener('change',renderList);$('drawingSearch').addEventListener('input',renderList);
  $('drawingForm').addEventListener('submit',event=>{event.preventDefault();submit('approve');});$('drawingReturn').addEventListener('click',()=>{closeReturnMenu();submit('return');});$('drawingVoid').addEventListener('click',()=>{closeReturnMenu();submit('void');});
  $('drawingReturnMore').addEventListener('click',()=>{if(busy||!D.canVoid(rowNow(),currentUser()))return;const open=$('drawingReturnMenu').hidden;$('drawingReturnMenu').hidden=!open;$('drawingReturnMore').setAttribute('aria-expanded',String(open));if(open)$('drawingReturnMenu').querySelector('[role=menuitem]')?.focus();});
  $('drawingReturnTargets').addEventListener('click',event=>{const button=event.target.closest('[data-drawing-return-target]');if(button){closeReturnMenu();submit('return',button.dataset.drawingReturnTarget);}});
  document.addEventListener('click',event=>{if(!$('drawingReturnGroup').contains(event.target))closeReturnMenu();});
  $('drawingClose').addEventListener('click',close);$('drawingCancel').addEventListener('click',close);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(!$('drawingReturnMenu').hidden){closeReturnMenu();$('drawingReturnMore').focus();}else close();}if(event.key==='Tab'){const controls=[...dialog.querySelectorAll('button,input,textarea,summary')].filter(el=>!el.disabled&&el.getClientRects().length);if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}}});
  $('drawingBasisType').addEventListener('change',syncBasisSub);
  $('drawingBasisSearch').addEventListener('input',renderBasis);$('drawingBasisNo').addEventListener('input',renderBasis);$('drawingBasisDiscipline').addEventListener('change',renderBasis);$('drawingBasisSelected').addEventListener('change',renderBasis);
  $('drawingBasisReset').addEventListener('click',()=>{$('drawingBasisSearch').value='';$('drawingBasisNo').value='';$('drawingBasisDiscipline').value='';$('drawingBasisSelected').checked=false;renderBasis();});$('drawingBasis').addEventListener('change',event=>{const id=event.target.dataset.drawingQa;if(id&&mayEdit()&&!busy){if(event.target.checked)selectedQa.add(id);else selectedQa.delete(id);renderBasis();}});
  $('drawingFilesInput').addEventListener('change',()=>{
    if(!mayEditFiles()||busy)return;
    $('drawingError').textContent='';
    for(const file of $('drawingFilesInput').files){
      if(!/\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|webp|dwg|dxf|zip|txt)$/i.test(file.name)){$('drawingError').textContent='不支持的附件格式：'+file.name;continue;}
      if(file.size>20*1024*1024){$('drawingError').textContent='单份附件不能超过 20 MB：'+file.name;continue;}
      if(!files.some(item=>item.uploaderUnit===currentUser().unit&&item.name===file.name&&item.size===file.size&&item.lastModified===file.lastModified))files.push({id:crypto.randomUUID(),name:file.name,size:file.size,type:file.type,lastModified:file.lastModified,uploaderUnit:currentUser().unit,uploader:currentUser().name,uploaderId:currentAccountId,uploadedAt:new Date().toISOString(),file});
    }
    $('drawingFilesInput').value='';renderFiles();
  });
  $('drawingFiles').addEventListener('click',event=>{const downloadButton=event.target.closest('[data-drawing-download]'),remove=event.target.closest('[data-drawing-remove]');if(downloadButton)download(downloadButton.dataset.drawingDownload);if(remove&&!busy){const file=files.find(item=>item.id===remove.dataset.drawingRemove);if(file&&D.canRemoveAttachment(file,editingId?rowNow():null,currentUser())){files=files.filter(item=>item.id!==file.id);renderFiles();}}});
  $('drawingHistory').addEventListener('click',event=>{const button=event.target.closest('[data-drawing-download]');if(button)download(button.dataset.drawingDownload);});
  window.appendDrawingChangeMatters=({host,filter})=>{
    const scoped=load().filter(row=>row.project===currentProject),withKind=scoped.map(row=>({row,kind:D.kind(row,currentAccountId,currentUser())}));
    for(const [id,kind] of [['matterUnreadCount','unread'],['matterTodoCount','todo']])$(id).textContent=(Number($(id).textContent||0)+withKind.filter(item=>item.kind===kind).length)||'';
    const visible=withKind.filter(({row,kind})=>filter==='all'?kind==='todo'||kind==='unread':filter==='done'?kind!=='todo'&&row.history.some(item=>item.actor===currentUser().name&&item.unit===currentUser().unit):kind===filter);
    if(visible.length)host.querySelector('.matter-empty')?.remove();
    visible.forEach(({row,kind})=>{
      const article=document.createElement('article');article.className='matter';article.dataset.unread=String(kind==='unread');article.dataset.matterTime=String(Date.parse(row.updatedAt)||0);
      article.innerHTML=`<span class="dot"></span><div><span class="module">图纸变更 · ${esc(D.labels[row.status])}</span><h3><button type="button" class="meeting-matter-title ${kind==='unread'?'unread':''}">${esc(row.title)}</button></h3></div><div class="date"><span>最近处理时间</span><time>${esc(time(row.updatedAt))}</time></div><button type="button" class="state-link matter-state">${kind==='todo'?'去处理':kind==='unread'?'待读通知':'查看详情'}</button>`;
      article.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>open(row.id)));host.append(article);
    });
  };
  window.closeDrawingChangeDialog=close;
  window.renderDrawingChanges=()=>{if(!dialog.hidden&&(openedAccount!==currentAccountId||openedProject!==currentProject))close();renderList();renderMatterPanel();};
  window.addEventListener('storage',event=>{if(event.key===key){renderList();renderMatterPanel();}});
  renderList();renderMatterPanel();
})();
