const fs = require('fs');
const path = require('path');

const wasmPath = path.join(__dirname, 'core', 'pkg', 'novagrid_wasm.wasm');
const wasmBuf = fs.readFileSync(wasmPath);
const b64 = wasmBuf.toString('base64');

const content = `// Auto-generated WASM Base64 Bundle
(function(root) {
  var b64 = "${b64}";
  if (typeof globalThis !== 'undefined') {
    globalThis.__NOVAGRID_WASM_BASE64__ = b64;
  }
  if (typeof window !== 'undefined') {
    window.__NOVAGRID_WASM_BASE64__ = b64;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = b64;
  }
})(this);
`;

fs.writeFileSync(path.join(__dirname, 'core', 'pkg', 'wasm-bundle.js'), content, 'utf8');
console.log('SUCCESS: Generated wasm-bundle.js with length', b64.length);
