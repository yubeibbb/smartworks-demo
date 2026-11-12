/*
 * 项目资料问答、历史对话、资料上传和资料查询的静态交互。
 * 本文件集中维护资料类别，上传分类选择与资料查询分组共用同一套定义。
 * 问答通过同源本地服务调用已配置的模型；资料分类、上传与归档仍是本地演示数据。
 */
(() => {
  const questionForm = document.querySelector("#aiQuestionForm");
  const questionInput = document.querySelector("#aiQuestionInput");
  const sendButton = document.querySelector("#aiSendButton");
  const conversationPanel = document.querySelector("#aiConversation");
  const historyList = document.querySelector("#aiHistoryList");
  const historyContextMenu = document.createElement("div");
  historyContextMenu.className = "ai-history-context-menu";
  historyContextMenu.setAttribute("role", "menu");
  historyContextMenu.hidden = true;
  const renameHistoryButton = document.createElement("button");
  renameHistoryButton.type = "button";
  renameHistoryButton.setAttribute("role", "menuitem");
  renameHistoryButton.textContent = "自定义名称";
  const deleteHistoryButton = document.createElement("button");
  deleteHistoryButton.type = "button";
  deleteHistoryButton.setAttribute("role", "menuitem");
  deleteHistoryButton.className = "danger";
  deleteHistoryButton.textContent = "删除对话";
  historyContextMenu.append(renameHistoryButton, deleteHistoryButton);
  document.body.appendChild(historyContextMenu);
  const fileInput = document.querySelector("#materialFileInput");
  const dropzone = document.querySelector("#materialDropzone");
  const fileList = document.querySelector("#materialFileList");
  const emptyState = document.querySelector("#materialEmpty");
  const pendingCount = document.querySelector("#materialPendingCount");
  const confirmAll = document.querySelector("#materialConfirmAll");
  const libraryGroups = document.querySelector("#libraryGroups");
  const libraryTabs = document.querySelector("#libraryCategoryTabs");
  const librarySearch = document.querySelector("#librarySearchInput");
  const folderDialog = document.querySelector("#materialFolderDialog");
  const folderForm = document.querySelector("#materialFolderForm");
  const folderCategory = document.querySelector("#materialFolderCategory");
  const folderParent = document.querySelector("#materialFolderParent");
  const folderName = document.querySelector("#materialFolderName");
  const modelSettingsDialog = document.querySelector("#aiModelSettingsDialog");
  const modelSettingsStatus = document.querySelector("#aiModelSettingsStatus");
  const connectionSummary = document.querySelector("#aiConnectionSummary");
  const savedConnection = document.querySelector("#aiSavedConnection");
  const savedConnectionTitle = document.querySelector("#aiSavedConnectionTitle");
  const savedConnectionDetail = document.querySelector("#aiSavedConnectionDetail");
  const savedKeyHint = document.querySelector("#aiApiKeySavedHint");
  const baseUrlInput = document.querySelector("#aiBaseUrlInput");
  const modelInput = document.querySelector("#aiModelInput");
  const providerHeading = document.querySelector("#aiProviderHeading");
  const providerState = document.querySelector("#aiProviderState");
  const providerEnableButton = document.querySelector("#aiProviderEnableButton");
  const providerChoices = [...document.querySelectorAll("[data-provider-choice]")];
  const addProviderButton = document.querySelector("#aiAddProviderButton");
  const addModelButton = document.querySelector("#aiAddModelButton");
  const modelTags = document.querySelector("#aiModelTags");
  let selectedProvider = "deepseek";
  let connectionEnabled = true;
  let availableModels = [];
  const apiKeyInput = document.querySelector("#aiApiKeyInput");
  const toggleKeyVisibility = document.querySelector("#aiToggleKeyVisibility");
  const modelSaveButton = document.querySelector("#aiModelSaveButton");
  const modelTestButton = document.querySelector("#aiModelTestButton");
  // VS Code 静态预览常用 4183；问答服务固定运行在本机 4184。
  const apiBaseUrl = window.location.port === "4183" ? "http://127.0.0.1:4184" : "";
  const apiUrl = (path) => `${apiBaseUrl}${path}`;
  if (!questionForm || !fileInput || !dropzone || !libraryGroups) return;

  // 新增、改名或调整类别时，只改这里；上传选择器和资料查询会同步使用。
  let categoryDefinitions = [
    {
      id: "approval",
      name: "报批立项",
      keywords: ["立项", "规划许可", "施工许可", "报批", "报建", "批复"],
    },
    {
      id: "tender-contract",
      name: "招标与合同",
      keywords: ["招标", "投标", "合同", "协议", "采购"],
    },
    {
      id: "design-technical",
      name: "设计与技术",
      keywords: ["图纸", "施工图", "设计", "技术", "规范", "会审"],
    },
    {
      id: "construction-quality-safety",
      name: "施工质量与安全",
      keywords: ["施工方案", "施工日志", "质量", "安全", "验收", "检查", "试验"],
    },
    {
      id: "schedule-meetings",
      name: "进度与会议",
      keywords: ["会议", "纪要", "进度", "计划", "协调"],
    },
    {
      id: "change-claims-settlement",
      name: "变更签证与结算",
      keywords: ["变更", "签证", "结算", "计量", "支付", "洽商"],
    },
    {
      id: "other",
      name: "其他 / 待人工确认",
      keywords: [],
    },
  ];
  // 演示版先给每个固定大类放两个示例子文件夹；用户可继续手动添加多层目录。
  let folders = categoryDefinitions.flatMap((category) => [
    {
      id: `${category.id}-item-1`,
      categoryId: category.id,
      parentId: "",
      name: "事项一",
    },
    {
      id: `${category.id}-item-2`,
      categoryId: category.id,
      parentId: "",
      name: "事项二",
    },
  ]);


  const folderStorageKey = 'smartworks-library-folders-v1';
  const directoryStorageKey = 'smartworks-library-directory-v2';
  let hiddenDemoFiles = [], demoLocations = {}, directoryUndo = null;
  function validDirectory(categories, items) {
    if (!Array.isArray(categories)||!Array.isArray(items)) return false;
    if (!categories.every(c=>typeof c.id==='string'&&typeof c.name==='string'&&Array.isArray(c.keywords)) || new Set(categories.map(c=>c.id)).size!==categories.length) return false;
    if (!items.every(f=>typeof f.id==='string'&&typeof f.name==='string'&&typeof f.parentId==='string'&&categories.some(c=>c.id===f.categoryId))||new Set(items.map(f=>f.id)).size!==items.length) return false;
    return items.every(f=>{const seen=new Set([f.id]);let current=f;while(current.parentId){const parent=items.find(p=>p.id===current.parentId);if(!parent||seen.has(parent.id)||parent.categoryId!==f.categoryId)return false;seen.add(parent.id);current=parent;}return true;});
  }
  try {
    const saved=JSON.parse(localStorage.getItem(directoryStorageKey)||'null');
    const old=JSON.parse(localStorage.getItem(folderStorageKey)||'null');
    if(saved&&validDirectory(saved.categories,saved.folders)) { categoryDefinitions=saved.categories;folders=saved.folders;hiddenDemoFiles=Array.isArray(saved.hiddenDemoFiles)?saved.hiddenDemoFiles:[];demoLocations=saved.demoLocations||{}; }
    else if(old&&validDirectory(categoryDefinitions,old))folders=old;
  }catch{}
  function persistFolders() {
    try { localStorage.setItem(directoryStorageKey,JSON.stringify({categories:categoryDefinitions,folders,hiddenDemoFiles,demoLocations}));return true; }catch{return false;}
  }
  function categoryCode(id) {
    let number=categoryDefinitions.findIndex(c=>c.id===id)+1,code='';
    while(number>0){number--;code=String.fromCharCode(65+number%26)+code;number=Math.floor(number/26);}return code;
  }
  function folderCode(id) {
    const folder=folders.find(f=>f.id===id);if(!folder)return '';
    const siblings=folders.filter(f=>f.categoryId===folder.categoryId&&f.parentId===folder.parentId);
    const suffix=String(siblings.findIndex(f=>f.id===id)+1).padStart(2,'0');
    return (folder.parentId?folderCode(folder.parentId):categoryCode(folder.categoryId))+'-'+suffix;
  }
  const categoryLabel=category=>categoryCode(category.id)+'  '+category.name;
  const folderLabel=folder=>folderCode(folder.id)+'  '+folder.name;
  const supportedExtensions = new Set(["pdf", "doc", "docx", "ppt", "pptx"]);
  const historyStorageKey = "engineering-project-assistant-history-v1";
  const demoMaterials = [
    {
      name: "项目立项批复（演示）.pdf",
      categoryId: "approval",
      folderId: "approval-item-1",
      date: "2026-09-12",
    },
    {
      name: "综合体项目招标文件（演示）.pdf",
      categoryId: "tender-contract",
      folderId: "tender-contract-item-1",
      date: "2026-09-10",
    },
    {
      name: "建筑专业施工图会审记录（演示）.docx",
      categoryId: "design-technical",
      folderId: "design-technical-item-1",
      date: "2026-09-08",
    },
    {
      name: "主体施工质量检查记录（演示）.pdf",
      categoryId: "construction-quality-safety",
      folderId: "construction-quality-safety-item-1",
      date: "2026-09-06",
    },
    {
      name: "项目协调会会议纪要（演示）.docx",
      categoryId: "schedule-meetings",
      folderId: "schedule-meetings-item-1",
      date: "2026-09-04",
    },
    {
      name: "工程签证确认单（演示）.pdf",
      categoryId: "change-claims-settlement",
      folderId: "change-claims-settlement-item-1",
      date: "2026-09-02",
    },
  ];
  let uploadedFiles = [];
  let conversations = loadConversations();
  let activeConversationId = null;
  let contextConversationId = null;
  let selectedLibraryCategory = "all";

  function loadConversations() {
    try {
      const saved = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function saveConversations() {
    localStorage.setItem(historyStorageKey, JSON.stringify(conversations));
  }

  function currentConversation() {
    return conversations.find((item) => item.id === activeConversationId);
  }

  function closeHistoryContextMenu() {
    historyContextMenu.hidden = true;
    contextConversationId = null;
  }

  function openHistoryContextMenu(event, conversation) {
    event.preventDefault();
    contextConversationId = conversation.id;
    historyContextMenu.hidden = false;
    const menuWidth = historyContextMenu.offsetWidth || 148;
    const menuHeight = historyContextMenu.offsetHeight || 82;
    historyContextMenu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8))}px`;
    historyContextMenu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8))}px`;
  }

  renameHistoryButton.addEventListener("click", () => {
    const conversation = conversations.find((item) => item.id === contextConversationId);
    closeHistoryContextMenu();
    if (!conversation) return;
    const newTitle = window.prompt("请输入自定义对话名称", conversation.title);
    if (newTitle === null) return;
    const title = newTitle.trim().slice(0, 40);
    if (!title) {
      window.alert("名称不能为空。");
      return;
    }
    conversation.title = title;
    conversation.updatedAt = Date.now();
    saveConversations();
    renderHistory();
  });

  deleteHistoryButton.addEventListener("click", () => {
    const conversationId = contextConversationId;
    closeHistoryContextMenu();
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation || !window.confirm(`确定删除“${conversation.title}”这条对话吗？`)) return;
    conversations = conversations.filter((item) => item.id !== conversationId);
    saveConversations();
    if (activeConversationId === conversationId) {
      activeConversationId = null;
      renderConversation();
    }
    renderHistory();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!historyContextMenu.hidden && !historyContextMenu.contains(event.target)) {
      closeHistoryContextMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeHistoryContextMenu();
  });
  window.addEventListener("resize", closeHistoryContextMenu);
  window.addEventListener("scroll", closeHistoryContextMenu, true);

  function renderHistory() {
    historyList.replaceChildren();
    if (conversations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ai-history-empty";
      empty.textContent = "暂无历史对话";
      historyList.appendChild(empty);
      return;
    }
    [...conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `ai-history-item${item.id === activeConversationId ? " active" : ""}`;
        button.textContent = item.title;
        button.title = item.title;
        button.addEventListener("click", () => {
          activeConversationId = item.id;
          renderHistory();
          renderConversation();
        });
        button.addEventListener("contextmenu", (event) => openHistoryContextMenu(event, item));
        historyList.appendChild(button);
      });
  }

  function bindExamples(container) {
    container.querySelectorAll("[data-ai-example]").forEach((button) => {
      button.addEventListener("click", () => {
        questionInput.value = button.dataset.aiExample;
        setQuestionButton();
        questionInput.focus();
      });
    });
  }

  function makeWelcome() {
    const welcome = document.createElement("div");
    welcome.className = "ai-welcome";
    welcome.innerHTML =
      '<div class="ai-welcome-mark">AI</div><h3>你好，我可以帮你查项目资料</h3><p>试着问一个工程约定、技术要求或会议结论。</p><div class="ai-examples"><button type="button" data-ai-example="机电工程的施工范围如何划分？">机电工程的施工范围如何划分？</button><button type="button" data-ai-example="最近一次协调会确定了哪些事项？">最近一次协调会确定了哪些事项？</button><button type="button" data-ai-example="外墙材料的技术要求是什么？">外墙材料的技术要求是什么？</button></div>';
    bindExamples(welcome);
    return welcome;
  }

  function makeAnswerNode(message) {
    const answer = document.createElement("article");
    answer.className = "ai-message assistant";
    const label = document.createElement("div");
    label.className = "ai-answer-label";
    label.textContent = message.failed
      ? "连接提示"
      : message.live
        ? "AI 助手 · 模型回答"
        : "AI 助手 · 模拟回答";
    const copy = document.createElement("p");
    copy.className = "ai-answer-copy";
    copy.textContent = message.answer;
    const sourceList = document.createElement("div");
    sourceList.className = "ai-source-list";
    (message.sources || []).forEach(([name, location]) => {
      const source = document.createElement("div");
      source.className = "ai-source-card";
      const title = document.createElement("strong");
      title.textContent = name;
      const detail = document.createElement("span");
      detail.textContent = location;
      source.append(title, detail);
      sourceList.appendChild(source);
    });
    const disclaimer = document.createElement("p");
    disclaimer.className = "ai-source-disclaimer";
    disclaimer.textContent = message.live
      ? "当前为 AI 通用回答，尚未读取本项目资料库；接入后可依据已入库资料作答。"
      : "以上资料名称、内容和位置均为演示数据，不对应真实项目文件。";
    answer.append(label, copy, sourceList, disclaimer);
    return answer;
  }

  function renderConversation() {
    conversationPanel.replaceChildren();
    const selected = currentConversation();
    if (!selected) {
      conversationPanel.appendChild(makeWelcome());
      return;
    }
    selected.messages.forEach((message) => {
      if (message.role === "user") {
        const bubble = document.createElement("div");
        bubble.className = "ai-message user";
        bubble.textContent = message.text;
        conversationPanel.appendChild(bubble);
      } else {
        conversationPanel.appendChild(makeAnswerNode(message));
      }
    });
    conversationPanel.scrollTop = conversationPanel.scrollHeight;
  }

  function startNewConversation() {
    activeConversationId = null;
    renderHistory();
    renderConversation();
    questionInput.value = "";
    setQuestionButton();
    questionInput.focus();
  }

  function setQuestionButton() {
    sendButton.disabled = Boolean(window.smartWorksStaticDemo) || !questionInput.value.trim();
  }

  async function addQuestion(question) {
    if (window.smartWorksStaticDemo) return;
    let selected = currentConversation();
    if (!selected) {
      selected = {
        id: `${Date.now()}-${Math.random()}`,
        title: question.slice(0, 22),
        updatedAt: Date.now(),
        messages: [],
      };
      conversations.push(selected);
      activeConversationId = selected.id;
    }
    selected.messages.push({ role: "user", text: question, live: true });
    selected.updatedAt = Date.now();
    saveConversations();
    renderHistory();
    renderConversation();

    const pending = document.createElement("article");
    pending.className = "ai-message assistant";
    pending.textContent = "正在联系模型服务…";
    conversationPanel.appendChild(pending);
    conversationPanel.scrollTop = conversationPanel.scrollHeight;
    sendButton.disabled = true;
    sendButton.textContent = "回答中…";

    try {
      const messages = selected.messages
        .filter((message) => message.live && !message.failed)
        .slice(-20)
        .map((message) => ({
          role: message.role,
          content: message.role === "user" ? message.text : message.answer,
        }));
      const response = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "接口请求失败，请稍后重试。");
      }
      selected.messages.push({
        role: "assistant",
        answer: result.answer,
        sources: [],
        live: true,
      });
    } catch (error) {
      selected.messages.push({
        role: "assistant",
        answer: error.message || "连接失败，请确认本地服务已启动。",
        sources: [],
        live: true,
        failed: true,
      });
    } finally {
      selected.updatedAt = Date.now();
      saveConversations();
      renderHistory();
      if (activeConversationId === selected.id) renderConversation();
      sendButton.textContent = "发送 ↑";
      setQuestionButton();
    }
  }

  questionInput.addEventListener("input", setQuestionButton);
  questionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = questionInput.value.trim();
    if (!question) return;
    void addQuestion(question);
    questionInput.value = "";
    setQuestionButton();
  });
  document.querySelector("#aiNewChat").addEventListener("click", startNewConversation);
  document.querySelector("#aiClearChat").addEventListener("click", startNewConversation);
  renderHistory();
  renderConversation();

  function setModelSettingsStatus(message, isError = false) {
    modelSettingsStatus.textContent = message;
    modelSettingsStatus.classList.toggle("error", isError);
  }


  let connections = [], selectedConnectionId = null, activeConnectionId = null;
  const keyField = apiKeyInput.closest('label');
  const editSavedKey = document.querySelector('#aiEditSavedKey');
  const savedConnectionKey = document.querySelector('#aiSavedConnectionKey');
  const providerName = document.querySelector('#aiProviderName');
  const providerType = document.querySelector('#aiProviderType');
  const savedProviders = document.querySelector('#aiSavedProviders');
  const officialModels = ['deepseek-flash', 'deepseek-v4-pro'];
  function providerLabel(provider) {
    return provider === 'deepseek' ? 'DeepSeek' : provider === 'bigmodel' ? '智谱 BigModel' : '自定义服务商';
  }
  function renderProviderList() {
    savedProviders.replaceChildren();
    if (!connections.length) {
      const empty = document.createElement('p');
      empty.textContent = '还没有保存的服务商'; empty.className = 'ai-provider-empty'; savedProviders.append(empty);
    }
    connections.forEach(connection => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'ai-provider-choice ai-saved-provider';
      button.classList.toggle('active', connection.id === selectedConnectionId);
      button.setAttribute('aria-pressed', String(connection.id === selectedConnectionId));
      const name = document.createElement('strong'); name.textContent = connection.name;
      const detail = document.createElement('small'); detail.textContent = connection.id === activeConnectionId ? '当前使用' : '已保存';
      button.append(name, detail);
      button.addEventListener('click', () => {
        fillConnection(connection);
        setModelSettingsStatus(connection.id === activeConnectionId ? '这是当前使用的服务商。' : '已载入配置，点击“保存并使用”切换到此连接。');
      });
      savedProviders.append(button);
    });
  }
  function renderModelTags() {
    const current = modelInput.value || availableModels[0] || '';
    const models = [...new Set([...(selectedProvider === 'deepseek' ? officialModels : []), ...availableModels, current].filter(Boolean))];
    modelInput.replaceChildren();
    models.forEach(model => {
      const option = document.createElement('option'); option.value = model;
      option.textContent = model === 'deepseek-flash' ? 'DeepSeek Flash · deepseek-flash' : model === 'deepseek-v4-pro' ? 'DeepSeek V4 Pro · deepseek-v4-pro' : model;
      modelInput.append(option);
    });
    modelInput.value = current;
    document.querySelector('#aiModelHint').textContent = selectedProvider === 'deepseek' ? '官方模型：DeepSeek Flash、DeepSeek V4 Pro。' : '选择模型，或添加服务商提供的模型 ID。';
    addModelButton.hidden = selectedProvider === 'deepseek';
  }
  function updateProviderDisplay(configured = false) {
    providerHeading.textContent = providerName.value || providerLabel(selectedProvider);
    providerState.textContent = !connectionEnabled ? '○ 已禁用' : configured ? '● 已保存' : '○ 待保存';
    providerState.classList.toggle('configured', connectionEnabled && configured);
    providerEnableButton.textContent = connectionEnabled ? '禁用' : '启用';
  }
  function fillConnection(settings) {
    selectedConnectionId = settings.id || null; selectedProvider = settings.provider || 'deepseek';
    providerType.value = selectedProvider; providerName.value = settings.name || providerLabel(selectedProvider);
    baseUrlInput.value = settings.baseUrl || '';
    availableModels = settings.models?.length ? settings.models : [settings.model || 'deepseek-flash'];
    modelInput.replaceChildren(); renderModelTags(); modelInput.value = settings.model || availableModels[0];
    connectionEnabled = settings.enabled !== false;
    apiKeyInput.value = ''; apiKeyInput.type = 'password'; toggleKeyVisibility.textContent = '显示'; toggleKeyVisibility.setAttribute('aria-pressed', 'false');
    savedConnection.hidden = !settings.configured; keyField.hidden = Boolean(settings.configured);
    savedConnection.classList.toggle('is-configured', Boolean(settings.configured));
    savedConnectionTitle.textContent = 'API 密钥已保存';
    savedConnectionDetail.textContent = '无需重新填写，可直接使用或修改配置。';
    savedConnectionKey.textContent = settings.keyHint || '';
    savedKeyHint.textContent = settings.configured ? '留空保留密钥；更改 API 地址或服务类型后需重新填写。' : '填写此服务商的 API Key。';
    updateProviderDisplay(settings.configured); renderProviderList();
  }
  function newConnection() {
    fillConnection({provider:'deepseek',name:'',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',models:officialModels,enabled:true});
    providerName.value = ''; providerHeading.textContent = '添加服务商';
    setModelSettingsStatus('填写连接信息，保存后会显示在左侧列表。已有服务商将保留。'); providerName.focus();
  }
  editSavedKey.addEventListener('click', () => {
    keyField.hidden = !keyField.hidden;
    if (!keyField.hidden) apiKeyInput.focus(); else apiKeyInput.value = '';
  });
  async function loadModelSettings() {
    if (window.smartWorksStaticDemo) {
      const message = '当前为静态演示版，AI 问答需连接服务端后使用。';
      connectionSummary.textContent = message;
      providerState.textContent = '静态演示';
      savedKeyHint.textContent = '静态版不保存密钥';
      modelSettingsDialog.querySelector('.ai-settings-intro').textContent = message;
      modelSettingsDialog.querySelector('.ai-settings-security').textContent = '在线演示不提供模型连接；工程流程、资料管理等演示功能可正常体验。';
      setModelSettingsStatus(message);
      modelSettingsDialog.querySelectorAll('input, select, textarea, button').forEach(control => {
        if (control.id !== 'aiModelSettingsClose') control.disabled = true;
      });
      apiKeyInput.value = '';
      return;
    }
    try {
      const response = await fetch(apiUrl('/api/settings')); const settings = await response.json();
      if (!response.ok) throw new Error(settings.error || '读取设置失败。');
      connections = settings.connections || []; activeConnectionId = settings.id;
      const current = connections.find(c => c.id === activeConnectionId) || connections[0];
      if (current) fillConnection(current); else newConnection();
      connectionSummary.textContent = settings.configured ? '已配置 ' + providerLabel(settings.provider) + '；尚未接入项目资料检索与引用。' : '尚未配置模型服务。';
      if (current) setModelSettingsStatus('选择左侧服务商查看配置，修改后点击“保存并使用”。');
    } catch (error) { setModelSettingsStatus(error.message || '无法读取本地设置。', true); }
  }
  async function saveModelSettings() {
    if (window.smartWorksStaticDemo) throw new Error('静态演示版不保存密钥，请在本地服务版配置 AI。');
    const response = await fetch(apiUrl('/api/settings'), {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:selectedConnectionId || crypto.randomUUID(),name:providerName.value.trim(),provider:selectedProvider,baseUrl:baseUrlInput.value.trim(),model:modelInput.value,models:[...new Set([modelInput.value,...availableModels].filter(Boolean))],apiKey:apiKeyInput.value,enabled:connectionEnabled})
    });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || '保存失败。');
    connections = result.connections; activeConnectionId = result.id;
    fillConnection(connections.find(c => c.id === result.id));
    connectionSummary.textContent = '当前使用 ' + result.name + ' · ' + result.model + '；尚未接入项目资料检索与引用。';
    setModelSettingsStatus('已保存并使用 ' + result.name + '，服务商已显示在左侧列表。');
  }
  providerType.addEventListener('change', () => {
    selectedProvider = providerType.value; apiKeyInput.value = ''; keyField.hidden = false;
    const defaults = selectedProvider === 'deepseek' ? ['https://api.deepseek.com','deepseek-flash'] : selectedProvider === 'bigmodel' ? ['https://open.bigmodel.cn/api/paas/v4','glm-5-turbo'] : ['',''];
    baseUrlInput.value = defaults[0]; availableModels = defaults[1] ? [defaults[1]] : [];
    modelInput.replaceChildren(); renderModelTags(); updateProviderDisplay(false);
    setModelSettingsStatus('服务类型已更改，请填写对应密钥并保存。');
  });
  baseUrlInput.addEventListener('input', () => {keyField.hidden = false;});
  providerName.addEventListener('input', () => updateProviderDisplay(Boolean(selectedConnectionId)));
  addProviderButton.addEventListener('click', newConnection);
  providerEnableButton.addEventListener('click', () => {
    connectionEnabled = !connectionEnabled; updateProviderDisplay(Boolean(selectedConnectionId)); setModelSettingsStatus('点击“保存并使用”后生效。');
  });
  addModelButton.addEventListener('click', () => {
    const model = window.prompt('输入服务商提供的模型 ID：')?.trim(); if (!model) return;
    if (!availableModels.includes(model)) availableModels.push(model); renderModelTags(); modelInput.value = model;
  });
  toggleKeyVisibility.addEventListener("click", () => {
    const showKey = apiKeyInput.type === "password";
    apiKeyInput.type = showKey ? "text" : "password";
    toggleKeyVisibility.textContent = showKey ? "隐藏" : "显示";
    toggleKeyVisibility.setAttribute("aria-pressed", String(showKey));
  });
  apiKeyInput.addEventListener("input", () => {
    if (!savedKeyHint) return;
    savedKeyHint.textContent = apiKeyInput.value
      ? "已输入新密钥，保存后替换当前密钥。"
      : "输入框留空表示保留当前已保存密钥。";
  });

  // Keep account-level settings visible even when the project assistant is hidden.
  document.body.appendChild(modelSettingsDialog);
  let settingsOpener = null;
  const openModelSettings = () => {
    settingsOpener = document.activeElement;
    modelSettingsDialog.hidden = false;
    document.body.classList.add("ai-settings-open");
    loadModelSettings();
    document.querySelector("#aiModelSettingsClose").focus();
  };
  document.querySelector("#aiModelSettingsButton").addEventListener("click", openModelSettings);
  document.addEventListener("smartworks:ai-settings", openModelSettings);
  const closeModelSettings = () => {
    modelSettingsDialog.hidden = true;
    apiKeyInput.value = "";
    apiKeyInput.type = "password";
    toggleKeyVisibility.textContent = "显示";
    toggleKeyVisibility.setAttribute("aria-pressed", "false");
    document.body.classList.remove("ai-settings-open");
    const returnTarget = settingsOpener?.closest("#userPopover")
      ? document.querySelector("#userMenuButton") : settingsOpener;
    returnTarget?.focus();
  };
  modelSettingsDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModelSettings();
    }
    if (event.key !== "Tab") return;
    const controls = [...modelSettingsDialog.querySelectorAll("button, input, select")]
      .filter((element) => !element.disabled && element.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  });
  document
    .querySelector("#aiModelSettingsClose")
    .addEventListener("click", closeModelSettings);

  modelSaveButton.addEventListener("click", async () => {
    modelSaveButton.disabled = true;
    try {
      await saveModelSettings();
    } catch (error) {
      setModelSettingsStatus(error.message, true);
    } finally {
      modelSaveButton.disabled = false;
    }
  });
  modelTestButton.addEventListener("click", async () => {
    modelTestButton.disabled = true;
    modelSaveButton.disabled = true;
    setModelSettingsStatus("正在保存设置并发送一条简短测试请求…");
    try {
      await saveModelSettings();
      const response = await fetch(apiUrl("/api/settings/test"), { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "测试连接失败。");
      connectionSummary.textContent = `已连接 ${providerLabel(result.provider)}；当前尚未接入项目资料检索与引用。`;
      setModelSettingsStatus("连接成功，模型已返回测试回答。当前连接：" + result.provider + " · " + result.model);
    } catch (error) {
      connectionSummary.textContent = `连接失败：${error.message}；当前尚未接入项目资料检索与引用。`;
      setModelSettingsStatus(error.message, true);
    } finally {
      modelTestButton.disabled = false;
      modelSaveButton.disabled = false;
    }
  });
  loadModelSettings();
  if (window.smartWorksStaticDemo) {
    questionInput.disabled = true;
    questionInput.placeholder = '静态演示版：AI 问答需连接服务端后使用';
    sendButton.disabled = true;
  }

  const projectName = document.querySelector("#projectName");
  const syncProjectLabels = () => {
    const name = projectName?.textContent?.trim() || "当前项目";
    document.querySelector("#aiCurrentProject").textContent = name;
    document.querySelector("#materialCurrentProject").textContent = name;
  };
  if (projectName) {
    new MutationObserver(syncProjectLabels).observe(projectName, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    syncProjectLabels();
  }

  function suggestCategory(fileName) {
    const match = categoryDefinitions.find((category) =>
      category.keywords.some((keyword) =>
        fileName.toLowerCase().includes(keyword.toLowerCase()),
      ),
    );
    return match?.id || categoryDefinitions.at(-1)?.id;
  }

  function updateMaterialCount() {
    const pending = uploadedFiles.filter((file) => !file.confirmed).length;
    pendingCount.textContent = String(pending);
    confirmAll.disabled = pending === 0;
    emptyState.hidden = uploadedFiles.length > 0;
  }

  function getFoldersForCategory(categoryId) {
    return folders.filter((folder) => folder.categoryId === categoryId);
  }

  function getFolderPath(folderId) {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return "";
    const parentPath = folder.parentId ? getFolderPath(folder.parentId) : "";
    return parentPath ? `${parentPath} / ${folder.name}` : folder.name;
  }

  function getDescendantFolderIds(folderId) {
    return folders
      .filter((folder) => folder.parentId === folderId)
      .flatMap((folder) => [folder.id, ...getDescendantFolderIds(folder.id)]);
  }

  function appendFolderOptions(select, categoryId, selectedFolderId = "") {
    select.replaceChildren();
    const rootOption = document.createElement("option");
    rootOption.value = "";
    rootOption.textContent = "大类根目录";
    select.appendChild(rootOption);
    getFoldersForCategory(categoryId).forEach((folder) => {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = folderCode(folder.id)+"  "+getFolderPath(folder.id);
      option.selected = folder.id === selectedFolderId;
      select.appendChild(option);
    });
    select.value = selectedFolderId;
  }

  function renderFiles() {
    fileList.replaceChildren();
    uploadedFiles.forEach((file) => {
      const row = document.createElement("div");
      row.className = `material-file-row${file.confirmed ? " confirmed" : ""}`;
      const name = document.createElement("div");
      name.className = "material-file-name";
      name.textContent = file.name;
      const meta = document.createElement("small");
      meta.textContent = `${file.extension.toUpperCase()} · ${file.sizeText}`;
      name.appendChild(meta);
      const select = document.createElement("select");
      select.setAttribute("aria-label", `为 ${file.name} 选择资料分类`);
      categoryDefinitions.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = categoryLabel(category);
        option.selected = category.id === file.categoryId;
        select.appendChild(option);
      });
      select.disabled = file.confirmed;
      select.addEventListener("change", () => {
        file.categoryId = select.value;
        file.folderId = getFoldersForCategory(file.categoryId).find(folder => !folder.parentId)?.id || "";
        file.manual = true;
        renderFiles();
      });
      const folderSelect = document.createElement("select");
      folderSelect.setAttribute("aria-label", `为 ${file.name} 选择存放文件夹`);
      appendFolderOptions(folderSelect, file.categoryId, file.folderId);
      folderSelect.disabled = file.confirmed;
      folderSelect.addEventListener("change", () => {
        file.folderId = folderSelect.value;
      });
      const state = document.createElement("span");
      state.className = "material-file-state";
      state.textContent = file.confirmed
        ? "已确认 · 演示"
        : file.manual
          ? "手动选择"
          : file.categoryId === categoryDefinitions.at(-1)?.id
            ? "待人工确认"
            : "模拟分类建议";
      row.append(name, select, folderSelect, state);
      fileList.appendChild(row);
    });
    updateMaterialCount();
  }

  function getLibraryMaterials() {
    return [
      ...demoMaterials.filter(file => !hiddenDemoFiles.includes(file.name)).map(file => { const item={...file,...demoLocations[file.name]}; return {...item,categoryId:folders.find(folder=>folder.id===item.folderId)?.categoryId||item.categoryId}; }),
      ...uploadedFiles
        .filter((file) => file.confirmed)
        .map((file) => ({
          name: file.name,
          categoryId: file.categoryId,
          folderId: file.folderId,
          date: "刚刚归档",
        })),
    ];
  }


  let selectedLibraryFolder = '';
  const expandedDirectories = new Set();
  let librarySortAscending = true;
  const breadcrumbs = document.querySelector('#libraryBreadcrumbs');
  const goUp = document.querySelector('#libraryGoUp');
  function navigateLibrary(categoryId = 'all', folderId = '') {
    selectedLibraryCategory = categoryId; selectedLibraryFolder = folderId;
    librarySearch.value = '';
    if (categoryId !== 'all') expandedDirectories.add('category:' + categoryId);
    let folder = folders.find(f => f.id === folderId);
    while (folder) { expandedDirectories.add(folder.id); folder = folders.find(f => f.id === folder.parentId); }
    renderLibrary();
  }
  function directoryButton(label, categoryId, folderId, depth, hasChildren, key) {
    const row = document.createElement('div'); row.className = 'explorer-tree-row';
    row.style.setProperty('--depth', depth);
    const active = selectedLibraryCategory === categoryId && selectedLibraryFolder === folderId;
    row.classList.toggle('active',active);
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'explorer-tree-toggle';
    toggle.textContent = hasChildren ? (expandedDirectories.has(key) ? '⌄' : '›') : '';
    toggle.disabled = !hasChildren;
    toggle.setAttribute('aria-label',(expandedDirectories.has(key) ? '收起 ' : '展开 ') + label);
    if (hasChildren) toggle.setAttribute('aria-expanded',String(expandedDirectories.has(key)));
    toggle.addEventListener('click',() => { if (expandedDirectories.has(key)) expandedDirectories.delete(key); else expandedDirectories.add(key); renderLibraryTabs(); });
    const button = document.createElement('button'); button.type = 'button'; button.className = 'explorer-tree-label';
    if (active) button.setAttribute('aria-current','location');
    const icon = document.createElement('span'); icon.className = 'explorer-folder-icon'; icon.setAttribute('aria-hidden','true');
    const text = document.createElement('span'); text.textContent = label; button.append(icon,text); button.title = label;
    button.addEventListener('click',() => navigateLibrary(categoryId,folderId)); row.append(toggle,button); return row;
  }
  function renderLibraryTabs() {
    libraryTabs.replaceChildren();
    libraryTabs.append(directoryButton('全部资料','all','',0,false,'all'));
    function appendChildren(categoryId,parentId,depth) {
      folders.filter(f=>f.categoryId===categoryId && f.parentId===parentId).forEach(folder=>{
        const hasChildren = folders.some(f=>f.parentId===folder.id);
        libraryTabs.append(directoryButton(folderLabel(folder),categoryId,folder.id,depth,hasChildren,folder.id));
        if(expandedDirectories.has(folder.id)) appendChildren(categoryId,folder.id,depth+1);
      });
    }
    categoryDefinitions.forEach(category=>{
      const key='category:'+category.id;
      libraryTabs.append(directoryButton(categoryLabel(category),category.id,'',0,getFoldersForCategory(category.id).length>0,key));
      if(expandedDirectories.has(key)) appendChildren(category.id,'',1);
    });
  }
  function renderBreadcrumbs() {
    breadcrumbs.replaceChildren();
    const add = (name,categoryId,folderId) => {
      if(breadcrumbs.childElementCount) { const sep=document.createElement('span');sep.textContent='›';breadcrumbs.append(sep); }
      const button=document.createElement('button');button.type='button';button.textContent=name;
      button.addEventListener('click',()=>navigateLibrary(categoryId,folderId));breadcrumbs.append(button);
    };
    add('全部资料','all','');
    const category=categoryDefinitions.find(c=>c.id===selectedLibraryCategory);
    if(category) add(categoryLabel(category),category.id,'');
    const chain=[];let folder=folders.find(f=>f.id===selectedLibraryFolder);
    while(folder){chain.unshift(folder);folder=folders.find(f=>f.id===folder.parentId);}
    chain.forEach(f=>add(folderLabel(f),f.categoryId,f.id));
    goUp.disabled = selectedLibraryCategory==='all';
    document.querySelector('#libraryCurrentTitle').textContent=chain.at(-1)?.name || category?.name || '全部资料';
  }
  goUp.addEventListener('click',()=>{
    const folder=folders.find(f=>f.id===selectedLibraryFolder);
    navigateLibrary(folder ? selectedLibraryCategory : 'all',folder?.parentId || '');
  });
  document.querySelector('#librarySortName').addEventListener('click',()=>{
    librarySortAscending=!librarySortAscending;renderLibrary();
  });
  function renderLibrary() {
    renderLibraryTabs();renderBreadcrumbs();
    const term=librarySearch.value.trim().toLowerCase();
    const allFiles=getLibraryMaterials();
    const descendants=selectedLibraryFolder ? [selectedLibraryFolder,...getDescendantFolderIds(selectedLibraryFolder)] : null;
    const withinScope=file=>(selectedLibraryCategory==='all'||file.categoryId===selectedLibraryCategory)&&(!descendants||descendants.includes(file.folderId));
    let entries=[];
    if(term){
      entries=allFiles.filter(f=>withinScope(f)&&f.name.toLowerCase().includes(term)).map(file=>({kind:'file',...file}));
      folders.filter(f=>(selectedLibraryCategory==='all'||f.categoryId===selectedLibraryCategory)&&(!descendants||descendants.includes(f.parentId))&&f.name.toLowerCase().includes(term)).forEach(f=>entries.push({kind:'folder',...f}));
    }else if(selectedLibraryCategory==='all'){
      entries=categoryDefinitions.map(c=>({kind:'category',...c,categoryId:c.id}));
    }else{
      entries=folders.filter(f=>f.categoryId===selectedLibraryCategory&&f.parentId===selectedLibraryFolder).map(f=>({kind:'folder',...f}));
      allFiles.filter(f=>f.categoryId===selectedLibraryCategory&&(f.folderId||'')===selectedLibraryFolder).forEach(f=>entries.push({kind:'file',...f}));
    }
    entries.sort((a,b)=>{
      const group=Number(a.kind==='file')-Number(b.kind==='file');
      const label = entry => entry.kind === 'category' ? categoryCode(entry.id) : entry.kind === 'folder' ? folderCode(entry.id) : entry.name;
      return group || label(a).localeCompare(label(b),'zh-CN',{numeric:true})*(librarySortAscending?1:-1);
    });
    libraryGroups.replaceChildren();
    document.querySelector('#librarySortName').textContent='名称 '+(librarySortAscending?'↑':'↓');
    document.querySelector('#librarySelectionStatus').textContent='项目资料库 · 演示';
    entries.forEach(entry=>{
      const row=document.createElement('tr');row.tabIndex=0;
      const isFolder=entry.kind!=='file';
      const extension=entry.name.split('.').pop().toLowerCase();
      const nameCell=document.createElement('td');const nameWrap=document.createElement('div');nameWrap.className='explorer-file-name';
      const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');
      icon.className=isFolder?'explorer-folder-icon':'explorer-file-icon '+(extension==='pdf'?'pdf':extension==='docx'||extension==='doc'?'word':'other');
      if(!isFolder)icon.textContent=extension==='pdf'?'PDF':extension.startsWith('doc')?'W':'P';
      const name=document.createElement('span');name.textContent=entry.kind==='category'?categoryLabel(entry):entry.kind==='folder'?folderLabel(entry):entry.name;nameWrap.append(icon,name);nameCell.append(nameWrap);row.append(nameCell);
      const category=categoryDefinitions.find(c=>c.id===entry.categoryId);
      const values=[isFolder?'文件夹':extension.toUpperCase()+' 文件',entry.date||'—',entry.kind==='category'?'项目资料库':(category?.name||'')+(entry.folderId?' / '+getFolderPath(entry.folderId):entry.parentId?' / '+getFolderPath(entry.parentId):'')];
      values.forEach(value=>{const cell=document.createElement('td');cell.textContent=value;cell.title=value;row.append(cell);});
      const select=()=>{
        libraryGroups.querySelectorAll('tr').forEach(r=>r.classList.remove('selected'));row.classList.add('selected');
        document.querySelector('#librarySelectionStatus').textContent='已选中：'+entry.name+(isFolder?'':' · 演示资料');
      };
      const open=()=>{if(isFolder)navigateLibrary(entry.categoryId,entry.kind==='category'?'':entry.id);else select();};
      row.addEventListener('click',select);row.addEventListener('dblclick',open);
      row.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();open();}else if(event.key===' '){event.preventDefault();select();}});
      libraryGroups.append(row);
    });
    const empty=document.querySelector('#libraryEmpty');empty.hidden=entries.length>0;
    empty.querySelector('strong').textContent=term?'未找到匹配的资料':'此文件夹为空';
    empty.querySelector('p').textContent=term?'试试其他关键词，或返回上级目录搜索。':'上传资料或新建文件夹，开始整理项目文件。';
    const fileCount=entries.filter(e=>e.kind==='file').length;
    document.querySelector('#libraryTotal').textContent=entries.length+' 项 · '+(entries.length-fileCount)+' 个文件夹 · '+fileCount+' 份资料';
  }

  librarySearch.addEventListener("input", renderLibrary);
  renderLibrary();

  categoryDefinitions.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    folderCategory.appendChild(option);
  });
  function renderFolderParentOptions() {
    folderParent.replaceChildren();
    const rootOption = document.createElement("option");
    rootOption.value = "";
    rootOption.textContent = categoryDefinitions.find(category => category.id === folderCategory.value) ? categoryLabel(categoryDefinitions.find(category => category.id === folderCategory.value)) : "请选择所属大项";
    folderParent.appendChild(rootOption);
    getFoldersForCategory(folderCategory.value).forEach((folder) => {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = getFolderPath(folder.id);
      folderParent.appendChild(option);
    });
  }
  function openFolderDialog(defaultCategoryId = "") {
    if (!categoryDefinitions.length) { directoryOpener=document.activeElement;directoryDialog.hidden=false;selectDirectory('category',null,{name:''});directoryName.focus();return; }
    folderCategory.value =
      defaultCategoryId ||
      (selectedLibraryCategory === "all"
        ? uploadedFiles.find((file) => !file.confirmed)?.categoryId ||
          categoryDefinitions[0]?.id
        : selectedLibraryCategory);
    renderFolderParentOptions();
    if (selectedLibraryFolder && folderCategory.value === selectedLibraryCategory) folderParent.value = selectedLibraryFolder;
    folderName.value = "";
    folderDialog.hidden = false;
    folderName.focus();
  }
  function closeFolderDialog() {
    folderDialog.hidden = true;
  }
  document
    .querySelector("#materialNewFolder")
    .addEventListener("click", () => openFolderDialog());
  document
    .querySelector("[data-new-folder]")
    .addEventListener("click", () => openFolderDialog());
  folderCategory.addEventListener("change", renderFolderParentOptions);
  document
    .querySelector("#materialFolderClose")
    .addEventListener("click", closeFolderDialog);
  document
    .querySelector("#materialFolderCancel")
    .addEventListener("click", closeFolderDialog);
  folderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = folderName.value.trim();
    const parentId = folderParent.value;
    const duplicate = folders.some(
      (folder) =>
        folder.categoryId === folderCategory.value &&
        folder.parentId === parentId &&
        folder.name.toLowerCase() === name.toLowerCase(),
    );
    if (!name) return;
    if (duplicate) {
      window.alert("同一上级文件夹下已有同名文件夹，请换一个名称。");
      return;
    }
    folders.push({
      id: `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      categoryId: folderCategory.value,
      parentId,
      name,
    });
    persistFolders();
    closeFolderDialog();
    renderFiles();
    renderLibrary();
  });



  const directoryDialog=document.querySelector('#librarySettingsDialog');
  const directoryList=document.querySelector('#librarySettingsFolders');
  const directoryName=document.querySelector('#librarySettingsName');
  const directoryCategory=document.querySelector('#librarySettingsCategory');
  const directoryParent=document.querySelector('#librarySettingsParent');
  const directoryStatus=document.querySelector('#librarySettingsStatus');
  const directorySearch=document.querySelector('#directorySearch');
  let editingDirectory=null,directoryOpener=null;
  function directorySnapshot() {
    directoryUndo=JSON.stringify({categories:categoryDefinitions,folders,hiddenDemoFiles,demoLocations,uploadedFiles});
    document.querySelector('#directoryUndo').disabled=false;
  }
  function syncCategorySelectors() {
    const previous=folderCategory.value;folderCategory.replaceChildren();
    categoryDefinitions.forEach(c=>{const option=document.createElement('option');option.value=c.id;option.textContent=categoryLabel(c);folderCategory.append(option);});
    if(categoryDefinitions.some(c=>c.id===previous))folderCategory.value=previous;
    renderFolderParentOptions();
  }
  function directoryResult(message) {
    const saved=persistFolders();syncCategorySelectors();renderFiles();renderLibrary();renderDirectoryList();
    directoryStatus.classList.remove('error');directoryStatus.textContent=message+(saved?'':'（本次未能保存到浏览器）');
  }
  function updateDirectoryPath() {
    const root=directoryCategory.value==='__root';document.querySelector('#directoryParentField').hidden=root;
    const category=categoryDefinitions.find(c=>c.id===directoryCategory.value);
    document.querySelector('#librarySettingsPath').textContent=root?'大项 / '+(directoryName.value.trim()||'新大项'):(category?categoryLabel(category):'请选择大项')+' / '+(directoryParent.value?getFolderPath(directoryParent.value)+' / ':'')+(directoryName.value.trim()||'新小项');
  }
  function updateDirectoryParents() {
    const previous=directoryParent.value,entry=editingDirectory;
    const excluded=new Set(entry?.kind==='folder'?[entry.id,...getDescendantFolderIds(entry.id)]:entry?.kind==='category'?folders.filter(f=>f.categoryId===entry.id).map(f=>f.id):[]);
    directoryParent.replaceChildren();const root=document.createElement('option');root.value='';root.textContent=categoryDefinitions.find(c=>c.id===directoryCategory.value)?categoryLabel(categoryDefinitions.find(c=>c.id===directoryCategory.value)):'请选择所属大项';directoryParent.append(root);
    folders.filter(f=>f.categoryId===directoryCategory.value&&!excluded.has(f.id)).forEach(f=>{const o=document.createElement('option');o.value=f.id;o.textContent=folderCode(f.id)+'  '+getFolderPath(f.id);directoryParent.append(o);});
    if([...directoryParent.options].some(o=>o.value===previous))directoryParent.value=previous;updateDirectoryPath();
  }
  function selectDirectory(kind,id,draft=null) {
    const entry=draft||(kind==='category'?categoryDefinitions:folders).find(item=>item.id===id);if(!entry){selectDirectory('category',null,{name:''});return;}
    editingDirectory={kind,id:id||null};directoryName.value=entry.name||'';
    directoryCategory.replaceChildren();const root=document.createElement('option');root.value='__root';root.textContent='大项（A、B、C）';directoryCategory.append(root);
    categoryDefinitions.filter(c=>!(kind==='category'&&c.id===id)).forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=categoryLabel(c);directoryCategory.append(o);});
    directoryCategory.value=kind==='category'?'__root':entry.categoryId;
    updateDirectoryParents();directoryParent.value=entry.parentId||'';updateDirectoryPath();
    document.querySelector('#librarySettingsFolderTitle').textContent=(id?'编辑':'新增')+(kind==='category'?'大项':'小项');
    document.querySelector('#directoryCode').textContent=id?'当前编号：'+(kind==='category'?categoryCode(id):folderCode(id)):'保存时自动分配编号';
    document.querySelector('#directoryDelete').disabled=!id;directoryStatus.textContent='';renderDirectoryList();
  }
  function renderDirectoryList() {
    directoryList.replaceChildren();const term=directorySearch.value.trim().toLowerCase();
    const matches=(name,code)=>!term||(code+' '+name).toLowerCase().includes(term);
    function add(kind,item,depth) {
      const code=kind==='category'?categoryCode(item.id):folderCode(item.id);
      const button=document.createElement('button');button.type='button';button.textContent=code+'  '+item.name;button.style.paddingLeft=(12+depth*17)+'px';
      button.classList.toggle('active',editingDirectory?.kind===kind&&editingDirectory.id===item.id);button.classList.toggle('directory-major',kind==='category');
      button.addEventListener('click',()=>selectDirectory(kind,item.id));directoryList.append(button);
    }
    function walk(categoryId,parentId,depth,showAll) {
      folders.filter(f=>f.categoryId===categoryId&&f.parentId===parentId).forEach(f=>{const descendants=getDescendantFolderIds(f.id);const visible=showAll||matches(f.name,folderCode(f.id))||folders.some(child=>descendants.includes(child.id)&&matches(child.name,folderCode(child.id)));if(visible){add('folder',f,depth);walk(categoryId,f.id,depth+1,showAll||matches(f.name,folderCode(f.id)));}});
    }
    categoryDefinitions.forEach(c=>{const showAll=matches(c.name,categoryCode(c.id));if(showAll||folders.some(f=>f.categoryId===c.id&&matches(f.name,folderCode(f.id)))){add('category',c,0);walk(c.id,'',1,showAll);}});
    if(!directoryList.childElementCount)directoryList.textContent='没有匹配的目录';
  }
  document.querySelector('#directoryAddCategory').addEventListener('click',()=>{selectDirectory('category',null,{name:''});directoryName.focus();});
  document.querySelector('#directoryAddChild').addEventListener('click',()=>{
    const selected=editingDirectory;
    if(!categoryDefinitions.length){selectDirectory('category',null,{name:''});directoryStatus.textContent='请先新增一个大项，再添加小项。';return;}
    const categoryId=selected?.kind==='category'&&selected.id?selected.id:folders.find(f=>f.id===selected?.id)?.categoryId||categoryDefinitions[0].id;
    selectDirectory('folder',null,{name:'',categoryId,parentId:selected?.kind==='folder'&&selected.id?selected.id:''});directoryName.focus();
  });
  directorySearch.addEventListener('input',renderDirectoryList);
  directoryCategory.addEventListener('change',()=>{directoryParent.value='';updateDirectoryParents();});directoryParent.addEventListener('change',updateDirectoryPath);directoryName.addEventListener('input',updateDirectoryPath);
  function closeDirectorySettings(){directoryDialog.hidden=true;directoryOpener?.focus();}
  document.querySelector('#librarySettingsButton').addEventListener('click',()=>{
    directoryOpener=document.activeElement;directoryDialog.hidden=false;directorySearch.value='';
    if(selectedLibraryFolder)selectDirectory('folder',selectedLibraryFolder);else selectDirectory('category',selectedLibraryCategory==='all'?categoryDefinitions[0].id:selectedLibraryCategory);directoryName.focus();
  });
  document.querySelector('#librarySettingsClose').addEventListener('click',closeDirectorySettings);document.querySelector('#librarySettingsCancel').addEventListener('click',closeDirectorySettings);

  directoryDialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeDirectorySettings();}if(e.key==='Tab'){const controls=[...directoryDialog.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.getClientRects().length);if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus();}}});
  function relocateDocuments(ids,oldCategory,newCategory,rootFolderId,newRootFolderId) {
    demoMaterials.forEach(original=>{const file={...original,...demoLocations[original.name]};if(ids.has(file.folderId)||(!file.folderId&&file.categoryId===oldCategory)){demoLocations[file.name]={categoryId:newCategory,folderId:file.folderId===rootFolderId?newRootFolderId:!file.folderId?newRootFolderId:file.folderId};}});
    uploadedFiles.forEach(file=>{if(ids.has(file.folderId)||(!file.folderId&&file.categoryId===oldCategory)){file.categoryId=newCategory;if(file.folderId===rootFolderId||!file.folderId)file.folderId=newRootFolderId;}});
  }
  document.querySelector('#librarySettingsForm').addEventListener('submit',event=>{
    event.preventDefault();const current=editingDirectory;if(!current)return;
    const name=directoryName.value.trim(),target=directoryCategory.value,parentId=target==='__root'?'':directoryParent.value;
    const error=message=>{directoryStatus.classList.add('error');directoryStatus.textContent=message;};
    if(!name)return error('请输入名称。');
    const original=current.id?(current.kind==='category'?categoryDefinitions:folders).find(e=>e.id===current.id):null;
    const subtree=new Set(current.kind==='category'?folders.filter(f=>f.categoryId===current.id).map(f=>f.id):current.id?[current.id,...getDescendantFolderIds(current.id)]:[]);
    if(subtree.has(parentId))return error('不能移动到自身或子项中。');
    if(target==='__root'&&categoryDefinitions.some(c=>c.id!==current.id&&c.name.toLowerCase()===name.toLowerCase()))return error('已有同名大项。');
    if(target!=='__root'&&folders.some(f=>f.id!==current.id&&f.categoryId===target&&f.parentId===parentId&&f.name.toLowerCase()===name.toLowerCase()))return error('目标位置已有同名小项。');
    if(current.kind==='category'&&current.id&&target!=='__root'&&categoryDefinitions.length===1)return error('请先新增另一个大项，再将此大项移入其中。');
    directorySnapshot();const id=current.id||crypto.randomUUID();
    if(target==='__root') {
      if(current.kind==='category') {if(original)original.name=name;else categoryDefinitions.push({id,name,keywords:[]});}
      else { const oldCategory=original?.categoryId;folders=folders.filter(f=>f.id!==id);folders.forEach(f=>{if(subtree.has(f.id)){f.categoryId=id;if(f.parentId===id)f.parentId='';}});categoryDefinitions.push({id,name,keywords:[]});if(original)relocateDocuments(subtree,null,id,id,''); }
    }else {
      if(current.kind==='category'&&original) {categoryDefinitions=categoryDefinitions.filter(c=>c.id!==id);folders.forEach(f=>{if(subtree.has(f.id)){f.categoryId=target;if(!f.parentId)f.parentId=id;}});folders.push({id,name,categoryId:target,parentId});relocateDocuments(subtree,id,target,null,id);}
      else if(original) {original.name=name;original.parentId=parentId;folders.forEach(f=>{if(subtree.has(f.id))f.categoryId=target;});relocateDocuments(subtree,null,target,null,'');}
      else folders.push({id,name,categoryId:target,parentId});
    }
    selectedLibraryCategory=target==='__root'?id:target;selectedLibraryFolder=target==='__root'?'':id;expandedDirectories.add('category:'+selectedLibraryCategory);if(parentId)expandedDirectories.add(parentId);
    directoryResult('已保存，编号与目录已同步更新。');selectDirectory(target==='__root'?'category':'folder',id);directoryStatus.textContent='已保存，编号与目录已同步更新。';
  });
  document.querySelector('#directoryDelete').addEventListener('click',()=>{
    const current=editingDirectory;if(!current?.id)return;
    const entry=(current.kind==='category'?categoryDefinitions:folders).find(e=>e.id===current.id);
    const ids=new Set(current.kind==='category'?folders.filter(f=>f.categoryId===current.id).map(f=>f.id):[current.id,...getDescendantFolderIds(current.id)]);
    const belongs=file=>ids.has(file.folderId)||(current.kind==='category'&&file.categoryId===current.id);
    const filesToDelete = [...getLibraryMaterials().filter(belongs), ...uploadedFiles.filter(file=>!file.confirmed&&belongs(file))];
    const childCount = current.kind==='category' ? ids.size : Math.max(0,ids.size-1);
    if(!window.confirm('确认删除“'+entry.name+'”？\n将同时删除 '+childCount+' 个下级目录和 '+filesToDelete.length+' 份文件（含待归档文件）。\n目录内的全部内容都会一并删除。可在当前页面撤销上次操作。'))return;
    directorySnapshot();getLibraryMaterials().filter(belongs).forEach(file=>{if(demoMaterials.some(d=>d.name===file.name)&&!hiddenDemoFiles.includes(file.name))hiddenDemoFiles.push(file.name);});uploadedFiles=uploadedFiles.filter(file=>!belongs(file));
    folders=folders.filter(f=>!ids.has(f.id));if(current.kind==='category')categoryDefinitions=categoryDefinitions.filter(c=>c.id!==current.id);
    selectedLibraryCategory='all';selectedLibraryFolder='';directoryResult('已删除，可撤销恢复。');selectDirectory('category',categoryDefinitions[0].id);directoryStatus.textContent='已删除，可点击“撤销上次操作”恢复。';
  });
  document.querySelector('#directoryUndo').addEventListener('click',()=>{
    if(!directoryUndo)return;const state=JSON.parse(directoryUndo);categoryDefinitions=state.categories;folders=state.folders;hiddenDemoFiles=state.hiddenDemoFiles;demoLocations=state.demoLocations;uploadedFiles=state.uploadedFiles;directoryUndo=null;document.querySelector('#directoryUndo').disabled=true;selectedLibraryCategory='all';selectedLibraryFolder='';directoryResult('已撤销。');selectDirectory('category',categoryDefinitions[0].id);directoryStatus.textContent='已撤销上次操作。';
  });

  function addFiles(fileCollection) {
    if (!categoryDefinitions.length) { window.alert("请先在资料设置中新增大项，再添加资料。"); return; }
    const unsupported = [];
    [...fileCollection].forEach((file) => {
      const extension = file.name.split(".").pop() || "file";
      if (!supportedExtensions.has(extension.toLowerCase())) {
        unsupported.push(file.name);
        return;
      }
      uploadedFiles.push({
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        extension,
        sizeText:
          file.size < 1024 * 1024
            ? `${Math.max(1, Math.round(file.size / 1024))} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        categoryId: suggestCategory(file.name),
        folderId: getFoldersForCategory(suggestCategory(file.name)).find(folder => !folder.parentId)?.id || "",
        manual: false,
        confirmed: false,
      });
    });
    renderFiles();
    if (unsupported.length) {
      window.alert(
        `演示原型暂支持 PDF、Word 和 PowerPoint 文件，以下文件未加入列表：\n${unsupported.join("\n")}`,
      );
    }
  }

  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
  });
  ["dragenter", "dragover"].forEach((eventName) =>
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("drag-over");
    }),
  );
  ["dragleave", "drop"].forEach((eventName) =>
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("drag-over");
    }),
  );
  dropzone.addEventListener("drop", (event) => {
    addFiles(event.dataTransfer.files);
  });
  document.querySelector("#materialClearButton").addEventListener("click", () => {
    uploadedFiles = uploadedFiles.filter((file) => file.confirmed);
    renderFiles();
  });
  confirmAll.addEventListener("click", () => {
    uploadedFiles.forEach((file) => {
      if (!file.confirmed) file.confirmed = true;
    });
    renderFiles();
    renderLibrary();
  });
  document.querySelector("[data-open-upload]").addEventListener("click", () => {
    window.openBusinessModule?.("资料管理");
  });
})();
