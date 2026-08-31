// LEET App Proxy Stub - Loads FIRST, prevents onclick="app.xxx()" ReferenceError
// The real app initializes after leet_data.js loads
window._leetPendingCalls = [];

window.app = new Proxy({}, {
  get(target, prop) {
    // If method already exists on real app, use it
    if (target[prop] !== undefined) return target[prop];
    // Otherwise queue the call for when real app is ready
    return function(...args) {
      if (target._real && typeof target._real[prop] === 'function') {
        return target._real[prop](...args);
      }
      window._leetPendingCalls.push({ prop, args });
    };
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  }
});

window._leetInitReal = function(realApp) {
  // Copy all methods to proxy target
  window.app._real = realApp;
  Object.setPrototypeOf(window.app, null);
  // Flush pending calls
  for (const call of (window._leetPendingCalls || [])) {
    if (typeof realApp[call.prop] === 'function') {
      try { realApp[call.prop](...call.args); } catch(e) {}
    }
  }
  window._leetPendingCalls = [];
  // Make app directly = realApp so future calls are fast
  window.app = realApp;
  console.log('[LEET] App initialized, pending calls flushed.');
};
