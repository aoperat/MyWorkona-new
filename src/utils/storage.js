/**
 * Chrome Storage API 래퍼 함수들
 * chrome.storage.sync를 사용하여 Google 계정으로 동기화
 */

/**
 * 동기화 상태 확인
 * @returns {Promise<{enabled: boolean, error?: string}>}
 */
export async function checkSyncStatus() {
  return new Promise((resolve) => {
    // chrome.storage.sync.getBytesInUse를 사용하여 동기화 가능 여부 확인
    chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
      if (chrome.runtime.lastError) {
        // 동기화가 비활성화되었거나 오류가 발생한 경우
        resolve({
          enabled: false,
          error: chrome.runtime.lastError.message || '동기화를 사용할 수 없습니다',
        });
      } else {
        // 동기화가 활성화된 경우
        resolve({
          enabled: true,
          bytesInUse: bytesInUse,
        });
      }
    });
  });
}

/**
 * 스토리지에서 데이터 가져오기
 * @param {string|string[]} keys - 가져올 키 또는 키 배열
 * @returns {Promise<any>}
 */
export async function getStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * 스토리지에 데이터 저장하기
 * @param {Object} items - 저장할 키-값 쌍 객체
 * @returns {Promise<void>}
 */
export async function setStorage(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 스토리지에서 데이터 제거하기
 * @param {string|string[]} keys - 제거할 키 또는 키 배열
 * @returns {Promise<void>}
 */
export async function removeStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 스토리지의 모든 데이터 가져오기
 * @returns {Promise<any>}
 */
export async function getAllStorage() {
  return getStorage(null);
}

/**
 * 스토리지 변경 이벤트 리스너 등록
 * @param {Function} callback - 변경 이벤트 발생 시 호출될 콜백 함수
 */
export function onStorageChanged(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      callback(changes);
    }
  });
}
