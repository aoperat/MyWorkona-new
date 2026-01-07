import {
  getActiveWorkspaceId,
  addTabToWorkspace,
  removeTabFromWorkspaceByUrl,
  extractDomain,
  getWorkspaceSwitchingState,
} from '../utils/backgroundHelpers.js';

import {
  moveTabToIndex,
  pinTabToFirstPinned,
} from '../utils/tabs.js';

import { migrateToLocal } from '../utils/storage.js';

const UNSAVED_WORKSPACE_ID = 'unsaved';

// 디바운스 타이머 저장소
const debounceTimers = {};

/**
 * 디바운스 함수
 * @param {Function} func - 실행할 함수
 * @param {number} delay - 지연 시간 (ms)
 * @param {string} key - 디바운스 키 (탭 ID 등)
 */
function debounce(func, delay, key) {
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key]);
  }
  debounceTimers[key] = setTimeout(() => {
    delete debounceTimers[key];
    func();
  }, delay);
}

/**
 * 워크스페이스를 현재 열려있는 탭과 동기화 (닫힌 탭 제거)
 * @param {string} workspaceId - 워크스페이스 ID
 * @returns {Promise<void>}
 */
async function syncWorkspaceWithCurrentTabs(workspaceId) {
  try {
    // 현재 열려있는 탭 가져오기 (고정된 탭 제외)
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    const pinnedTabs = await chrome.tabs.query({ pinned: true, currentWindow: true });
    const pinnedTabIds = new Set(pinnedTabs.map(tab => tab.id));
    const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
    
    // 현재 열려있는 탭의 URL 목록 (고정된 탭 및 MyWorkona 탭 제외)
    const openTabUrls = new Set(
      currentTabs
        .filter(tab => 
          tab.url && 
          !tab.url.startsWith('chrome://') && 
          !tab.url.startsWith('chrome-extension://') &&
          tab.url !== myWorkonaUrl &&
          !pinnedTabIds.has(tab.id)
        )
        .map(tab => tab.url)
    );
    
    // 워크스페이스의 저장된 탭 가져오기
    // Local Storage 사용 (Utils의 getStorage는 Local을 사용함)
    const savedTabs = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['savedTabs'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          const allTabs = result.savedTabs || {};
          resolve(allTabs[workspaceId] || []);
        }
      });
    });
    
    // 워크스페이스에 있지만 현재 열려있지 않은 탭 제거
    const tabsToKeep = savedTabs.filter(savedTab => {
      // URL이 있고, 현재 열려있는 탭 목록에 있으면 유지
      return savedTab.url && openTabUrls.has(savedTab.url);
    });
    
    // 변경사항이 있으면 저장
    if (tabsToKeep.length !== savedTabs.length) {
      await new Promise((resolve, reject) => {
        // navigator.locks는 Service Worker에서도 사용 가능하지만,
        // 여기서는 간단하게 storage.local.get -> set 패턴 사용
        // (storage.js의 setStorage를 import해서 쓰면 더 좋지만 순환 참조 주의)
        chrome.storage.local.get(['savedTabs'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          const allTabs = result.savedTabs || {};
          allTabs[workspaceId] = tabsToKeep;
          
          chrome.storage.local.set({ savedTabs: allTabs }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      });
    }
  } catch (error) {
    console.error('워크스페이스 동기화 실패:', error);
  }
}

// 확장 프로그램 설치/업데이트 시
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('MyWorkona 확장 프로그램이 설치되었습니다.');
  } else if (details.reason === 'update') {
    console.log('MyWorkona 확장 프로그램이 업데이트되었습니다.');
  }
  
  // 데이터 마이그레이션 (Sync -> Local)
  try {
    await migrateToLocal();
  } catch (error) {
    console.error('Migration failed:', error);
  }
});

// 탭이 생성될 때 (새 탭 열기)
chrome.tabs.onCreated.addListener(async (tab) => {
  // 워크스페이스 전환 중인지 확인
  const isSwitching = await getWorkspaceSwitchingState();
  if (isSwitching) return;

  // MyWorkona 탭인 경우 고정하고 첫 번째 위치로 이동
  if (tab.url && tab.url.startsWith('chrome-extension://')) {
    const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
    if (tab.url === myWorkonaUrl && tab.id) {
      try {
        await pinTabToFirstPinned(tab.id);
      } catch (error) {
        console.error('MyWorkona 탭 위치 조정 실패:', error);
      }
      return;
    }
  }
  
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // 디바운스 적용: 500ms 딜레이
  debounce(async () => {
    try {
      const activeWorkspaceId = await getActiveWorkspaceId();
      if (!activeWorkspaceId || activeWorkspaceId === UNSAVED_WORKSPACE_ID) {
        return;
      }
      
      // 탭 상태 다시 확인 (닫혔을 수도 있음)
      try {
        const currentTab = await chrome.tabs.get(tab.id);
        if (!currentTab) return;
      } catch {
        return; // 탭이 존재하지 않음
      }
      
      const tabData = {
        title: tab.title || 'Untitled',
        url: tab.url,
        domain: extractDomain(tab.url),
        favicon: tab.favIconUrl || '',
        savedAt: Date.now(),
      };
      
      await addTabToWorkspace(activeWorkspaceId, tabData);
      await syncWorkspaceWithCurrentTabs(activeWorkspaceId);
    } catch (error) {
      console.error('탭 자동 추가 실패:', error);
    }
  }, 500, `create-${tab.id}`);
});

// 탭이 업데이트될 때 (URL 변경, 로딩 완료 등)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const isSwitching = await getWorkspaceSwitchingState();
  if (isSwitching) return;

  if (tab.url && tab.url.startsWith('chrome-extension://')) {
    const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
    if (tab.url === myWorkonaUrl && tab.id) {
      try {
        await pinTabToFirstPinned(tab.id);
      } catch (error) {
        console.error('MyWorkona 탭 위치 조정 실패:', error);
      }
      return;
    }
  }
  
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    // 디바운스 적용: 500ms
    debounce(async () => {
      try {
        const activeWorkspaceId = await getActiveWorkspaceId();
        if (!activeWorkspaceId || activeWorkspaceId === UNSAVED_WORKSPACE_ID) {
          return;
        }
        
        // 탭 상태 확인
        try {
          const currentTab = await chrome.tabs.get(tabId);
          if (!currentTab) return;
        } catch {
          return;
        }
        
        // 이전 URL 제거 로직은 복잡성을 줄이기 위해 생략하거나
        // syncWorkspaceWithCurrentTabs가 처리하도록 맡김
        
        const tabData = {
          title: tab.title || 'Untitled',
          url: tab.url,
          domain: extractDomain(tab.url),
          favicon: tab.favIconUrl || '',
          savedAt: Date.now(),
        };
        
        await addTabToWorkspace(activeWorkspaceId, tabData);
        await syncWorkspaceWithCurrentTabs(activeWorkspaceId);
      } catch (error) {
        console.error('탭 업데이트 처리 실패:', error);
      }
    }, 500, `update-${tabId}`);
  }
});

// 탭이 닫힐 때
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // 디바운스 적용: 500ms (여러 탭이 동시에 닫힐 때 유용)
  // 키를 'global-remove'로 사용하여 여러 삭제 이벤트를 하나로 묶음
  debounce(async () => {
    try {
      const isSwitching = await getWorkspaceSwitchingState();
      if (isSwitching) return;

      const activeWorkspaceId = await getActiveWorkspaceId();
      if (!activeWorkspaceId || activeWorkspaceId === UNSAVED_WORKSPACE_ID) {
        return;
      }
      
      // syncWorkspaceWithCurrentTabs가 현재 열려있는 탭을 기준으로
      // 저장된 탭을 정리하므로, 닫힌 탭을 개별적으로 처리할 필요 없이
      // 동기화 함수만 호출하면 됨.
      await syncWorkspaceWithCurrentTabs(activeWorkspaceId);
    } catch (error) {
      console.error('탭 제거 처리 실패:', error);
    }
  }, 500, 'global-remove');
});

// 확장 프로그램 아이콘 클릭 시 새 탭 열기 또는 기존 탭 활성화
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
    const tabs = await chrome.tabs.query({ url: myWorkonaUrl });
    const currentWindow = await chrome.windows.getCurrent();
    const existingTab = tabs.find(t => t.windowId === currentWindow.id);
    
    if (existingTab) {
      await chrome.tabs.update(existingTab.id, { active: true });
      await chrome.windows.update(currentWindow.id, { focused: true });
      try {
        await pinTabToFirstPinned(existingTab.id);
      } catch (error) {
        console.error('MyWorkona 탭 위치 조정 실패:', error);
      }
    } else {
      const newTab = await chrome.tabs.create({ url: myWorkonaUrl, pinned: true });
      try {
        await pinTabToFirstPinned(newTab.id);
      } catch (error) {
        console.error('MyWorkona 탭 위치 조정 실패:', error);
      }
    }
  } catch (error) {
    console.error('MyWorkona 탭 활성화/생성 실패:', error);
    try {
      const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
      const newTab = await chrome.tabs.create({ url: myWorkonaUrl, pinned: true });
      await pinTabToFirstPinned(newTab.id);
    } catch (createError) {
      console.error('새 탭 생성 실패:', createError);
    }
  }
});
