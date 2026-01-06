/**
 * Background 스크립트에서 사용할 헬퍼 함수들
 * Chrome Storage API를 직접 사용하여 워크스페이스에 탭 추가
 */

/**
 * 현재 활성 워크스페이스 ID 가져오기
 * @returns {Promise<string|null>}
 */
export async function getActiveWorkspaceId() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['activeWorkspaceId'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.activeWorkspaceId || null);
      }
    });
  });
}

/**
 * 워크스페이스 전환 상태 가져오기
 * @returns {Promise<boolean>}
 */
export async function getWorkspaceSwitchingState() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['isSwitchingWorkspace'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.isSwitchingWorkspace || false);
      }
    });
  });
}

/**
 * 워크스페이스에 탭 추가
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {Object} tab - 추가할 탭 객체
 * @returns {Promise<void>}
 */
export async function addTabToWorkspace(workspaceId, tab) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['savedTabs'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      const allTabs = result.savedTabs || {};
      const workspaceTabs = allTabs[workspaceId] || [];
      
      // URL 기준으로 중복 체크
      const existingTabIndex = workspaceTabs.findIndex(t => t.url === tab.url);
      
      if (existingTabIndex !== -1) {
        // 이미 존재하는 탭이면 업데이트 (최신 정보로)
        workspaceTabs[existingTabIndex] = {
          ...workspaceTabs[existingTabIndex],
          title: tab.title || workspaceTabs[existingTabIndex].title,
          domain: tab.domain || workspaceTabs[existingTabIndex].domain,
          favicon: tab.favicon || workspaceTabs[existingTabIndex].favicon,
          savedAt: tab.savedAt || workspaceTabs[existingTabIndex].savedAt,
        };
      } else {
        // 새 탭 추가
        const newTab = {
          id: tab.id || `saved-${Date.now()}-${Math.random()}`,
          title: tab.title || 'Untitled',
          url: tab.url || '',
          domain: tab.domain || '',
          favicon: tab.favicon || '',
          savedAt: tab.savedAt || Date.now(),
        };
        workspaceTabs.push(newTab);
      }
      
      allTabs[workspaceId] = workspaceTabs;
      
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

/**
 * 워크스페이스에서 탭 제거 (URL로 찾기)
 * @param {string} workspaceId - 워크스페이스 ID
 * @param {string} url - 제거할 탭의 URL
 * @returns {Promise<void>}
 */
export async function removeTabFromWorkspaceByUrl(workspaceId, url) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['savedTabs'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      const allTabs = result.savedTabs || {};
      const workspaceTabs = allTabs[workspaceId] || [];
      
      // URL로 탭 찾아서 제거
      const filteredTabs = workspaceTabs.filter(tab => tab.url !== url);
      allTabs[workspaceId] = filteredTabs;
      
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

/**
 * URL에서 도메인 추출
 * @param {string} url - URL
 * @returns {string}
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace('www.', '');
  } catch (e) {
    return url;
  }
}

