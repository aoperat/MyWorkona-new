import React, { useState, useEffect } from 'react';
import {
  Layout,
  Plus,
  Search,
  Settings,
  X,
  ExternalLink,
  Briefcase,
  Code,
  PenTool,
  Globe,
  Star,
  ChevronLeft,
  Menu,
  Trash2,
  CheckCircle,
  Circle,
  Loader2,
} from 'lucide-react';
import {
  getWorkspaces,
  getActiveWorkspaceId,
  addTabToWorkspace,
  moveTabBetweenWorkspaces,
  setActiveWorkspaceId,
  getSavedTabs,
  getResources,
  getNote,
  addWorkspace,
  deleteWorkspace,
  saveTabs,
  saveResources,
  saveNote,
  moveResourceBetweenWorkspaces,
  convertTabToResource,
  ensureUnsavedWorkspace,
  UNSAVED_WORKSPACE_ID,
  setWorkspaceSwitchingState,
  getTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  reorderWorkspaces,
} from '../utils/workspace.js';
import { checkSyncStatus } from '../utils/storage.js';
import { 
  getCurrentWindowTabs, 
  convertChromeTabToAppTab, 
  createTabs,
  closeTabs,
  activateTab,
  pinTabToFirst,
  getPinnedTabs,
  extractDomain,
} from '../utils/tabs.js';

const SidebarItem = ({ workspace, isActive, onClick, onDelete, onDragOver, onDrop, onDragStart, isDraggable }) => (
  <div className="group relative">
    <button
      onClick={onClick}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
        ${isActive
          ? 'bg-white shadow-sm text-slate-800 ring-1 ring-slate-200'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }
        ${isDraggable ? 'cursor-move' : ''}
      `}
    >
      <div className={`w-2 h-2 rounded-full ${workspace.color}`} />
      <span className="flex-1 text-left truncate font-medium">{workspace.name}</span>
    </button>
    {onDelete && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(workspace.id);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
      >
        <X size={12} />
      </button>
    )}
  </div>
);

const TabCard = ({ tab, onDelete, onClick, draggable = false, onDragStart }) => (
  <div
    draggable={draggable}
    onDragStart={onDragStart}
    onClick={onClick}
    className="group relative flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200 cursor-pointer"
  >
    {/* Favicon */}
    {tab.favicon ? (
      <img
        src={tab.favicon}
        alt=""
        className={`w-10 h-10 rounded-lg ${tab.active ? 'ring-2 ring-indigo-100' : ''}`}
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
    ) : null}
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 font-bold text-xs
        ${tab.active ? 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-100' : 'bg-slate-50'}
        ${tab.favicon ? 'hidden' : ''}`}
    >
      {tab.domain[0]?.toUpperCase() || '?'}
    </div>

    <div className="flex-1 min-w-0">
      <h4 className={`text-sm font-medium truncate ${tab.active ? 'text-indigo-700' : 'text-slate-700'}`}>
        {tab.title}
      </h4>
      <p className="text-xs text-slate-400 truncate mt-0.5">{tab.domain}</p>
    </div>

    {tab.active && (
      <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-600 rounded-full">
        Active
      </span>
    )}

    {onDelete && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(tab.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
      >
        <X size={14} />
      </button>
    )}
  </div>
);

const ResourceItem = ({ resource, onClick, onDelete, draggable = false, onDragStart }) => (
  <div 
    draggable={draggable}
    onDragStart={onDragStart}
    className="group relative flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-600 hover:text-slate-900 transition-colors"
  >
    <div
      onClick={onClick}
      className="flex-1 flex items-center gap-3 min-w-0"
    >
      <div className="p-1.5 bg-slate-100 rounded-md">
        <Star size={14} className="text-amber-400 fill-amber-400" />
      </div>
      <span className="text-sm font-medium truncate">{resource.title}</span>
      <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 ml-auto" />
    </div>
    {onDelete && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(resource.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
      >
        <X size={12} />
      </button>
    )}
  </div>
);

const COLOR_OPTIONS = [
  'bg-blue-500',
  'bg-pink-500',
  'bg-purple-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-cyan-500',
];

export default function App() {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [currentTabs, setCurrentTabs] = useState([]);
  const [savedTabs, setSavedTabs] = useState([]);
  const [resources, setResources] = useState([]);
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewWorkspaceForm, setShowNewWorkspaceForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [pinnedTabIds, setPinnedTabIds] = useState(new Set());
  const [currentMainTab, setCurrentMainTab] = useState('tabs'); // 'tabs', 'todo', 'note'
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [syncStatus, setSyncStatus] = useState({ enabled: true, loading: true });
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    loadData();
    checkSyncStatusOnLoad();
  }, []);

  // 동기화 상태 확인
  const checkSyncStatusOnLoad = async () => {
    try {
      const status = await checkSyncStatus();
      setSyncStatus({ ...status, loading: false });
      
      if (!status.enabled) {
        console.warn('동기화가 비활성화되어 있습니다:', status.error);
      }
    } catch (error) {
      console.error('동기화 상태 확인 실패:', error);
      setSyncStatus({ enabled: false, error: '동기화 상태를 확인할 수 없습니다', loading: false });
    }
  };

  // 고정된 탭 ID 목록 로드
  useEffect(() => {
    const loadPinnedTabs = async () => {
      try {
        const pinnedTabs = await getPinnedTabs();
        setPinnedTabIds(new Set(pinnedTabs.map(tab => tab.id)));
      } catch (error) {
        console.error('고정된 탭 로드 실패:', error);
      }
    };
    loadPinnedTabs();
    
    // 탭 변경 시마다 고정된 탭 목록 업데이트
    const interval = setInterval(loadPinnedTabs, 1000);
    return () => clearInterval(interval);
  }, [currentTabs]);

  // 활성 워크스페이스 변경 시 데이터 로드
  useEffect(() => {
    if (activeWorkspaceId) {
      loadWorkspaceData(activeWorkspaceId);
      loadCurrentTabs();
    }
  }, [activeWorkspaceId]);

  // 탭 변경 시 실시간 업데이트
  useEffect(() => {
    const handleTabCreated = async (tab) => {
      // MyWorkona 탭이 아닌 경우에만 업데이트
      const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
      if (tab.url && tab.url !== myWorkonaUrl) {
        await loadCurrentTabs();
        if (activeWorkspaceId) {
          // background.js에서 워크스페이스에 탭을 추가하는 시간을 고려하여 약간의 지연 후 업데이트
          setTimeout(async () => {
            await loadWorkspaceData(activeWorkspaceId);
          }, 100);
        }
      }
    };

    const handleTabRemoved = async (tabId, removeInfo) => {
      await loadCurrentTabs();
      if (activeWorkspaceId) {
        await loadWorkspaceData(activeWorkspaceId);
      }
    };

    const handleTabUpdated = async (tabId, changeInfo, tab) => {
      // 로딩 완료 시에만 업데이트
      if (changeInfo.status === 'complete') {
        // MyWorkona 탭이 아닌 경우에만 업데이트
        const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
        if (tab.url && tab.url !== myWorkonaUrl) {
          await loadCurrentTabs();
          if (activeWorkspaceId) {
            // background.js에서 워크스페이스에 탭을 추가하는 시간을 고려하여 약간의 지연 후 업데이트
            setTimeout(async () => {
              await loadWorkspaceData(activeWorkspaceId);
            }, 100);
          }
        }
      }
    };

    // 리스너 등록
    chrome.tabs.onCreated.addListener(handleTabCreated);
    chrome.tabs.onRemoved.addListener(handleTabRemoved);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    // 컴포넌트 언마운트 시 리스너 정리
    return () => {
      chrome.tabs.onCreated.removeListener(handleTabCreated);
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [activeWorkspaceId]);

  const loadData = async () => {
    try {
      // Unsaved 워크스페이스가 없으면 생성
      await ensureUnsavedWorkspace();
      
      const [workspacesData, activeId] = await Promise.all([
        getWorkspaces(),
        getActiveWorkspaceId(),
      ]);

      setWorkspaces(workspacesData);
      if (activeId && workspacesData.find((w) => w.id === activeId)) {
        setActiveWorkspaceIdState(activeId);
      } else {
        // 활성 워크스페이스가 없으면 Unsaved 워크스페이스를 기본으로 설정
        const unsavedId = UNSAVED_WORKSPACE_ID;
        setActiveWorkspaceIdState(unsavedId);
        await setActiveWorkspaceId(unsavedId);
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceData = async (workspaceId) => {
    try {
      const [tabs, resourcesData, noteData, todosData] = await Promise.all([
        getSavedTabs(workspaceId),
        getResources(workspaceId),
        getNote(workspaceId),
        getTodos(workspaceId),
      ]);
      
      // 저장된 탭에서 URL 기준으로 중복 제거
      const seenUrls = new Set();
      const deduplicatedTabs = tabs.filter(tab => {
        if (!tab.url) return false;
        if (seenUrls.has(tab.url)) return false;
        seenUrls.add(tab.url);
        return true;
      });
      
      // 중복이 제거된 경우 저장
      if (deduplicatedTabs.length !== tabs.length) {
        await saveTabs(workspaceId, deduplicatedTabs);
        setSavedTabs(deduplicatedTabs);
      } else {
        setSavedTabs(tabs);
      }
      
      setResources(resourcesData);
      setNote(noteData);
      setNoteContent(noteData);
      setTodos(todosData);
    } catch (error) {
      console.error('워크스페이스 데이터 로드 실패:', error);
    }
  };

  const loadCurrentTabs = async () => {
    try {
      const tabs = await getCurrentWindowTabs();
      const appTabs = tabs.map(convertChromeTabToAppTab);
      setCurrentTabs(appTabs);
    } catch (error) {
      console.error('현재 탭 로드 실패:', error);
    }
  };

  const handleWorkspaceChange = async (workspaceId) => {
    // 이미 전환 중이면 무시
    if (isSwitchingWorkspace) {
      return;
    }
    
    // 같은 워크스페이스로 전환하려고 하면 무시
    if (workspaceId === activeWorkspaceId) {
      return;
    }
    
    // 최소 딜레이를 보장하기 위한 시작 시간 기록
    const startTime = Date.now();
    const MIN_SWITCH_DELAY = 300; // 최소 300ms 딜레이
    
    try {
      // 전환 중 상태 설정
      setIsSwitchingWorkspace(true);
      
      // 워크스페이스 전환 시작 알림 (Background 스크립트가 탭 변경을 무시하도록 함)
      await setWorkspaceSwitchingState(true);
      
      const previousWorkspaceId = activeWorkspaceId;
      
      // 현재 워크스페이스가 있는 경우, 현재 열려있는 탭 상태 저장 (Unsaved 포함)
      if (previousWorkspaceId) {
        const currentTabs = await getCurrentWindowTabs();
        const pinnedTabs = await getPinnedTabs();
        const pinnedTabIds = new Set(pinnedTabs.map(tab => tab.id));
        
        // 현재 열려있는 탭을 현재 워크스페이스에 저장 (고정 탭 제외)
        const tabsToSave = currentTabs
          .filter(tab => 
            tab.url && 
            !tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('chrome-extension://') &&
            !pinnedTabIds.has(tab.id)
          )
          .map(tab => ({
            id: `saved-${Date.now()}-${Math.random()}`,
            title: tab.title || 'Untitled',
            url: tab.url,
            domain: extractDomain(tab.url),
            favicon: tab.favIconUrl || '',
            savedAt: Date.now(),
          }));
        
        // 탭이 없더라도 빈 배열을 저장하여 상태 업데이트 (모든 탭을 닫은 경우)
        await saveTabs(previousWorkspaceId, tabsToSave);
      }
      
      // 워크스페이스 ID 설정
      setActiveWorkspaceIdState(workspaceId);
      await setActiveWorkspaceId(workspaceId);

      // 현재 열린 탭 가져오기
      const currentTabs = await getCurrentWindowTabs();
      
      // 고정된 탭 ID 목록 가져오기
      const pinnedTabs = await getPinnedTabs();
      const pinnedTabIds = new Set(pinnedTabs.map(tab => tab.id));
      const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
      
      // UNSAVED 워크스페이스로 전환하는 경우
      if (workspaceId === UNSAVED_WORKSPACE_ID) {
        // 이전 워크스페이스의 모든 탭(고정 탭 제외) 닫기
        const tabsToClose = currentTabs
          .filter(tab => 
            tab.url && 
            !tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('chrome-extension://') &&
            !pinnedTabIds.has(tab.id) &&
            tab.url !== myWorkonaUrl // MyWorkona 탭 제외
          )
          .map(tab => tab.id);
        
        if (tabsToClose.length > 0) {
          await closeTabs(tabsToClose);
        }
        
        // UNSAVED 워크스페이스에 저장된 탭이 있으면 열기
        const savedTabs = await getSavedTabs(workspaceId);
        if (savedTabs.length > 0) {
          const tabsToOpen = savedTabs
            .filter(tab => tab.url)
            .map(tab => tab.url);
          
          if (tabsToOpen.length > 0) {
            await createTabs(tabsToOpen, false, false);
            
            // 탭이 열린 후 활성화할 탭 선택
            const newTabs = await getCurrentWindowTabs();
            const workspaceTabs = newTabs.filter(tab => 
              tab.url && 
              !tab.url.startsWith('chrome://') && 
              !tab.url.startsWith('chrome-extension://') &&
              !pinnedTabIds.has(tab.id) &&
              tab.url !== myWorkonaUrl &&
              tabsToOpen.includes(tab.url)
            );
            
            // MyWorkona 탭이 활성화되어 있지 않은 경우에만 워크스페이스 탭 활성화
            const activeTab = newTabs.find(tab => tab.active);
            const isMyWorkonaActive = activeTab && activeTab.url === myWorkonaUrl;
            
            if (!isMyWorkonaActive && workspaceTabs.length > 0) {
              await activateTab(workspaceTabs[0].id);
            }
          }
        }
      } else {
        // 일반 워크스페이스로 전환하는 경우
        // 이전 워크스페이스의 모든 탭(고정 탭 제외) 닫기
        const tabsToClose = currentTabs
          .filter(tab => 
            tab.url && 
            !tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('chrome-extension://') &&
            !pinnedTabIds.has(tab.id) &&
            tab.url !== myWorkonaUrl // MyWorkona 탭 제외
          )
          .map(tab => tab.id);
        
        if (tabsToClose.length > 0) {
          await closeTabs(tabsToClose);
        }
        
        // 새 워크스페이스에 저장된 탭 가져오기
        const savedTabs = await getSavedTabs(workspaceId);
        
        // 새 워크스페이스에 저장된 탭이 있으면 열기
        if (savedTabs.length > 0) {
          const tabsToOpen = savedTabs
            .filter(tab => tab.url)
            .map(tab => tab.url);
          
          if (tabsToOpen.length > 0) {
            await createTabs(tabsToOpen, false, false);
            
            // 탭이 열린 후 활성화할 탭 선택
            const newTabs = await getCurrentWindowTabs();
            const workspaceTabs = newTabs.filter(tab => 
              tab.url && 
              !tab.url.startsWith('chrome://') && 
              !tab.url.startsWith('chrome-extension://') &&
              !pinnedTabIds.has(tab.id) &&
              tab.url !== myWorkonaUrl && // MyWorkona 탭 제외
              tabsToOpen.includes(tab.url)
            );
            
            // MyWorkona 탭이 활성화되어 있지 않은 경우에만 워크스페이스 탭 활성화
            const activeTab = newTabs.find(tab => tab.active);
            const isMyWorkonaActive = activeTab && activeTab.url === myWorkonaUrl;
            
            if (!isMyWorkonaActive && workspaceTabs.length > 0) {
              await activateTab(workspaceTabs[0].id);
            }
          }
        }
      }
    } catch (error) {
      console.error('워크스페이스 변경 실패:', error);
      setIsSwitchingWorkspace(false);
      await setWorkspaceSwitchingState(false);
    } finally {
      // 최소 딜레이 보장
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, MIN_SWITCH_DELAY - elapsed);
      
      setTimeout(async () => {
        await setWorkspaceSwitchingState(false);
        // 전환 완료 후 현재 상태와 동기화 (누락된 탭이 없도록)
        if (workspaceId) {
          await loadWorkspaceData(workspaceId);
          await loadCurrentTabs();
        }
        // 전환 중 상태 해제 (추가 딜레이로 연속 전환 방지)
        setTimeout(() => {
          setIsSwitchingWorkspace(false);
        }, 100);
      }, 300 + remainingDelay);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    try {
      const color = COLOR_OPTIONS[workspaces.length % COLOR_OPTIONS.length];
      const newWorkspace = await addWorkspace({
        name: newWorkspaceName.trim(),
        color,
        icon: 'briefcase',
      });
      
      setWorkspaces([...workspaces, newWorkspace]);
      setNewWorkspaceName('');
      setShowNewWorkspaceForm(false);
      
      // 워크스페이스 전환으로 탭 전환 수행
      await handleWorkspaceChange(newWorkspace.id);
    } catch (error) {
      console.error('워크스페이스 생성 실패:', error);
    }
  };

  const handleDeleteWorkspace = async (workspaceId) => {
    if (workspaceId === UNSAVED_WORKSPACE_ID) {
      alert('Unsaved 워크스페이스는 삭제할 수 없습니다.');
      return;
    }
    
    if (!confirm('이 워크스페이스를 삭제하시겠습니까?')) return;

    try {
      await deleteWorkspace(workspaceId);
      const updated = workspaces.filter((w) => w.id !== workspaceId);
      setWorkspaces(updated);
      
      if (activeWorkspaceId === workspaceId) {
        // Unsaved 워크스페이스로 전환
        const unsavedId = UNSAVED_WORKSPACE_ID;
        setActiveWorkspaceIdState(unsavedId);
        await setActiveWorkspaceId(unsavedId);
      }
    } catch (error) {
      if (error.message.includes('Unsaved')) {
        alert(error.message);
      } else {
        console.error('워크스페이스 삭제 실패:', error);
      }
    }
  };

  const handleAddResource = async () => {
    if (!activeWorkspaceId) return;
    
    const url = prompt('리소스 URL을 입력하세요:');
    if (!url) return;

    try {
      const newResource = {
        id: `resource-${Date.now()}`,
        title: url,
        url: url.startsWith('http') ? url : `https://${url}`,
        type: 'link',
      };

      const updated = [...resources, newResource];
      await saveResources(activeWorkspaceId, updated);
      setResources(updated);
    } catch (error) {
      console.error('리소스 추가 실패:', error);
    }
  };

  const handleDeleteResource = async (resourceId) => {
    if (!activeWorkspaceId) return;

    try {
      const updated = resources.filter((r) => r.id !== resourceId);
      await saveResources(activeWorkspaceId, updated);
      setResources(updated);
    } catch (error) {
      console.error('리소스 삭제 실패:', error);
    }
  };

  const handleSaveNote = async () => {
    if (!activeWorkspaceId) return;

    try {
      await saveNote(activeWorkspaceId, noteContent);
      setNote(noteContent);
      setEditingNote(false);
    } catch (error) {
      console.error('노트 저장 실패:', error);
    }
  };

  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!newTodoText.trim() || !activeWorkspaceId) return;

    try {
      const newTodo = await addTodo(activeWorkspaceId, newTodoText.trim());
      setTodos([...todos, newTodo]);
      setNewTodoText('');
    } catch (error) {
      console.error('투두 추가 실패:', error);
    }
  };

  const handleToggleTodo = async (todoId) => {
    if (!activeWorkspaceId) return;
    try {
      await toggleTodo(activeWorkspaceId, todoId);
      setTodos(todos.map(t => 
        t.id === todoId ? { ...t, completed: !t.completed } : t
      ));
    } catch (error) {
      console.error('투두 상태 변경 실패:', error);
    }
  };

  const handleTodoDelete = async (todoId) => {
    if (!activeWorkspaceId) return;
    try {
      await deleteTodo(activeWorkspaceId, todoId);
      setTodos(todos.filter(t => t.id !== todoId));
    } catch (error) {
      console.error('투두 삭제 실패:', error);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (e, tab, type = 'tab') => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type, tab }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 워크스페이스 드래그 앤 드롭 핸들러
  const handleWorkspaceDragStart = (e, workspaceId) => {
    if (workspaceId === UNSAVED_WORKSPACE_ID) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'workspace', workspaceId }));
  };

  const handleWorkspaceDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleWorkspaceDrop = async (e, targetWorkspaceId) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'workspace' && data.workspaceId && data.workspaceId !== targetWorkspaceId) {
        // Unsaved 워크스페이스는 순서 변경 불가
        if (data.workspaceId === UNSAVED_WORKSPACE_ID || targetWorkspaceId === UNSAVED_WORKSPACE_ID) {
          return;
        }
        
        await reorderWorkspaces(data.workspaceId, targetWorkspaceId);
        
        // 워크스페이스 목록 새로고침
        const updatedWorkspaces = await getWorkspaces();
        setWorkspaces(updatedWorkspaces);
      }
    } catch (error) {
      console.error('워크스페이스 순서 변경 실패:', error);
    }
  };

  const handleDropOnWorkspace = async (e, targetWorkspaceId) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'tab' && activeWorkspaceId && activeWorkspaceId !== targetWorkspaceId) {
        // UNSAVED 워크스페이스에서 다른 워크스페이스로 이동하는 경우
        if (activeWorkspaceId === UNSAVED_WORKSPACE_ID) {
          // 현재 열려있는 탭 정보를 가져와서 다른 워크스페이스에 추가
          if (data.tab.url && data.tab.chromeTabId) {
            const tabData = {
              title: data.tab.title || 'Untitled',
              url: data.tab.url,
              domain: data.tab.domain || extractDomain(data.tab.url),
              favicon: data.tab.favicon || '',
              savedAt: Date.now(),
            };
            
            await addTabToWorkspace(targetWorkspaceId, tabData);
            
            // 현재 열려있는 탭 닫기
            await closeTabs([data.tab.chromeTabId]);
            
            // 워크스페이스 데이터 새로고침
            await loadWorkspaceData(targetWorkspaceId);
            await loadCurrentTabs(); // UNSAVED 워크스페이스는 currentTabs를 사용하므로
            
            // 대상 워크스페이스가 활성화되어 있으면 탭 열기
            const currentActiveWorkspaceId = await getActiveWorkspaceId();
            if (targetWorkspaceId === currentActiveWorkspaceId && data.tab.url) {
              await createTabs([data.tab.url], false, false);
            }
          }
        } else {
          // 일반 워크스페이스 간 이동
          await moveTabBetweenWorkspaces(activeWorkspaceId, targetWorkspaceId, data.tab.id);
          
          // 현재 열려있는 탭이면 닫기
          if (data.tab.chromeTabId) {
            await closeTabs([data.tab.chromeTabId]);
          }
          
          // 워크스페이스 데이터 새로고침 (활성 워크스페이스의 데이터만 로드)
          await loadWorkspaceData(activeWorkspaceId);
          
          // 대상 워크스페이스가 활성화되어 있으면 탭 열기
          // (B를 열 때 그 탭이 열려야 함)
          const currentActiveWorkspaceId = await getActiveWorkspaceId();
          if (targetWorkspaceId === currentActiveWorkspaceId && data.tab.url) {
            await createTabs([data.tab.url], false, false);
          }
        }
      }
    } catch (error) {
      console.error('탭 이동 실패:', error);
    }
  };

  const handleDropOnResourceSection = async (e) => {
    e.preventDefault();
    if (!activeWorkspaceId || activeWorkspaceId === UNSAVED_WORKSPACE_ID) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'tab') {
        await convertTabToResource(activeWorkspaceId, data.tab);
        await loadWorkspaceData(activeWorkspaceId);
      }
    } catch (error) {
      console.error('리소스 변환 실패:', error);
    }
  };

  const handleDeleteTab = async (tabId) => {
    try {
      if (activeWorkspaceId === UNSAVED_WORKSPACE_ID) {
        // UNSAVED 워크스페이스인 경우: 현재 열려있는 탭만 닫기
        const tab = currentTabs.find(t => t.id === tabId);
        if (tab && tab.chromeTabId) {
          await closeTabs([tab.chromeTabId]);
        }
        await loadCurrentTabs();
      } else {
        // 일반 워크스페이스인 경우: 저장된 탭에서 제거하고 열려있으면 닫기
        const tab = savedTabs.find(t => t.id === tabId);
        if (tab) {
          // 저장된 탭 목록에서 제거
          const updatedTabs = savedTabs.filter(t => t.id !== tabId);
          await saveTabs(activeWorkspaceId, updatedTabs);
          
          // 열려있는 탭이면 닫기
          if (tab.chromeTabId) {
            await closeTabs([tab.chromeTabId]);
          }
          
          // 워크스페이스 데이터 새로고침
          await loadWorkspaceData(activeWorkspaceId);
          await loadCurrentTabs();
        }
      }
    } catch (error) {
      console.error('탭 삭제 실패:', error);
    }
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  
  // 워크스페이스별 탭 표시 (저장된 모든 탭 + 현재 열려있는 탭 정보 매칭, 고정된 탭 제외)
  const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
  const workspaceTabsRaw = activeWorkspaceId === UNSAVED_WORKSPACE_ID
    ? currentTabs
        .filter(tab => {
          // URL이 없으면 제외
          if (!tab.url) return false;
          // Chrome 내부 페이지 제외
          if (tab.url.startsWith('chrome://')) return false;
          if (tab.url.startsWith('chrome-extension://')) return false;
          // MyWorkona 탭 제외
          if (tab.url === myWorkonaUrl) return false;
          // 고정된 탭 제외
          if (pinnedTabIds.has(tab.chromeTabId)) return false;
          return true;
        })
        .map(tab => ({
          ...tab,
          id: tab.id,
          chromeTabId: tab.chromeTabId,
          active: tab.active,
        }))
    : savedTabs.map(savedTab => {
        // 현재 열려있는 탭 중 매칭되는 탭 찾기 (고정된 탭 제외)
        const currentTab = currentTabs.find(ct => 
          ct.url === savedTab.url && !pinnedTabIds.has(ct.chromeTabId)
        );
        
        if (currentTab) {
          // 열려있는 탭
          return {
            ...savedTab,
            id: savedTab.id,
            chromeTabId: currentTab.chromeTabId,
            active: currentTab.active,
          };
        } else {
          // 닫힌 탭
          return {
            ...savedTab,
            id: savedTab.id,
            chromeTabId: null,
            active: false,
          };
        }
      });
  
  // URL 기준으로 중복 제거 (같은 URL이 여러 번 있으면 첫 번째 것만 유지)
  const seenUrls = new Set();
  const workspaceTabs = workspaceTabsRaw.filter(tab => {
    if (!tab.url) return false;
    if (seenUrls.has(tab.url)) return false;
    seenUrls.add(tab.url);
    return true;
  });

  // 검색 필터링
  const displayedTabs = searchQuery
    ? workspaceTabs.filter(
        (tab) =>
          tab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tab.url.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : workspaceTabs;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#F8FAFC]">
        <div className="text-slate-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      {/* --- Sidebar --- */}
      <aside
        className={`${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full opacity-0'}
          bg-[#F1F5F9] border-r border-slate-200 flex-shrink-0 transition-all duration-300 ease-in-out flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="h-14 flex items-center px-4 border-b border-slate-200/60">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-lg tracking-tight">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <Layout size={14} className="text-white" />
            </div>
            MyWorkona
          </div>
        </div>

        {/* Workspace List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 mb-1">
            My Workspaces
          </div>
          {workspaces
            .sort((a, b) => {
              // Unsaved 워크스페이스를 항상 맨 위에
              if (a.id === UNSAVED_WORKSPACE_ID) return -1;
              if (b.id === UNSAVED_WORKSPACE_ID) return 1;
              // order 필드 기준으로 정렬
              const orderA = a.order !== undefined ? a.order : 999999;
              const orderB = b.order !== undefined ? b.order : 999999;
              return orderA - orderB;
            })
            .map((ws) => (
              <SidebarItem
                key={ws.id}
                workspace={ws}
                isActive={activeWorkspaceId === ws.id}
                onClick={() => {
                  if (!isSwitchingWorkspace) {
                    handleWorkspaceChange(ws.id);
                  }
                }}
                onDelete={workspaces.length > 1 && ws.id !== UNSAVED_WORKSPACE_ID ? handleDeleteWorkspace : null}
                onDragOver={(e) => {
                  // 탭 드래그와 워크스페이스 드래그 구분
                  const data = e.dataTransfer.types.includes('application/json') 
                    ? e.dataTransfer.getData('application/json') 
                    : null;
                  if (data) {
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.type === 'workspace') {
                        handleWorkspaceDragOver(e);
                      } else {
                        handleDragOver(e);
                      }
                    } catch {
                      handleDragOver(e);
                    }
                  } else {
                    handleDragOver(e);
                  }
                }}
                onDrop={(e) => {
                  // 탭 드롭과 워크스페이스 드롭 구분
                  const data = e.dataTransfer.getData('application/json');
                  if (data) {
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.type === 'workspace') {
                        handleWorkspaceDrop(e, ws.id);
                      } else {
                        handleDropOnWorkspace(e, ws.id);
                      }
                    } catch {
                      handleDropOnWorkspace(e, ws.id);
                    }
                  } else {
                    handleDropOnWorkspace(e, ws.id);
                  }
                }}
                onDragStart={(e) => handleWorkspaceDragStart(e, ws.id)}
                isDraggable={ws.id !== UNSAVED_WORKSPACE_ID}
              />
            ))}

          {showNewWorkspaceForm ? (
            <div className="p-2 border border-slate-300 rounded-lg bg-white">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="워크스페이스 이름"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateWorkspace();
                  if (e.key === 'Escape') {
                    setShowNewWorkspaceForm(false);
                    setNewWorkspaceName('');
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateWorkspace}
                  className="flex-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                >
                  생성
                </button>
                <button
                  onClick={() => {
                    setShowNewWorkspaceForm(false);
                    setNewWorkspaceName('');
                  }}
                  className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewWorkspaceForm(true)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg mt-2 transition-colors border border-dashed border-slate-300 hover:border-slate-400"
            >
              <Plus size={16} />
              <span>새 워크스페이스</span>
            </button>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200/60 space-y-2">
          {!syncStatus.loading && !syncStatus.enabled && (
            <div 
              className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] cursor-pointer hover:bg-amber-100"
              onClick={() => {
                chrome.tabs.create({ url: 'chrome://settings/syncSetup' });
              }}
              title="Chrome 동기화 설정 열기"
            >
              <div className="font-bold mb-1">⚠️ 동기화 비활성화</div>
              <div className="text-amber-700">다른 기기에서 데이터를 가져올 수 없습니다. Chrome 동기화 설정을 확인하세요.</div>
            </div>
          )}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-white shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
              U
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-700">User</div>
              <div className="text-[10px] text-slate-400">
                {syncStatus.loading ? '동기화 확인 중...' : 
                 syncStatus.enabled ? '동기화 활성화' : '동기화 비활성화'}
              </div>
            </div>
            <Settings size={14} className="text-slate-400" />
          </div>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Top Navigation / Toolbar */}
        <header className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-md text-slate-500 transition-colors"
            >
              {isSidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
            </button>

            {activeWorkspace && (
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${activeWorkspace.color}`}></span>
                <h1 className="text-lg font-bold text-slate-800">{activeWorkspace.name}</h1>
                {isSwitchingWorkspace && (
                  <Loader2 size={16} className="text-indigo-500 animate-spin" />
                )}
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-xs font-medium">
                  {activeWorkspaceId === UNSAVED_WORKSPACE_ID ? workspaceTabs.length : savedTabs.length} tabs
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" />
              <input
                type="text"
                placeholder="탭 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-64 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-6xl mx-auto">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Main Tabs (Tabs / Todo / Note) - Spans 2 columns */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Tab Navigation */}
                <div className="flex items-center gap-1 border-b border-slate-200">
                  <button
                    onClick={() => setCurrentMainTab('tabs')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      currentMainTab === 'tabs'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    Tabs
                  </button>
                  <button
                    onClick={() => setCurrentMainTab('todo')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      currentMainTab === 'todo'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    Todo
                  </button>
                  <button
                    onClick={() => setCurrentMainTab('note')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      currentMainTab === 'note'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    Note
                  </button>
                </div>

                {/* Tab Content */}
                <div className="min-h-[300px]">
                  {currentMainTab === 'tabs' && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                          <Layout size={16} />
                          Tabs ({displayedTabs.length})
                          {activeWorkspaceId !== UNSAVED_WORKSPACE_ID && displayedTabs.length > 0 && (
                            <span className="text-xs text-slate-400 font-normal normal-case">
                              ({displayedTabs.filter(t => t.chromeTabId).length} open)
                            </span>
                          )}
                        </h2>
                      </div>

                      {displayedTabs.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {displayedTabs.map((tab) => (
                            <TabCard
                              key={tab.id}
                              tab={tab}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, tab, 'tab')}
                              onClick={async () => {
                                if (tab.url) {
                                  if (tab.chromeTabId) {
                                    // 열려있는 탭이면 활성화
                                    chrome.tabs.update(tab.chromeTabId, { active: true });
                                  } else {
                                    // 닫힌 탭이면 새로 열기
                                    chrome.tabs.create({ url: tab.url });
                                  }
                                }
                              }}
                              onDelete={handleDeleteTab}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-3 text-slate-300">
                            <Layout size={24} />
                          </div>
                          <p className="text-slate-500 font-medium">열려있는 탭이 없습니다.</p>
                          <p className="text-sm text-slate-400 mt-1">새 탭을 열어 시작하세요.</p>
                        </div>
                      )}
                    </section>
                  )}

                  {currentMainTab === 'todo' && (
                    <section className="h-full flex flex-col">
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full min-h-[400px]">
                        {/* Todo Input Header */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                          <form onSubmit={handleAddTodo} className="flex gap-2">
                            <input
                              type="text"
                              value={newTodoText}
                              onChange={(e) => setNewTodoText(e.target.value)}
                              placeholder="새 할 일 추가..."
                              className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                            />
                            <button
                              type="submit"
                              disabled={!newTodoText.trim()}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm flex items-center gap-2"
                            >
                              <Plus size={16} />
                              추가
                            </button>
                          </form>
                        </div>

                        {/* Todo List */}
                        <div className="flex-1 overflow-y-auto p-2">
                          {todos.length > 0 ? (
                            <div className="space-y-1">
                              {todos.map((todo) => (
                                <div
                                  key={todo.id}
                                  className={`group flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-slate-50 ${
                                    todo.completed ? 'bg-slate-50/50' : ''
                                  }`}
                                >
                                  <button
                                    onClick={() => handleToggleTodo(todo.id)}
                                    className={`flex-shrink-0 transition-colors ${
                                      todo.completed ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'
                                    }`}
                                  >
                                    {todo.completed ? (
                                      <CheckCircle size={20} className="fill-green-50" />
                                    ) : (
                                      <Circle size={20} />
                                    )}
                                  </button>
                                  
                                  <span
                                    className={`flex-1 text-sm transition-all ${
                                      todo.completed ? 'text-slate-400 line-through' : 'text-slate-700'
                                    }`}
                                  >
                                    {todo.text}
                                  </span>

                                  <button
                                    onClick={() => handleTodoDelete(todo.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} className="text-slate-200" />
                              </div>
                              <p className="text-sm font-medium text-slate-500">할 일이 없습니다.</p>
                              <p className="text-xs mt-1">새로운 할 일을 추가하여 하루를 계획하세요.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {currentMainTab === 'note' && (
                    <section>
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100/50 h-full">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-amber-800 font-bold text-sm">Workspace Note</h3>
                          <div className="flex items-center gap-2">
                            {editingNote ? (
                              <>
                                <button
                                  onClick={handleSaveNote}
                                  className="text-xs text-amber-800 hover:text-amber-900 px-2 py-1 rounded hover:bg-amber-100"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={() => {
                                    setNoteContent(note);
                                    setEditingNote(false);
                                  }}
                                  className="text-xs text-amber-600 hover:text-amber-700 px-2 py-1 rounded hover:bg-amber-100"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setEditingNote(true)}
                                className="text-amber-600 hover:text-amber-700"
                              >
                                <PenTool size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        {editingNote ? (
                          <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            className="w-full p-2 text-xs text-amber-900/70 bg-amber-50 border border-amber-200 rounded focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none min-h-[200px]"
                            rows={10}
                            placeholder="워크스페이스 메모를 입력하세요..."
                          />
                        ) : (
                          <p className="text-xs text-amber-900/70 leading-relaxed whitespace-pre-wrap min-h-[200px]">
                            {note || '워크스페이스 메모를 추가하세요.'}
                          </p>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </div>

              {/* Right Column: Resources - Spans 1 column */}
              <div className="lg:col-span-1 border-l border-slate-100 pl-8 lg:block">
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                      <Star size={16} />
                      Resources
                    </h2>
                    <button
                      onClick={handleAddResource}
                      className="text-xs text-slate-400 hover:text-indigo-600 hover:underline"
                    >
                      + 추가
                    </button>
                  </div>

                  <div 
                    className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 min-h-[200px]"
                    onDragOver={handleDragOver}
                    onDrop={handleDropOnResourceSection}
                  >
                    {resources.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {resources.map((res) => (
                          <ResourceItem
                            key={res.id}
                            resource={res}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, { ...res, workspaceId: activeWorkspaceId }, 'resource')}
                            onClick={() => {
                              if (res.url) {
                                chrome.tabs.create({ url: res.url });
                              }
                            }}
                            onDelete={handleDeleteResource}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-slate-400 mb-2">자주 방문하는 사이트</p>
                        <button
                          onClick={handleAddResource}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-md"
                        >
                          + 리소스 추가
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}