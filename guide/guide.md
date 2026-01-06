기술 설계서: 브라우저 워크스페이스 매니저 (Workona Re-implementation)1. 개요 (Overview)본 문서는 Chrome Extension Manifest V3 환경에서 Workona와 유사한 '워크스페이스 기반 탭 관리 시스템'을 구현하기 위한 기술 명세서입니다.핵심 목표Context Switching: 사용자가 프로젝트(워크스페이스) 간 전환 시 현재 탭 상태를 저장하고, 대상 워크스페이스의 탭을 즉시 복원한다.Persistence: 브라우저가 종료되거나 충돌해도 탭 상태(URL, 제목, 파비콘 등)가 유실되지 않도록 IndexedDB에 영구 저장한다.Memory Efficiency: 사용하지 않는 탭은 메모리에서 해제(Suspend/Discard)하여 시스템 리소스를 확보한다.Sync: 여러 기기 간 워크스페이스 상태를 동기화한다.2. 시스템 아키텍처 (System Architecture)Manifest V3의 제약 사항(Service Worker의 수명 주기, DOM 접근 불가)을 고려한 아키텍처입니다.2.1 구성 요소Service Worker (Background): 탭 이벤트(onUpdated, onRemoved 등)를 감지하고 DB를 갱신하는 중앙 컨트롤러.IndexedDB (Storage): 대용량 탭 데이터와 메타데이터를 저장하는 로컬 DB. (Chrome storage.local은 용량 제한 및 성능 문제로 비적합)UI Layer (React/Vue): 팝업 또는 사이드바(Side Panel API 권장)에서 워크스페이스 목록을 보여주고 제어.Content Script: 파비콘 추출, 페이지 메타데이터 수집, 단축키 이벤트 리스너.2.2 데이터 스키마 (JSON Schema)Workona의 로직을 역설계하여 도출한 최적화된 스키마입니다.Workspace ObjectTypeScriptinterface Workspace {
  id: string;              // UUID v4
  title: string;
  createdAt: number;
  lastActiveAt: number;
  tabs: TabState;        // 현재 워크스페이스에 속한 탭 목록
  resources: Resource;   // 영구 저장된 리소스 (북마크 개념)
}
TabState Object (Serialized Tab)브라우저의 chrome.tabs.Tab 객체를 경량화하여 저장합니다.TypeScriptinterface TabState {
  id?: number;             // 현재 열려있다면 탭 ID (없으면 null)
  url: string;
  title: string;
  favIconUrl: string;      // Base64 Data URI 권장 (오프라인 렌더링용)
  pinned: boolean;
  active: boolean;         // 마지막 활성 탭 여부
  discarded: boolean;      // 메모리 해제 상태 여부
  groupId?: number;        // Tab Group ID
}
3. 핵심 알고리즘 및 로직 상세 (Core Logic)가장 구현 난이도가 높은 워크스페이스 전환(Switching) 로직입니다.3.1 워크스페이스 전환: "Safety Transition" 패턴단순히 모든 탭을 닫고 새로 열면, 브라우저 윈도우가 닫혀버리거나(Last tab closed), 브라우저가 종료될 수 있습니다. 이를 방지하는 안전장치가 필수입니다.단계별 프로세스:Snapshot (저장):현재 활성 윈도우의 모든 탭을 chrome.tabs.query로 가져옵니다.현재 워크스페이스 ID를 확인하고, 변경된 탭 정보를 IndexedDB에 put 합니다.Tip: chrome.tabs.onUpdated 이벤트를 통해 실시간 저장을 병행하지만, 전환 직전에는 반드시 강제 스냅샷을 한 번 더 수행해야 데이터 유실을 막습니다.Transition Tab 생성 (핵심):chrome.tabs.create({ url: 'transition.html', active: true })를 호출합니다.이 탭은 "워크스페이스 전환 중..."이라는 로딩 화면을 보여주며, 윈도우가 닫히지 않도록 지탱하는 역할을 합니다.Clean-up (기존 탭 제거):방금 생성한 Transition Tab을 제외한 모든 탭의 ID를 수집합니다.chrome.tabs.remove(tabIds)를 호출하여 일괄 삭제합니다.Restore (새 탭 복원):대상 워크스페이스의 TabState를 로드합니다.Lazy Loading 적용:active: true인 탭 1개만 즉시 로드합니다.나머지 탭들은 active: false로 생성하되, 가능하다면 chrome.tabs.create 후 즉시 chrome.tabs.discard를 호출하거나, 애초에 로드되지 않은 상태(Native Discarded)로 생성해야 합니다.Performance Tip: 탭이 20개 이상일 경우, 3~5개씩 끊어서 생성(Promise 청크 처리)해야 브라우저 UI가 멈추지 않습니다.Finish:새 탭들이 생성 완료되면 Transition Tab을 닫습니다.3.2 탭 서스펜션 (Memory Management)Workona의 "Suspended" 상태를 구현하는 두 가지 방법입니다.방법 A: Native Discarding (권장)chrome.tabs.discard(tabId) API 사용.장점: 탭이 닫히지 않고 DOM만 메모리에서 내려감. 탭 클릭 시 자동 리로드됨.단점: 파비콘이 회색으로 변하거나 희미해질 수 있음(브라우저별 상이).방법 B: Custom URL Replacement (Workona Legacy 방식)탭 URL을 chrome-extension://<id>/suspended.html?url=<original_url>로 변경.장점: 메모리 사용량 0에 수렴. UI 커스터마이징 가능.단점: 확장 삭제 시 탭 복구 불가능 (치명적). 히스토리 오염.결론: 최신 브라우저에서는 **방법 A (Native Discarding)**을 사용하는 것이 안정성과 UX 측면에서 월등합니다.3.3 동기화 충돌 해결 (Conflict Resolution)여러 기기에서 동시에 탭을 수정할 때 발생하는 문제를 해결합니다.전략: Last Write Wins (LWW) + Active Protection서버(또는 Sync Storage)에서 변경 사항이 감지됨.현재 사용자가 보고 있는(Active) 워크스페이스라면?자동으로 덮어쓰지 않음. (사용자가 작업 중인 탭이 사라지면 안 됨)UI에 "업데이트가 있습니다. 새로고침 하시겠습니까?" 토스트 메시지 노출.비활성(Background) 워크스페이스라면?조용히 로컬 DB를 서버 데이터로 덮어씌움.4. Manifest V3 마이그레이션 체크리스트4.1 Persistent Background 제거 대응V3의 Service Worker는 유휴 상태일 때 종료됩니다. 따라서 전역 변수(Global Variable)에 상태를 저장하면 안 됩니다.❌ let currentWorkspaceId = '...'; (사용 금지)✅ chrome.storage.session.set({ currentWorkspaceId: '...' }); (사용 권장)상태가 필요할 때마다 storage에서 비동기로 불러와야 합니다.4.2 API 권한 (Permissions)manifest.json 필수 권한:JSON{
  "manifest_version": 3,
  "permissions":,
  "host_permissions":,
  "background": {
    "service_worker": "background.js"
  }
}
5. 구현 로드맵 (Implementation Roadmap)Phase 1: Core (MVP)DB Layer: Dexie.js(IndexedDB Wrapper) 설정 및 스키마 정의.Tracker: tabs.onUpdated, tabs.onRemoved 리스너 구현 -> DB와 단방향 동기화.Switcher: Transition Tab을 이용한 워크스페이스 전환 로직 구현 (Local Only).UI: 팝업 창에서 워크스페이스 생성/전환/삭제 기능.Phase 2: OptimizationSuspender: 워크스페이스 복원 시 discarded: true 상태로 탭 생성 로직 추가.Favicon Cache: chrome://favicon 권한을 이용해 아이콘 캐싱 (오프라인 대응).Drag & Drop: React dnd-kit 등을 사용하여 탭 순서 변경 및 워크스페이스 간 이동 UI 구현.Phase 3: Sync & AdvancedRemote Sync: Firebase 또는 Supabase 연동하여 기기 간 데이터 동기화.Multi-Window: 윈도우별 워크스페이스 바인딩 로직 추가 (windowId <-> workspaceId 매핑 테이블 관리).Fail-safe: 확장 프로그램 삭제/비활성화 시 모든 Suspended 탭을 원본 URL로 자동 복구하는 runtime.setUninstallURL 설정.