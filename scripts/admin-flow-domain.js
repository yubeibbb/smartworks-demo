/* Administrator-only workflow deletion and an independent deletion ledger. */
(() => {
  const labels={qa:'工程答疑',meeting:'会议协调',drawing:'图纸变更'};
  const key=(kind,row)=>JSON.stringify([kind,row.project,kind==='qa'?row.no:row.id]);
  function catalog(qa,meetings,drawings){
    return Object.entries({qa,meeting:meetings,drawing:drawings}).flatMap(([kind,rows])=>rows.map(record=>({key:key(kind,record),kind,id:kind==='qa'?record.no:record.id,no:record.contactNo||record.changeNo||record.no||record.id,title:record.title||'未命名流程',project:record.project,status:record.status,record})));
  }
  function plan(rows,selected){
    if(!selected.length)throw Error('请先选择要删除的流程。');
    if(selected.some(id=>!rows.some(row=>row.key===id)))throw Error('部分流程已变化，请刷新列表后重新选择。');
    const chosen=new Set(selected),qaKeys=new Set(rows.filter(row=>row.kind==='qa'&&chosen.has(row.key)).map(row=>JSON.stringify([row.project,row.id])));
    const items=rows.filter(row=>chosen.has(row.key)||(row.kind!=='qa'&&(row.kind==='meeting'?row.record.issueIds||[]:row.record.qaIds||[]).some(id=>qaKeys.has(JSON.stringify([row.project,id])))));
    return {items,linked:items.filter(row=>!chosen.has(row.key)).length};
  }
  function deletion(qa,meetings,drawings,selected,user,accountId,reason,id,now=Date.now()){
    if(!user?.admin)throw Error('仅系统管理员可删除流程。');
    const note=String(reason||'').trim();if(!note)throw Error('请填写删除原因。');if(note.length>1000)throw Error('删除原因最多 1000 字。');
    const result=plan(catalog(qa,meetings,drawings),selected),keys=new Set(result.items.map(item=>item.key));
    return {qa:qa.filter(row=>!keys.has(key('qa',row))),meetings:meetings.filter(row=>!keys.has(key('meeting',row))),drawings:drawings.filter(row=>!keys.has(key('drawing',row))),log:{id,actorId:accountId,actor:user.name,unit:user.unit,time:new Date(now).toISOString(),reason:note,count:result.items.length,linked:result.linked,items:JSON.parse(JSON.stringify(result.items))}};
  }
  window.AdminFlowDomain={labels,key,catalog,plan,deletion};
})();
