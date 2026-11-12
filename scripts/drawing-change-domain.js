/* Design → construction → supervision → owner. */
(() => {
  const stages=['design','construction','supervision_final','owner'];
  const labels={design:'退回设计修改',construction:'待施工审核',supervision_final:'待监理复核',owner:'待业主审核',archived:'已归档',voided:'已作废'};
  const units={design:'设计单位',construction:'施工单位',supervision_final:'监理单位',owner:'建设单位'};
  const basisTypes=['建设单位要求调整','设计完善','现场条件变化','会议纪要','工程答疑','其他'];
  const normalizeLegacy=row=>row.status==='supervision_first'?{...row,status:'construction',revision:(row.revision||0)+1,readBy:{},history:[...(row.history||[]),{action:'流程调整：直接进入施工审核',actor:'系统',unit:'系统',note:'取消监理初审，原始处理记录保留。',time:new Date().toISOString(),from:'design',to:'construction'}]}:row;
  const terminal=row=>['archived','voided'].includes(row.status);
  const canHandle=(row,user)=>!terminal(row)&&units[row.status]===user?.unit;
  const canVoid=(row,user)=>row?.status==='owner'&&user?.unit==='建设单位';
  const returnTargets=(row,user)=>{
    if(!canHandle(row,user))return [];
    const index=stages.indexOf(row.status);
    if(index<=0)return [];
    return row.status==='owner'&&user.unit==='建设单位'?stages.slice(0,index):[stages[index-1]];
  };
  const attachmentOwner=(file,row)=>({...file,uploaderUnit:file.uploaderUnit||row?.creatorUnit||'设计单位',uploader:file.uploader||row?.creatorName||'设计单位',uploaderId:file.uploaderId||row?.creatorId||'',uploadedAt:file.uploadedAt||row?.createdAt||''});
  const canManageAttachments=(row,user)=>row?canHandle(row,user):user?.unit==='设计单位';
  const canRemoveAttachment=(file,row,user)=>canManageAttachments(row,user)&&attachmentOwner(file,row).uploaderUnit===user?.unit;
  function reconcileAttachments(row,proposed,user,accountId,now){
    const previous=(row?.attachments||[]).map(file=>attachmentOwner(file,row));
    const requested=proposed===undefined?previous:proposed;
    if(!Array.isArray(requested)||requested.some(file=>!file?.id||typeof file.name!=='string')||new Set(requested.map(file=>file.id)).size!==requested.length)throw Error('附件信息无效，请重新打开流程。');
    const removed=previous.filter(file=>!requested.some(item=>item.id===file.id));
    if(removed.some(file=>!canRemoveAttachment(file,row,user)))throw Error('只能在本单位处理节点删除本单位上传的附件。');
    const historicalIds=new Set((row?.history||[]).flatMap(item=>item.attachments||[]).map(file=>file.id));
    const added=[];
    const attachments=requested.map(file=>{
      const original=previous.find(item=>item.id===file.id);
      if(original)return original; // Ownership and metadata of existing attachments are immutable.
      if(!canManageAttachments(row,user)||historicalIds.has(file.id))throw Error('不能修改或覆盖其他节点的历史附件。');
      const uploaded={id:file.id,name:file.name,size:file.size||0,type:file.type||'',lastModified:file.lastModified||0,uploaderUnit:user.unit,uploader:user.name,uploaderId:accountId,uploadedAt:new Date(now).toISOString()};
      added.push(uploaded);return uploaded;
    });
    return {attachments,added,removed,changes:[...added.map(attachment=>({type:'新增附件',attachment})),...removed.map(attachment=>({type:'删除附件',attachment}))]};
  }
  const cost=(value,label)=>{
    const text=String(value??'').trim();
    if(!text)throw Error('请填写'+label+'（万元）。');
    if(!/^-?\d+(\.\d{1,6})?$/.test(text)||!Number.isSafeInteger(Math.round(Number(text)*1000000)))throw Error('请填写有效的'+label+'（万元，最多六位小数）。');
    return Math.round(Number(text)*1000000);
  };
  const eligibleQa=row=>row.status==='出具变更'||row.status==='已转变更'||row.step==='changed';
  const validate=(draft,qaRows,existing=null)=>{
    if(!draft.changeNo?.trim())throw Error('请填写变更号。');
    if(draft.changeNo.trim().length>60)throw Error('变更号最多 60 字。');
    if(!basisTypes.includes(draft.basisType))throw Error('请选择变更依据。');
    if(!draft.title?.trim())throw Error('请填写变更主题。');
    if(draft.title.trim().length>100)throw Error('变更主题最多 100 字。');
    if(!draft.description?.trim())throw Error('请填写变更说明。');
    cost(draft.designCost,'设计预估造价变动');
    if(draft.description.trim().length>4000)throw Error('变更说明最多 4000 字。');
    if(draft.qaIds?.some(id=>!qaRows.some(q=>q.no===id&&q.project===draft.project&&eligibleQa(q))&&!existing?.qaSnapshots?.some(q=>q.no===id&&q.project===draft.project)))throw Error('部分答疑依据已变化，请重新选择。');
  };
  const event=(action,user,note,now,from,to,attachments=[])=>({action,actor:user.name,unit:user.unit,note,time:new Date(now).toISOString(),from,to,attachments});
  function create(draft,user,accountId,qaRows,recipients,id,now=Date.now()){
    if(user?.unit!=='设计单位')throw Error('仅设计单位可发起图纸变更。');
    validate(draft,qaRows);
    const stamp=new Date(now).toISOString();
    const designCostCents=cost(draft.designCost,'设计预估造价变动');
    const fileUpdate=reconcileAttachments(null,draft.attachments,user,accountId,now);
    return {...draft,attachments:fileUpdate.attachments,changeNo:draft.changeNo.trim(),designCostCents,constructionCostCents:null,confirmedCostCents:null,title:draft.title.trim(),description:draft.description.trim(),id,no:'TZBG-'+new Date(now).getFullYear()+'-'+id.replace(/-/g,'').slice(0,10).toUpperCase(),status:'construction',revision:1,creatorId:accountId,creatorName:user.name,creatorUnit:user.unit,createdAt:stamp,updatedAt:stamp,recipients:[...recipients],readBy:{[accountId]:stamp},qaSnapshots:qaRows.filter(q=>draft.qaIds.includes(q.no)&&q.project===draft.project).map(q=>({no:q.no,contactNo:q.contactNo,title:q.title,description:q.description,status:q.status,discipline:q.discipline,project:q.project})),history:[{...event('设计发起图纸变更',user,draft.description.trim(),now,'design','construction',fileUpdate.added),attachmentChanges:fileUpdate.changes,costs:{designCostCents}}]};
  }
  function transition(row,user,accountId,action,note,draft,qaRows,now=Date.now()){
    if(terminal(row))throw Error('该流程已经结束，不能继续处理。');
    if(action==='void'?!canVoid(row,user):!canHandle(row,user))throw Error('当前账号无权处理此节点。');
    const opinion=String(note||'').trim();
    if(!opinion)throw Error(action==='void'?'请填写作废原因。':action==='return'?'请填写退回原因。':'请填写处理意见。');
    if(opinion.length>2000)throw Error('处理意见最多 2000 字。');
    const index=stages.indexOf(row.status);if(index<0)throw Error('流程节点无效，请刷新。');let status,description,updates={};
    if(action==='void'){status='voided';description='业主作废流程';}
    else if(action==='return'){
      if(index<=0)throw Error('设计发起节点没有可退回的上一节点。');
      status=draft?.returnTarget||stages[index-1];
      if(!returnTargets(row,user).includes(status))throw Error('当前节点不允许退回到所选节点。');
      description=(status===stages[index-1]?'退回上一节点：':'退回指定节点：')+(status==='design'?'设计修改':labels[status]);
      updates.confirmedCostCents=null;
      if(status==='design')updates.constructionCostCents=null;
    }else if(action==='approve'){
      status=stages[index+1]||'archived';description=row.status==='design'?'设计修改后重新提交':row.status==='owner'?'业主审核通过并归档':labels[row.status].replace(/^待/,'')+'通过';
      if(row.status==='design'){
        validate(draft,qaRows,row);
        const snapshots=draft.qaIds.map(id=>qaRows.find(q=>q.no===id&&q.project===row.project)||row.qaSnapshots.find(q=>q.no===id));
        updates={changeNo:draft.changeNo.trim(),basisType:draft.basisType,designCostCents:cost(draft.designCost,'设计预估造价变动'),constructionCostCents:null,confirmedCostCents:null,title:draft.title.trim(),description:draft.description.trim(),qaIds:[...draft.qaIds],attachments:[...draft.attachments],qaSnapshots:snapshots.map(q=>({no:q.no,contactNo:q.contactNo,title:q.title,description:q.description,status:q.status,discipline:q.discipline,project:q.project}))};
      }
      if(row.status==='construction')updates.constructionCostCents=cost(draft?.constructionCost,'施工预估造价变动');
      if(row.status==='supervision_final'){
        if(!Number.isSafeInteger(row.constructionCostCents))throw Error('施工预估造价尚未填写，需退回施工单位补充。');
        updates.confirmedCostCents=cost(draft?.confirmedCost,'监理确认造价变动');
        description='监理复核及造价确认通过';
      }
      if(row.status==='owner'&&!Number.isSafeInteger(row.confirmedCostCents))throw Error('监理尚未确认造价，需退回监理复核。');
    }else throw Error('不支持此操作。');
    const fileUpdate=reconcileAttachments(row,draft?.attachments,user,accountId,now);
    updates.attachments=fileUpdate.attachments;
    const stamp=new Date(now).toISOString();
    return {...row,...updates,status,revision:row.revision+1,updatedAt:stamp,readBy:{[accountId]:stamp},closedAt:['archived','voided'].includes(status)?stamp:null,history:[...row.history,{...event(description,user,opinion,now,row.status,status,fileUpdate.added),attachmentChanges:fileUpdate.changes,costs:{designCostCents:updates.designCostCents??row.designCostCents,constructionCostCents:Object.hasOwn(updates,'constructionCostCents')?updates.constructionCostCents:row.constructionCostCents,confirmedCostCents:Object.hasOwn(updates,'confirmedCostCents')?updates.confirmedCostCents:row.confirmedCostCents}}]};
  }
  const kind=(row,accountId,user)=>canHandle(row,user)?'todo':row.recipients?.includes(accountId)?row.readBy?.[accountId]?'read':'unread':null;
  window.DrawingChangeDomain={stages,labels,units,basisTypes,normalizeLegacy,terminal,canHandle,canVoid,returnTargets,eligibleQa,validate,create,transition,kind,cost,attachmentOwner,canManageAttachments,canRemoveAttachment,reconcileAttachments};
})();
