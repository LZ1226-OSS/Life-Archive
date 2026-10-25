// 测试共享工具：node 环境下注入 localStorage mock。
// storage.js 对缺失 localStorage 有 try/catch 兜底；注入 mock 后走正常读写路径。
// mock 支持 getItem/setItem/removeItem/clear/key/length，与浏览器 Storage 接口一致。

export function createLocalStorageMock(initial = {}) {
  const store = new Map();
  Object.entries(initial).forEach(([key, value]) => {
    store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

// 将 mock 挂到 globalThis 并返回句柄；uninstall 后恢复「无 localStorage」的 node 环境。
export function installLocalStorageMock(initial) {
  const mock = createLocalStorageMock(initial);
  globalThis.localStorage = mock;
  return {
    mock,
    uninstall() {
      delete globalThis.localStorage;
    },
  };
}
