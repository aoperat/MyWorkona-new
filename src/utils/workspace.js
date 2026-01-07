/**
 * 워크스페이스 관리 로직
 */

import { getStorage, setStorage, removeStorage } from './storage.js';

const STORAGE_KEYS = {
  WORKSPACES: 'workspaces',
  SAVED_TABS: 'savedTabs',
  RESOURCES: 'resources',
  NOTES: 'notes',
  TODOS: 'todos',
  ACTIVE_WORKSPACE_ID: 'activeWorkspaceId',
  IS_SWITCHING_WORKSPACE: 'isSwitchingWorkspace',
};

/**
 * 워크스페이스 전환 상태 설정
 * @param {boolean} isSwitching - 전환 중 여부
 * @returns {Promise<void>}
 */
export async function setWorkspaceSwitchingState(isSwitching) {
  await setStorage({ [STORAGE_KEYS.IS_SWITCHING_WORKSPACE]: isSwitching });
}

/**
 * 워크스페이스 전환 상태 가져오기
 * @returns {Promise<boolean>}
 */
export async function getWorkspaceSwitchingState() {
  const data = await getStorage(STORAGE_KEYS.IS_SWITCHING_WORKSPACE);
  return data[STORAGE_KEYS.IS_SWITCHING_WORKSPACE] || false;
}

/**
 * Unsaved 워크스페이스 ID (고정)
 */
export const UNSAVED_WORKSPACE_ID = 'unsaved';

/**
 * Unsaved 워크스페이스 생성 (없으면 생성)
 * @returns {Promise<Object>}
 */
export async function ensureUnsavedWorkspace() {
  const workspaces = await getWorkspaces();
  let unsavedWorkspace = workspaces.find((ws) => ws.id === UNSAVED_WORKSPACE_ID);
  
  if (!unsavedWorkspace) {
    unsavedWorkspace = {
      id: UNSAVED_WORKSPACE_ID,
      name: 'Unsaved',
      color: 'bg-slate-400',
      icon: 'briefcase',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    workspaces.push(unsavedWorkspace);
    await saveWorkspaces(workspaces);
  }
  
  return unsavedWorkspace;
}

/**
 * 모든 워크스페이스 가져오기
 * @returns {Promise<Array>}
 */
export async function getWorkspaces() {
  const data = await getStorage(STORAGE_KEYS.WORKSPACES);
  let workspaces = data[STORAGE_KEYS.WORKSPACES] || [];
  
  // 마이그레이션: order 필드가 없는 워크스페이스에 order 추가
  let needsSave = false;
  workspaces = workspaces.map((ws, index) => {
    if (ws.order === undefined) {
      needsSave = true;
      // Unsaved 워크스페이스는 항상 0, 나머지는 순차적으로 할당
      const order = ws.id === UNSAVED_WORKSPACE_ID ? 0 : (index + 1) * 100;
      return { ...ws, order };
    }
    return ws;
  });
  
  if (needsSave) {
    await saveWorkspaces(workspaces);
  }
  
  return workspaces;
}

/**
 * 워크스페이스 저장
 * @param {Array} workspaces - 워크스페이스 배열
 * @returns {Promise<void>}
 */
export async function saveWorkspaces(workspaces) {
  await setStorage({ [STORAGE_KEYS.WORKSPACES]: workspaces });
}

/**
 * 워크스페이스 추가
 * @param {Object} workspace - 추가할 워크스페이스 객체
 * @returns {Promise<Object>}
 */
export async function addWorkspace(workspace) {
  const workspaces = await getWorkspaces();
  
  // 기존 워크스페이스 중 최대 order 값 찾기 (Unsaved 제외)
  const maxOrder = workspaces
    .filter(ws => ws.id !== UNSAVED_WORKSPACE_ID && ws.order !== undefined)
    .reduce((max, ws) => Math.max(max, ws.order || 0), 0);
  
  const newWorkspace = {
    id: workspace.id || `ws-${Date.now()}`,
    name: workspace.name || '새 워크스페이스',
    color: workspace.color || 'bg-blue-500',
    icon: workspace.icon || 'briefcase',
    order: workspace.order !== undefined ? workspace.order : maxOrder + 100,
    createdAt: workspace.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  workspaces.push(newWorkspace);
  await saveWorkspaces(workspaces);
  return newWorkspace;
}

/**
 * 워크스페이스 업데이트
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {Object} updates - 업데이트할 속성들
 * @returns {Promise<Object>}
 */
export async function updateWorkspace(workspaceId, updates) {
  const workspaces = await getWorkspaces();
  const index = workspaces.findIndex((ws) => ws.id === workspaceId);
  if (index === -1) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }
  workspaces[index] = {
    ...workspaces[index],
    ...updates,
    updatedAt: Date.now(),
  };
  await saveWorkspaces(workspaces);
  return workspaces[index];
}

/**
 * 워크스페이스 순서 변경
 * @param {string} draggedWorkspaceId - 드래그한 워크스페이스 ID
 * @param {string} targetWorkspaceId - 드롭 대상 워크스페이스 ID
 * @returns {Promise<void>}
 */
export async function reorderWorkspaces(draggedWorkspaceId, targetWorkspaceId) {
  // Unsaved 워크스페이스는 순서 변경 불가
  if (draggedWorkspaceId === UNSAVED_WORKSPACE_ID || targetWorkspaceId === UNSAVED_WORKSPACE_ID) {
    return;
  }
  
  const workspaces = await getWorkspaces();
  
  // Unsaved를 제외한 워크스페이스만 필터링 및 정렬
  const otherWorkspaces = workspaces.filter(ws => ws.id !== UNSAVED_WORKSPACE_ID);
  const unsavedWorkspace = workspaces.find(ws => ws.id === UNSAVED_WORKSPACE_ID);
  
  // 드래그한 워크스페이스와 대상 워크스페이스 찾기
  const draggedIndex = otherWorkspaces.findIndex(ws => ws.id === draggedWorkspaceId);
  const targetIndex = otherWorkspaces.findIndex(ws => ws.id === targetWorkspaceId);
  
  if (draggedIndex === -1 || targetIndex === -1) {
    return;
  }
  
  // 워크스페이스 배열에서 순서 변경
  const [draggedWorkspace] = otherWorkspaces.splice(draggedIndex, 1);
  otherWorkspaces.splice(targetIndex, 0, draggedWorkspace);
  
  // order 값 재할당 (100 단위로)
  otherWorkspaces.forEach((ws, index) => {
    ws.order = (index + 1) * 100;
    ws.updatedAt = Date.now();
  });
  
  // Unsaved 워크스페이스를 맨 앞에 추가
  const reorderedWorkspaces = unsavedWorkspace 
    ? [unsavedWorkspace, ...otherWorkspaces]
    : otherWorkspaces;
  
  await saveWorkspaces(reorderedWorkspaces);
}

/**
 * 워크스페이스 삭제
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<void>}
 */
export async function deleteWorkspace(workspaceId) {
  // Unsaved 워크스페이스는 삭제 불가
  if (workspaceId === UNSAVED_WORKSPACE_ID) {
    throw new Error('Unsaved 워크스페이스는 삭제할 수 없습니다.');
  }
  
  const workspaces = await getWorkspaces();
  const filtered = workspaces.filter((ws) => ws.id !== workspaceId);
  await saveWorkspaces(filtered);
  
  // 관련 데이터도 삭제
  await deleteSavedTabsByWorkspace(workspaceId);
  await deleteResourcesByWorkspace(workspaceId);
  await deleteNote(workspaceId);
  await deleteTodos(workspaceId);
}

/**
 * 활성 워크스페이스 ID 가져오기
 * @returns {Promise<string|null>}
 */
export async function getActiveWorkspaceId() {
  const data = await getStorage(STORAGE_KEYS.ACTIVE_WORKSPACE_ID);
  return data[STORAGE_KEYS.ACTIVE_WORKSPACE_ID] || null;
}

/**
 * 활성 워크스페이스 ID 설정
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<void>}
 */
export async function setActiveWorkspaceId(workspaceId) {
  await setStorage({ [STORAGE_KEYS.ACTIVE_WORKSPACE_ID]: workspaceId });
}

/**
 * 저장된 탭 가져오기
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<Array>}
 */
export async function getSavedTabs(workspaceId) {
  const data = await getStorage(STORAGE_KEYS.SAVED_TABS);
  const allTabs = data[STORAGE_KEYS.SAVED_TABS] || {};
  return allTabs[workspaceId] || [];
}

/**
 * 모든 워크스페이스의 저장된 탭 가져오기
 * @returns {Promise<Object>} workspaceId를 키로 하는 탭 객체
 */
export async function getAllSavedTabs() {
  const data = await getStorage(STORAGE_KEYS.SAVED_TABS);
  return data[STORAGE_KEYS.SAVED_TABS] || {};
}

/**
 * 저장된 탭 저장
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {Array} tabs - 탭 배열
 * @returns {Promise<void>}
 */
export async function saveTabs(workspaceId, tabs) {
  const data = await getStorage(STORAGE_KEYS.SAVED_TABS);
  const allTabs = data[STORAGE_KEYS.SAVED_TABS] || {};
  allTabs[workspaceId] = tabs;
  await setStorage({ [STORAGE_KEYS.SAVED_TABS]: allTabs });
}

/**
 * 탭을 워크스페이스에 추가
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {Object} tab - 추가할 탭 객체
 * @returns {Promise<void>}
 */
export async function addTabToWorkspace(workspaceId, tab) {
  const tabs = await getSavedTabs(workspaceId);
  
  // URL 기준으로 중복 체크
  const existingTabIndex = tabs.findIndex(t => t.url === tab.url);
  
  if (existingTabIndex !== -1) {
    // 이미 존재하는 탭이면 업데이트 (최신 정보로)
    const existingTab = tabs[existingTabIndex];
    tabs[existingTabIndex] = {
      ...existingTab,
      title: tab.title || existingTab.title,
      domain: tab.domain || existingTab.domain,
      favicon: tab.favicon || existingTab.favicon,
      savedAt: tab.savedAt || existingTab.savedAt,
    };
    await saveTabs(workspaceId, tabs);
    return tabs[existingTabIndex];
  }
  
  // 새 탭 추가
  const newTab = {
    id: tab.id || `saved-${Date.now()}-${Math.random()}`,
    title: tab.title || 'Untitled',
    url: tab.url || '',
    domain: tab.domain || '',
    favicon: tab.favicon || '',
    savedAt: tab.savedAt || Date.now(),
  };
  tabs.push(newTab);
  await saveTabs(workspaceId, tabs);
  return newTab;
}

/**
 * 탭을 워크스페이스 간 이동
 * @param {string} fromWorkspaceId - 원본 워크스페이스 ID
 * @param {string} toWorkspaceId - 대상 워크스페이스 ID
 * @param {string} tabId - 이동할 탭 ID
 * @returns {Promise<void>}
 */
export async function moveTabBetweenWorkspaces(fromWorkspaceId, toWorkspaceId, tabId) {
  const fromTabs = await getSavedTabs(fromWorkspaceId);
  const tabIndex = fromTabs.findIndex((t) => t.id === tabId);
  if (tabIndex === -1) {
    throw new Error(`Tab ${tabId} not found in workspace ${fromWorkspaceId}`);
  }
  
  const tab = fromTabs[tabIndex];
  const updatedFromTabs = fromTabs.filter((t) => t.id !== tabId);
  await saveTabs(fromWorkspaceId, updatedFromTabs);
  
  await addTabToWorkspace(toWorkspaceId, tab);
}

/**
 * 워크스페이스별 저장된 탭 삭제
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<void>}
 */
async function deleteSavedTabsByWorkspace(workspaceId) {
  const data = await getStorage(STORAGE_KEYS.SAVED_TABS);
  const allTabs = data[STORAGE_KEYS.SAVED_TABS] || {};
  delete allTabs[workspaceId];
  await setStorage({ [STORAGE_KEYS.SAVED_TABS]: allTabs });
}

/**
 * 리소스 가져오기
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<Array>}
 */
export async function getResources(workspaceId) {
  const data = await getStorage(STORAGE_KEYS.RESOURCES);
  const allResources = data[STORAGE_KEYS.RESOURCES] || {};
  return allResources[workspaceId] || [];
}

/**
 * 리소스 저장
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {Array} resources - 리소스 배열
 * @returns {Promise<void>}
 */
export async function saveResources(workspaceId, resources) {
  const data = await getStorage(STORAGE_KEYS.RESOURCES);
  const allResources = data[STORAGE_KEYS.RESOURCES] || {};
  allResources[workspaceId] = resources;
  await setStorage({ [STORAGE_KEYS.RESOURCES]: allResources });
}

/**
 * 리소스를 워크스페이스 간 이동
 * @param {string} fromWorkspaceId - 원본 워크스페이스 ID
 * @param {string} toWorkspaceId - 대상 워크스페이스 ID
 * @param {string} resourceId - 이동할 리소스 ID
 * @returns {Promise<void>}
 */
export async function moveResourceBetweenWorkspaces(fromWorkspaceId, toWorkspaceId, resourceId) {
  const fromResources = await getResources(fromWorkspaceId);
  const resourceIndex = fromResources.findIndex((r) => r.id === resourceId);
  if (resourceIndex === -1) {
    throw new Error(`Resource ${resourceId} not found in workspace ${fromWorkspaceId}`);
  }
  
  const resource = fromResources[resourceIndex];
  const updatedFromResources = fromResources.filter((r) => r.id !== resourceId);
  await saveResources(fromWorkspaceId, updatedFromResources);
  
  const toResources = await getResources(toWorkspaceId);
  toResources.push(resource);
  await saveResources(toWorkspaceId, toResources);
}

/**
 * 탭을 리소스로 변환
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {Object} tab - 변환할 탭 객체
 * @returns {Promise<void>}
 */
export async function convertTabToResource(workspaceId, tab) {
  const resources = await getResources(workspaceId);
  const newResource = {
    id: `resource-${Date.now()}`,
    title: tab.title || tab.url || 'Untitled',
    url: tab.url || '',
    type: 'link',
  };
  resources.push(newResource);
  await saveResources(workspaceId, resources);
  return newResource;
}

/**
 * 워크스페이스별 리소스 삭제
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<void>}
 */
async function deleteResourcesByWorkspace(workspaceId) {
  const data = await getStorage(STORAGE_KEYS.RESOURCES);
  const allResources = data[STORAGE_KEYS.RESOURCES] || {};
  delete allResources[workspaceId];
  await setStorage({ [STORAGE_KEYS.RESOURCES]: allResources });
}

/**
 * 노트 가져오기
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<string>}
 */
export async function getNote(workspaceId) {
  const data = await getStorage(STORAGE_KEYS.NOTES);
  const allNotes = data[STORAGE_KEYS.NOTES] || {};
  return allNotes[workspaceId] || '';
}

/**
 * 노트 저장
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {string} content - 노트 내용
 * @returns {Promise<void>}
 */
export async function saveNote(workspaceId, content) {
  const data = await getStorage(STORAGE_KEYS.NOTES);
  const allNotes = data[STORAGE_KEYS.NOTES] || {};
  allNotes[workspaceId] = content;
  await setStorage({ [STORAGE_KEYS.NOTES]: allNotes });
}

/**
 * 노트 삭제
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<void>}
 */
async function deleteNote(workspaceId) {
  const data = await getStorage(STORAGE_KEYS.NOTES);
  const allNotes = data[STORAGE_KEYS.NOTES] || {};
  delete allNotes[workspaceId];
  await setStorage({ [STORAGE_KEYS.NOTES]: allNotes });
}

/**
 * 투두 목록 가져오기
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<Array>}
 */
export async function getTodos(workspaceId) {
  const data = await getStorage(STORAGE_KEYS.TODOS);
  const allTodos = data[STORAGE_KEYS.TODOS] || {};
  return allTodos[workspaceId] || [];
}

/**
 * 투두 목록 저장
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {Array} todos - 투두 배열
 * @returns {Promise<void>}
 */
export async function saveTodos(workspaceId, todos) {
  const data = await getStorage(STORAGE_KEYS.TODOS);
  const allTodos = data[STORAGE_KEYS.TODOS] || {};
  allTodos[workspaceId] = todos;
  await setStorage({ [STORAGE_KEYS.TODOS]: allTodos });
}

/**
 * 투두 추가
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {string} text - 투두 내용
 * @returns {Promise<Object>}
 */
export async function addTodo(workspaceId, text) {
  const todos = await getTodos(workspaceId);
  const newTodo = {
    id: `todo-${Date.now()}-${Math.random()}`,
    text,
    completed: false,
    createdAt: Date.now(),
  };
  todos.push(newTodo);
  await saveTodos(workspaceId, todos);
  return newTodo;
}

/**
 * 투두 상태 토글
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {string} todoId - 투두 ID
 * @returns {Promise<void>}
 */
export async function toggleTodo(workspaceId, todoId) {
  const todos = await getTodos(workspaceId);
  const index = todos.findIndex((t) => t.id === todoId);
  if (index !== -1) {
    todos[index].completed = !todos[index].completed;
    await saveTodos(workspaceId, todos);
  }
}

/**
 * 투두 삭제
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {string} todoId - 투두 ID
 * @returns {Promise<void>}
 */
export async function deleteTodo(workspaceId, todoId) {
  const todos = await getTodos(workspaceId);
  const filtered = todos.filter((t) => t.id !== todoId);
  await saveTodos(workspaceId, filtered);
}

/**
 * 투두 목록 삭제 (워크스페이스 삭제 시)
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<void>}
 */
async function deleteTodos(workspaceId) {
  const data = await getStorage(STORAGE_KEYS.TODOS);
  const allTodos = data[STORAGE_KEYS.TODOS] || {};
  delete allTodos[workspaceId];
  await setStorage({ [STORAGE_KEYS.TODOS]: allTodos });
}