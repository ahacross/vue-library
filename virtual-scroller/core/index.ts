import initWasm, {
  WasmAxis,
  WasmGrid,
  WasmTree,
  WasmSelectFilter,
  WasmColumnarTable,
} from './pkg/wasm_virtual_core.js';
import wasmUrl from './pkg/wasm_virtual_core_bg.wasm?url';

let wasmInstance: any = null;
let initPromise: Promise<any> | null = null;

export async function ensureWasmInitialized(): Promise<any> {
  if (wasmInstance) return wasmInstance;
  if (!initPromise) {
    initPromise = initWasm(wasmUrl).then((inst) => {
      wasmInstance = inst;
      return inst;
    });
  }
  return initPromise;
}

export { WasmAxis, WasmGrid, WasmTree, WasmSelectFilter, WasmColumnarTable };

/**
 * Zero-copy helper to read Float64Array view from Wasm linear memory
 */
export function readF64View(ptr: number, length: number): Float64Array {
  if (!wasmInstance) {
    throw new Error('Wasm not initialized');
  }
  return new Float64Array(wasmInstance.memory.buffer, ptr, length);
}

/**
 * Zero-copy helper to read Uint32Array view from Wasm linear memory
 */
export function readU32View(ptr: number, length: number): Uint32Array {
  if (!wasmInstance) {
    throw new Error('Wasm not initialized');
  }
  return new Uint32Array(wasmInstance.memory.buffer, ptr, length);
}

export interface GridResult {
  rowStart: number;
  rowEnd: number;
  rowOffset: number;
  totalHeight: number;
  colStart: number;
  colEnd: number;
  colOffset: number;
  totalWidth: number;
}

export function parseGridResult(ptr: number): GridResult {
  const view = readF64View(ptr, 8);
  return {
    rowStart: Math.floor(view[0]),
    rowEnd: Math.ceil(view[1]),
    rowOffset: view[2],
    totalHeight: view[3],
    colStart: Math.floor(view[4]),
    colEnd: Math.ceil(view[5]),
    colOffset: view[6],
    totalWidth: view[7],
  };
}

export interface AxisResult {
  startIndex: number;
  endIndex: number;
  startOffset: number;
  totalSize: number;
}

export function parseAxisResult(ptr: number): AxisResult {
  const view = readF64View(ptr, 4);
  return {
    startIndex: Math.floor(view[0]),
    endIndex: Math.ceil(view[1]),
    startOffset: view[2],
    totalSize: view[3],
  };
}
