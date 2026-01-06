import React, { useState } from 'react';
import { 
  Layout, 
  Plus, 
  Search, 
  Settings, 
  MoreHorizontal, 
  X, 
  ExternalLink,
  Briefcase,
  Code,
  PenTool,
  Globe,
  Star,
  Clock,
  ChevronLeft,
  Menu,
  CheckCircle2,
  Trash2
} from 'lucide-react';

// --- Mock Data ---

const initialWorkspaces = [
  { id: 'ws-1', name: '개발 프로젝트 A', icon: <Code size={18} />, color: 'bg-blue-500', tabCount: 12 },
  { id: 'ws-2', name: '마케팅 리서치', icon: <Globe size={18} />, color: 'bg-pink-500', tabCount: 8 },
  { id: 'ws-3', name: '디자인 레퍼런스', icon: <PenTool size={18} />, color: 'bg-purple-500', tabCount: 25 },
  { id: 'ws-4', name: '개인 업무', icon: <Briefcase size={18} />, color: 'bg-emerald-500', tabCount: 4 },
];

const mockTabs = {
  'ws-1': [
    { id: 't-1', title: 'GitHub - Project Repo', url: 'github.com/org/project', domain: 'github.com', active: true },
    { id: 't-2', title: 'AWS Console', url: 'aws.amazon.com/console', domain: 'aws.amazon.com', active: false },
    { id: 't-3', title: 'React Documentation', url: 'react.dev', domain: 'react.dev', active: false },
    { id: 't-4', title: 'Stack Overflow - Error Fix', url: 'stackoverflow.com/questions/...', domain: 'stackoverflow.com', active: false },
    { id: 't-5', title: 'Jira Dashboard', url: 'company.atlassian.net', domain: 'atlassian.net', active: false },
  ],
  'ws-2': [
    { id: 't-6', title: 'Competitor Analysis Sheet', url: 'docs.google.com/spreadsheets', domain: 'google.com', active: true },
    { id: 't-7', title: 'Naver Trends', url: 'datalab.naver.com', domain: 'naver.com', active: false },
  ],
  'ws-3': [
    { id: 't-8', title: 'Dribbble - UI Inspiration', url: 'dribbble.com', domain: 'dribbble.com', active: false },
    { id: 't-9', title: 'Pinterest Moodboard', url: 'pinterest.com', domain: 'pinterest.com', active: true },
    { id: 't-10', title: 'Figma Design System', url: 'figma.com/files/...', domain: 'figma.com', active: false },
  ],
  'ws-4': [
    { id: 't-11', title: 'Gmail', url: 'mail.google.com', domain: 'google.com', active: true },
  ]
};

const savedResources = {
  'ws-1': [
    { id: 'r-1', title: 'API Specification (Swagger)', type: 'link' },
    { id: 'r-2', title: 'DB Schema Diagram', type: 'image' },
  ],
  'ws-2': [],
  'ws-3': [
    { id: 'r-3', title: 'Brand Guidelines PDF', type: 'file' },
  ],
  'ws-4': []
};

// --- Components ---

const SidebarItem = ({ workspace, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group
      ${isActive 
        ? 'bg-white shadow-sm text-slate-800 ring-1 ring-slate-200' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
  >
    <div className={`w-2 h-2 rounded-full ${workspace.color}`} />
    <span className="flex-1 text-left truncate font-medium">{workspace.name}</span>
    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
  </button>
);

const TabCard = ({ tab, onDelete }) => (
  <div className="group relative flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200 cursor-pointer">
    {/* Favicon Placeholder */}
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 font-bold text-xs
      ${tab.active ? 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-100' : 'bg-slate-50'}`}>
      {tab.domain[0].toUpperCase()}
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

    <button 
      onClick={(e) => { e.stopPropagation(); onDelete(tab.id); }}
      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
    >
      <X size={14} />
    </button>
  </div>
);

const ResourceItem = ({ resource }) => (
  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-600 hover:text-slate-900 transition-colors">
    <div className="p-1.5 bg-slate-100 rounded-md">
      <Star size={14} className="text-amber-400 fill-amber-400" />
    </div>
    <span className="text-sm font-medium truncate">{resource.title}</span>
    <ExternalLink size={12} className="opacity-0 hover:opacity-100 ml-auto" />
  </div>
);

export default function FocusFlowApp() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('ws-1');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [tabs, setTabs] = useState(mockTabs);
  
  const activeWorkspace = initialWorkspaces.find(w => w.id === activeWorkspaceId);
  const currentTabs = tabs[activeWorkspaceId] || [];
  const currentResources = savedResources[activeWorkspaceId] || [];

  const handleDeleteTab = (tabId) => {
    setTabs(prev => ({
      ...prev,
      [activeWorkspaceId]: prev[activeWorkspaceId].filter(t => t.id !== tabId)
    }));
  };

  const handleAddTab = () => {
    const newTab = {
      id: `t-${Date.now()}`,
      title: 'New Tab',
      url: 'google.com',
      domain: 'google.com',
      active: false
    };
    setTabs(prev => ({
      ...prev,
      [activeWorkspaceId]: [...prev[activeWorkspaceId], newTab]
    }));
  };

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
            FocusFlow
          </div>
        </div>

        {/* Workspace List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 mb-1">
            My Workspaces
          </div>
          {initialWorkspaces.map(ws => (
            <SidebarItem 
              key={ws.id} 
              workspace={ws} 
              isActive={activeWorkspaceId === ws.id}
              onClick={() => setActiveWorkspaceId(ws.id)}
            />
          ))}

          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg mt-2 transition-colors border border-dashed border-slate-300 hover:border-slate-400">
            <Plus size={16} />
            <span>새 워크스페이스</span>
          </button>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200/60">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-white shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
              U
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-700">User Name</div>
              <div className="text-[10px] text-slate-400">Pro Plan</div>
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
            
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeWorkspace?.color}`}></span>
              <h1 className="text-lg font-bold text-slate-800">{activeWorkspace?.name}</h1>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-xs font-medium">
                {currentTabs.length} tabs
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" />
              <input 
                type="text" 
                placeholder="탭 검색 또는 URL 입력..." 
                className="pl-9 pr-4 py-1.5 w-64 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
              />
            </div>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm shadow-indigo-200">
              <Plus size={16} />
              <span className="hidden sm:inline">탭 추가</span>
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-5xl mx-auto space-y-10">

            {/* Section: Open Tabs */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                  <Layout size={16} />
                  Current Tabs (현재 열린 탭)
                </h2>
                <div className="flex gap-2">
                   <button className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 transition-colors">
                    <CheckCircle2 size={12} /> 모두 저장
                   </button>
                   <button className="text-xs text-slate-400 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                    <Trash2 size={12} /> 정리하기
                   </button>
                </div>
              </div>

              {currentTabs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentTabs.map(tab => (
                    <TabCard key={tab.id} tab={tab} onDelete={handleDeleteTab} />
                  ))}
                  <button 
                    onClick={handleAddTab}
                    className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-slate-400 hover:text-indigo-500 group h-[74px]"
                  >
                    <Plus size={20} className="group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              ) : (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-3 text-slate-300">
                    <Layout size={24} />
                  </div>
                  <p className="text-slate-500 font-medium">열려있는 탭이 없습니다.</p>
                  <p className="text-sm text-slate-400 mt-1">새 탭을 추가하여 작업을 시작하세요.</p>
                </div>
              )}
            </section>

            {/* Section: Saved Resources */}
            <section className="pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                  <Star size={16} />
                  Saved Resources (저장된 리소스)
                </h2>
                <button className="text-xs text-slate-400 hover:text-indigo-600 hover:underline">
                  Edit List
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60">
                {currentResources.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {currentResources.map(res => (
                      <ResourceItem key={res.id} resource={res} />
                    ))}
                    <div className="flex items-center gap-3 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer transition-colors border border-dashed border-transparent hover:border-indigo-200">
                      <div className="p-1.5 rounded-md">
                        <Plus size={14} />
                      </div>
                      <span className="text-sm font-medium">리소스 추가하기</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-400">자주 방문하는 사이트를 여기에 고정하세요.</p>
                    <button className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-md">
                      + 리소스 추가
                    </button>
                  </div>
                )}
              </div>
            </section>

             {/* Section: Activity / Memo (Optional) */}
             <section className="pt-6 border-t border-slate-100">
                <div className="flex items-start gap-6">
                    <div className="flex-1">
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2 mb-3">
                            <Clock size={16} />
                            Recent Activity
                        </h2>
                        <div className="text-sm text-slate-600 space-y-2 pl-1">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
                                <span className="text-slate-400 text-xs">10m ago</span>
                                <span>'GitHub - Project Repo' closed</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                                <span className="text-slate-400 text-xs">1h ago</span>
                                <span>Saved 'DB Schema Diagram' to resources</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="w-1/3 bg-amber-50 rounded-xl p-4 border border-amber-100/50">
                        <div className="flex items-center justify-between mb-2">
                             <h3 className="text-amber-800 font-bold text-sm">Workspace Note</h3>
                             <PenTool size={12} className="text-amber-600" />
                        </div>
                        <p className="text-xs text-amber-900/70 leading-relaxed">
                            이 프로젝트 마감일은 다음주 금요일입니다. AWS 계정 권한 요청해두기.
                        </p>
                    </div>
                </div>
             </section>

          </div>
        </div>
      </main>
    </div>
  );
}