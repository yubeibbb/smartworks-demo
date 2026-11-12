/* Meeting coordination prototype: deterministic validation and transitions. */
(() => {
  const unresolved = row => !['已归档', '已完成', '出具变更', '已转变更', '已退回施工单位', '业主已批示'].includes(row.status);
  const needsCoordination = row => ['已转需业主协调', '需业主协调'].includes(row.status);
  const groupIssues = rows => ({coordination: rows.filter(row=>needsCoordination(row)&&!row.ownerDirective), other: rows.filter(row=>!needsCoordination(row)||row.ownerDirective)});
  const coordinationPending = (row, meetings) => needsCoordination(row) && !row.ownerDirective && !meetings.some(meeting => meeting.project === row.project && meeting.issueIds?.includes(row.no));
  function coordinationState(row, meetings) {
    const linked = meetings.filter(meeting => meeting.project === row.project && meeting.issueIds?.includes(row.no));
    const meeting = linked.find(m=>['published','directed'].includes(m.status)) || linked.find(m=>m.status==='pending') || linked[0];
    return {meeting, resolved: Boolean(row.ownerDirective) || ['published','directed'].includes(meeting?.status), canBook: !row.ownerDirective && (!meeting || meeting.status === 'returned'), label: row.ownerDirective || meeting?.status === 'directed' ? '已归档 · 业主批示' : meeting?.status === 'published' ? '已协调 · 会议已发布' : meeting?.status === 'pending' ? '待会议审核' : meeting?.status === 'returned' ? '待重新预约' : '待预约'};
  }
  const isReviewer = user => user?.unit === '建设单位';
  function validate(draft, issues, now = Date.now()) {
    if (!draft.title?.trim()) throw Error('请填写会议主题。');
    if (!draft.location?.trim()) throw Error('请填写会议地点。');
    if (!draft.start || !Number.isFinite(Date.parse(draft.start))) throw Error('请选择有效的会议时间。');
    if (Date.parse(draft.start) <= now) throw Error('会议开始时间必须晚于当前时间。');
    if (!draft.issueIds?.length) throw Error('请勾选至少一个需要协调的工程答疑问题。');
    if (draft.issueIds.some(id => !issues.some(issue => issue.no === id && issue.project === draft.project))) throw Error('部分问题已不存在或不属于当前项目，请重新选择。');
    if (!draft.attendees?.length) throw Error('请勾选至少一个参会单位。');
  }
  function approve(record, user, draft, issues, recipientIds, now = Date.now()) {
    if (!isReviewer(user)) throw Error('仅建设单位负责人可审核并发布会议。');
    if (record.status !== 'pending') throw Error('此预约已处理，请刷新后查看。');
    validate(draft, issues, now);
    return {...record,...draft,status:'published',reviewer:user.name,publishedAt:new Date(now).toISOString(),recipients:[...new Set(recipientIds)],readBy:{},history:[...record.history,{action:'审核通过并发布通知',actor:user.name,unit:user.unit,time:new Date(now).toISOString(),note:draft.reviewNote||''}]};
  }
  function direct(record, user, opinions, issues, recipientIds, accountId, now = Date.now()) {
    if (!isReviewer(user) || record.status !== 'pending') throw Error('仅建设单位可对待审核预约进行批示。');
    if (!record.issueIds?.length) throw Error('该预约没有关联问题。');
    const items = record.issueIds.map(no => {
      const issue = issues.find(item => item.no === no && item.project === record.project);
      if (!issue) throw Error('关联问题已不存在，请重新查看预约。');
      const opinion = String(opinions[no] || '').trim();
      if (!opinion) throw Error('请为每一个关联问题填写批示意见。');
      if (opinion.length > 2000) throw Error('单项批示最多 2000 字。');
      return {no, title: issue.title, opinion, author: user.name, unit: user.unit, time: new Date(now).toISOString()};
    });
    const updatedIssues = issues.map(issue => {
      const instruction = items.find(item => item.no === issue.no && issue.project === record.project);
      if (!instruction) return issue;
      const unreadFor = {...issue.unreadFor}; recipientIds.forEach(id=>{if(id!==accountId)unreadFor[id]=true;}); delete unreadFor[accountId];
      const readBy = {...issue.readBy}; recipientIds.forEach(id=>{if(id!==accountId)delete readBy[id];}); readBy[accountId]=true;
      return {...issue, ...(needsCoordination(issue)?{ownerDirective:{...instruction,meetingId:record.id},status:'已归档',step:'done',nextNode:'已归档（业主批示结案）'}:{}), unreadFor, readBy, handledBy:{...issue.handledBy,[accountId]:true},
        replies:[...(issue.replies||[]),{action:'建设单位逐项批示（不召开会议）',content:instruction.opinion,unit:user.unit,user:user.name,time:new Date(now).toLocaleString('sv-SE',{timeZone:'Asia/Hong_Kong',hour12:false}),nextNode:needsCoordination(issue)?'已归档（业主批示结案）':'批示已发布',attachments:[]}],
        ownerInstructions:[...(issue.ownerInstructions||[]),{...instruction,meetingId:record.id}]};
    });
    const meeting = {...record,status:'directed',reviewer:user.name,publishedAt:new Date(now).toISOString(),issueInstructions:items,recipients:[...new Set(recipientIds)],readBy:{},history:[...record.history,{action:'逐项批示并通知（不召开会议）',actor:user.name,unit:user.unit,time:new Date(now).toISOString(),note:'已对 '+items.length+' 个问题分别作出批示，无需召开会议。'}]};
    return {meeting,issues:updatedIssues};
  }
  function instructIssue(issue, user, opinion, accountId, recipientIds, now = Date.now()) {
    if (!needsCoordination(issue) || issue.ownerDirective) throw Error('该问题已处理或不在待协调状态，请刷新后查看。');
    const record={id:'PS-'+now+'-'+issue.no,no:'PS-'+String(now),kind:'issue-instruction',project:issue.project,title:'业主批示：'+issue.title,location:'',start:'',status:'pending',creatorId:accountId,creatorName:user.name,creatorUnit:user.unit,createdAt:new Date(now).toISOString(),issueIds:[issue.no],attendees:[],issueSnapshots:[{no:issue.no,contactNo:issue.contactNo,title:issue.title,description:issue.description,status:issue.status,project:issue.project}],history:[]};
    const result=direct(record,user,{[issue.no]:opinion},[issue],recipientIds,accountId,now);
    return {decision:result.meeting,issue:result.issues[0]};
  }
  function reject(record, user, reason, now = Date.now()) {
    if (!isReviewer(user) || record.status !== 'pending') throw Error('当前账号或预约状态不允许退回。');
    if (!reason.trim()) throw Error('请填写退回原因。');
    return {...record,status:'returned',returnReason:reason.trim(),history:[...record.history,{action:'退回修改',actor:user.name,unit:user.unit,time:new Date(now).toISOString(),note:reason.trim()}]};
  }
  const kind = (row, accountId, user) => row.suppressNotice ? null : row.status==='pending'&&isReviewer(user)?'todo':row.status==='returned'&&row.creatorId===accountId?'todo':['published','directed'].includes(row.status)&&row.recipients?.includes(accountId)?(row.readBy?.[accountId]?'read':'unread'):null;
  window.MeetingDomain = {unresolved,needsCoordination,groupIssues,coordinationPending,coordinationState,isReviewer,validate,approve,direct,instructIssue,reject,kind};
})();
