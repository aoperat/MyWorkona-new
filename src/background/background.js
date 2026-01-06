/**
 * 백그라운드 스크립트
 * 확장 프로그램의 백그라운드에서 실행되는 서비스 워커
 * 
 * Vite가 빌드 시 모든 의존성을 번들링하므로 정적 import를 사용합니다.
 */

// 정적 import 사용 (빌드 시 번들링됨)
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

const UNSAVED_WORKSPACE_ID = 'unsaved';

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
    const savedTabs = await new Promise((resolve, reject) => {
      chrome.storage.sync.get(['savedTabs'], (result) => {
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
        chrome.storage.sync.get(['savedTabs'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          const allTabs = result.savedTabs || {};
          allTabs[workspaceId] = tabsToKeep;
          
          chrome.storage.sync.set({ savedTabs: allTabs }, () => {
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

// 확장 프로그램 설치 시
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('MyWorkona 확장 프로그램이 설치되었습니다.');
  } else if (details.reason === 'update') {
    console.log('MyWorkona 확장 프로그램이 업데이트되었습니다.');
  }
});

// 탭이 생성될 때 (새 탭 열기)
chrome.tabs.onCreated.addListener(async (tab) => {
  // 워크스페이스 전환 중인지 확인
  const isSwitching = await getWorkspaceSwitchingState();
  if (isSwitching) {
    return; // 전환 중이면 무시
  }

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
  
  // chrome://, chrome-extension:// 등 내부 페이지는 제외
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }
  
  try {
    // 현재 활성 워크스페이스 가져오기
    const activeWorkspaceId = await getActiveWorkspaceId();
    if (!activeWorkspaceId || activeWorkspaceId === UNSAVED_WORKSPACE_ID) {
      return; // 활성 워크스페이스가 없거나 Unsaved 워크스페이스이면 스킵
    }
    
    // 탭이 완전히 로드될 때까지 대기
    if (tab.status === 'loading') {
      // onUpdated에서 처리
      return;
    }
    
    // 워크스페이스에 탭 추가
    const tabData = {
      title: tab.title || 'Untitled',
      url: tab.url,
      domain: extractDomain(tab.url),
      favicon: tab.favIconUrl || '',
      savedAt: Date.now(),
    };
    
      await addTabToWorkspace(activeWorkspaceId, tabData);
      
      // 현재 열려있는 탭과 워크스페이스 동기화 (닫힌 탭 제거)
      await syncWorkspaceWithCurrentTabs(activeWorkspaceId);
      
      // 일반 탭은 고정하지 않음 (MyWorkona 탭만 고정되어 첫 번째 위치 유지)
  } catch (error) {
    console.error('탭 자동 추가 실패:', error);
  }
});

// 탭이 업데이트될 때 (URL 변경, 로딩 완료 등)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 워크스페이스 전환 중인지 확인
  const isSwitching = await getWorkspaceSwitchingState();
  if (isSwitching) {
    return; // 전환 중이면 무시
  }

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
  
  // 탭이 로딩 완료되고 URL이 있을 때만 처리
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    try {
      // 현재 활성 워크스페이스 가져오기
      const activeWorkspaceId = await getActiveWorkspaceId();
      if (!activeWorkspaceId || activeWorkspaceId === UNSAVED_WORKSPACE_ID) {
        return;
      }
      
      // URL이 변경된 경우, 이전 URL을 워크스페이스에서 제거
      if (changeInfo.url && changeInfo.url !== tab.url) {
        // 이전 URL 제거
        await removeTabFromWorkspaceByUrl(activeWorkspaceId, changeInfo.url);
      }
      
      // 워크스페이스에 탭 추가/업데이트 (addTabToWorkspace가 중복 체크를 함)
      const tabData = {
        title: tab.title || 'Untitled',
        url: tab.url,
        domain: extractDomain(tab.url),
        favicon: tab.favIconUrl || '',
        savedAt: Date.now(),
      };
      
      await addTabToWorkspace(activeWorkspaceId, tabData);
      
      // 현재 열려있는 탭과 워크스페이스 동기화 (닫힌 탭 제거)
      await syncWorkspaceWithCurrentTabs(activeWorkspaceId);
      
      // 일반 탭은 고정하지 않음 (MyWorkona 탭만 고정되어 첫 번째 위치 유지)
    } catch (error) {
      console.error('탭 업데이트 처리 실패:', error);
    }
  }
});

// 탭이 활성화될 때
chrome.tabs.onActivated.addListener((activeInfo) => {
  // 필요한 경우 여기에 로직 추가
});

// 탭이 닫힐 때
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    // 워크스페이스 전환 중인지 확인
    const isSwitching = await getWorkspaceSwitchingState();
    if (isSwitching) {
      return; // 전환 중이면 무시
    }

    // 닫힌 탭의 정보를 가져오기 위해 탭 정보 저장소 확인
    // onRemoved에서는 탭 정보를 받을 수 없으므로, 
    // 현재 활성 워크스페이스의 모든 탭을 확인하고
    // 현재 열려있는 탭과 비교하여 없는 탭을 제거
    
    const activeWorkspaceId = await getActiveWorkspaceId();
    if (!activeWorkspaceId || activeWorkspaceId === UNSAVED_WORKSPACE_ID) {
      return; // Unsaved 워크스페이스는 스킵
    }
    
    // 현재 열려있는 탭 가져오기 (고정된 탭 제외)
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    const pinnedTabs = await chrome.tabs.query({ pinned: true, currentWindow: true });
    const pinnedTabIds = new Set(pinnedTabs.map(tab => tab.id));
    
    // 현재 열려있는 탭의 URL 목록 (고정된 탭 제외)
    const openTabUrls = new Set(
      currentTabs
        .filter(tab => 
          tab.url && 
          !tab.url.startsWith('chrome://') && 
          !tab.url.startsWith('chrome-extension://') &&
          !pinnedTabIds.has(tab.id)
        )
        .map(tab => tab.url)
    );
    
    // 워크스페이스의 저장된 탭 가져오기
    const savedTabs = await new Promise((resolve, reject) => {
      chrome.storage.sync.get(['savedTabs'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          const allTabs = result.savedTabs || {};
          resolve(allTabs[activeWorkspaceId] || []);
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
        chrome.storage.sync.get(['savedTabs'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          const allTabs = result.savedTabs || {};
          allTabs[activeWorkspaceId] = tabsToKeep;
          
          chrome.storage.sync.set({ savedTabs: allTabs }, () => {
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
    console.error('탭 제거 처리 실패:', error);
  }
});

// 확장 프로그램 아이콘 클릭 시 새 탭 열기 또는 기존 탭 활성화
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // MyWorkona 앱 URL
    const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
    
    // 현재 창에서 MyWorkona 탭 찾기
    const tabs = await chrome.tabs.query({ url: myWorkonaUrl });
    const currentWindow = await chrome.windows.getCurrent();
    const existingTab = tabs.find(t => t.windowId === currentWindow.id);
    
    if (existingTab) {
      // 기존 탭 활성화 및 고정
      await chrome.tabs.update(existingTab.id, { active: true });
      // 창도 활성화 (필요한 경우)
      await chrome.windows.update(currentWindow.id, { focused: true });
      
      // MyWorkona 탭을 고정하고 첫 번째 위치로 이동
      try {
        await pinTabToFirstPinned(existingTab.id);
      } catch (error) {
        console.error('MyWorkona 탭 위치 조정 실패:', error);
      }
    } else {
      // 새 탭 생성 (고정된 탭으로)
      const newTab = await chrome.tabs.create({ url: myWorkonaUrl, pinned: true });
      
      // 생성된 탭을 고정된 탭 중 첫 번째 위치로 이동
      try {
        await pinTabToFirstPinned(newTab.id);
      } catch (error) {
        console.error('MyWorkona 탭 위치 조정 실패:', error);
      }
    }
  } catch (error) {
    console.error('MyWorkona 탭 활성화/생성 실패:', error);
    // 에러 발생 시 기본 동작 (새 탭 생성 및 고정)
    try {
      const myWorkonaUrl = chrome.runtime.getURL('newtab/index.html');
      const newTab = await chrome.tabs.create({ url: myWorkonaUrl, pinned: true });
      await pinTabToFirstPinned(newTab.id);
    } catch (createError) {
      console.error('새 탭 생성 실패:', createError);
    }
  }
});
