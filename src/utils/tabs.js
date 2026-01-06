/**
 * Chrome Tabs API 래퍼 함수들
 */

/**
 * 현재 창의 모든 탭 가져오기
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
export async function getCurrentWindowTabs() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(tabs);
      }
    });
  });
}

/**
 * 모든 창의 모든 탭 가져오기
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
export async function getAllTabs() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(tabs);
      }
    });
  });
}

/**
 * 탭 열기
 * @param {string} url - 열 탭의 URL
 * @param {boolean} active - 활성 탭으로 열지 여부
 * @returns {Promise<chrome.tabs.Tab>}
 */
export async function createTab(url, active = true) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(tab);
      }
    });
  });
}

/**
 * 여러 탭 일괄 열기
 * @param {string[]} urls - 열 탭들의 URL 배열
 * @param {boolean} active - 첫 번째 탭을 활성 탭으로 열지 여부
 * @param {boolean} pinFirst - 첫 번째 탭을 고정할지 여부
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
export async function createTabs(urls, active = true, pinFirst = false) {
  const tabs = [];
  for (let i = 0; i < urls.length; i++) {
    const tab = await createTab(urls[i], active && i === 0);
    tabs.push(tab);
    
    // 첫 번째 탭을 고정하고 첫 번째 위치로 이동
    if (pinFirst && i === 0 && tab.id) {
      try {
        await pinTabToFirst(tab.id);
      } catch (error) {
        console.error('탭 고정 실패:', error);
      }
    }
  }
  return tabs;
}

/**
 * 탭 닫기
 * @param {number|number[]} tabIds - 닫을 탭 ID 또는 ID 배열
 * @returns {Promise<void>}
 */
export async function closeTabs(tabIds) {
  return new Promise((resolve, reject) => {
    const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
    chrome.tabs.remove(ids, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 탭 활성화
 * @param {number} tabId - 활성화할 탭 ID
 * @returns {Promise<void>}
 */
export async function activateTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { active: true }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
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

/**
 * Chrome Tab 객체를 앱에서 사용하는 탭 형식으로 변환
 * @param {chrome.tabs.Tab} chromeTab - Chrome Tab 객체
 * @returns {Object}
 */
export function convertChromeTabToAppTab(chromeTab) {
  return {
    id: `tab-${chromeTab.id}`,
    chromeTabId: chromeTab.id,
    title: chromeTab.title || 'Untitled',
    url: chromeTab.url || '',
    domain: extractDomain(chromeTab.url || ''),
    favicon: chromeTab.favIconUrl || '',
    active: chromeTab.active || false,
    pinned: chromeTab.pinned || false,
  };
}

/**
 * 탭 고정
 * @param {number} tabId - 탭 ID
 * @param {boolean} pinned - 고정 여부
 * @returns {Promise<void>}
 */
export async function pinTab(tabId, pinned = true) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { pinned }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 탭을 첫 번째 위치로 이동 (고정 탭 다음)
 * @param {number} tabId - 탭 ID
 * @param {number} index - 위치 (0이면 첫 번째)
 * @returns {Promise<void>}
 */
export async function moveTabToIndex(tabId, index = 0) {
  return new Promise((resolve, reject) => {
    chrome.tabs.move(tabId, { index }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 탭을 고정하고 첫 번째 위치로 이동
 * @param {number} tabId - 탭 ID
 * @returns {Promise<void>}
 */
export async function pinTabToFirst(tabId) {
  try {
    // 먼저 고정
    await pinTab(tabId, true);
    // 그 다음 첫 번째 위치로 이동 (고정 탭은 자동으로 앞으로 이동하므로 index 0으로)
    await moveTabToIndex(tabId, 0);
  } catch (error) {
    console.error('탭 고정 실패:', error);
    throw error;
  }
}

/**
 * 고정된 탭 목록 가져오기
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
export async function getPinnedTabs() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ pinned: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(tabs);
      }
    });
  });
}

/**
 * 탭을 고정하고 고정된 탭 중 첫 번째 위치로 이동
 * @param {number} tabId - 탭 ID
 * @returns {Promise<void>}
 */
export async function pinTabToFirstPinned(tabId) {
  try {
    // 1. 먼저 탭을 고정합니다.
    await pinTab(tabId, true);
    
    // 2. 그 다음 0번 인덱스로 이동시킵니다.
    // 비동기 처리 문제나 경합 조건을 방지하기 위해 확인 후 재시도 로직 추가
    for (let i = 0; i < 3; i++) {
      await moveTabToIndex(tabId, 0);
      
      // 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 위치 확인
      const tab = await new Promise((resolve) => {
        chrome.tabs.get(tabId, (t) => resolve(t));
      });
      
      if (tab && tab.index === 0) {
        break;
      }
    }
  } catch (error) {
    console.error('탭 고정 및 위치 조정 실패:', error);
    // 에러가 발생해도 기능이 완전히 멈추지 않도록 무시하거나 로그만 남김
  }
}
