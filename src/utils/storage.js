/**
 * Chrome Storage API 래퍼 함수들
 * chrome.storage.local을 사용하여 용량 제한 문제 해결 (5MB+)
 * Web Locks API를 사용하여 동시성 문제(Race Condition) 해결
 */

const STORAGE_LOCK_NAME = 'myworkona_storage_lock';

/**
 * 데이터 마이그레이션 (Sync -> Local)
 * 앱 시작 시 한 번 실행하여 기존 데이터를 보존
 */
export async function migrateToLocal() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['migrated'], (localResult) => {
      if (localResult.migrated) {
        resolve();
        return;
      }

      chrome.storage.sync.get(null, (syncData) => {
        if (chrome.runtime.lastError || Object.keys(syncData).length === 0) {
          // 데이터가 없거나 에러면 마이그레이션 완료 처리
          chrome.storage.local.set({ migrated: true }, resolve);
          return;
        }

        // Sync 데이터를 Local로 이동
        chrome.storage.local.set({ ...syncData, migrated: true }, () => {
          // 선택적: Sync 데이터 삭제 (안전하게 유지하려면 주석 처리)
          // chrome.storage.sync.clear();
          console.log('Storage migrated from Sync to Local');
          resolve();
        });
      });
    });
  });
}

/**
 * 저장소 상태 확인
 * @returns {Promise<{enabled: boolean, error?: string, bytesInUse: number}>}
 */
export async function checkSyncStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
      if (chrome.runtime.lastError) {
        resolve({
          enabled: false,
          error: chrome.runtime.lastError.message,
        });
      } else {
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
  // 읽기는 락을 걸지 않아도 되지만, 쓰기 중인 데이터를 읽는 것을 방지하려면 락을 공유 모드로 사용할 수 있음
  // 하지만 성능을 위해 읽기는 락 없이 진행 (Chrome Storage는 개별 get에 대해 원자적임)
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * 스토리지에 데이터 저장하기 (Atomic Operation)
 * Web Locks API를 사용하여 여러 컨텍스트(Popup, Background) 간의 충돌 방지
 * @param {Object} items - 저장할 키-값 쌍 객체
 * @returns {Promise<void>}
 */
export async function setStorage(items) {
  return navigator.locks.request(STORAGE_LOCK_NAME, async () => {
    return new Promise((resolve, reject) => {
      // 1. 최신 상태 읽기 (Read)
      // chrome.storage.local.set은 병합(merge) 방식이므로 
      // 개별 키에 대한 업데이트는 안전하지만, 
      // 리스트 전체를 읽고 수정해서 쓰는 경우(Read-Modify-Write)를 위해 락이 필요함.
      // 여기서는 단순히 set만 호출하지만, 상위 로직에서 get -> set 흐름이 있을 때
      // 이 함수가 실행되는 동안 다른 set이 차단되지는 않음.
      // *중요*: 진정한 Transaction을 위해서는 비즈니스 로직(get -> modify -> set) 전체를 lock으로 감싸야 함.
      // 하지만 setStorage 레벨에서 락을 걸면 최소한 "쓰기" 간의 순서는 보장됨.
      
      chrome.storage.local.set(items, () => {
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
 * 안전한 트랜잭션 업데이트 (Read-Modify-Write 패턴)
 * @param {string} key - 수정할 키
 * @param {Function} updateFn - (currentValue) => newValue 함수
 */
export async function updateStorageTransaction(key, updateFn) {
  return navigator.locks.request(STORAGE_LOCK_NAME, async () => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const currentValue = result[key];
        const newValue = updateFn(currentValue);

        chrome.storage.local.set({ [key]: newValue }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(newValue);
          }
        });
      });
    });
  });
}

/**
 * 스토리지에서 데이터 제거하기
 * @param {string|string[]} keys - 제거할 키 또는 키 배열
 * @returns {Promise<void>}
 */
export async function removeStorage(keys) {
  return navigator.locks.request(STORAGE_LOCK_NAME, async () => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
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
    if (areaName === 'local') {
      callback(changes);
    }
  });
}
