/**
 * useNovaGrid.js - Vue 3 Composable for NovaCanvasGrid
 */

import { shallowRef } from 'vue';

export function useNovaGrid() {
  const gridComponentRef = shallowRef(null);

  const resize = () => {
    gridComponentRef.value?.resize();
  };

  const render = () => {
    gridComponentRef.value?.render();
  };

  const getInstance = () => {
    return gridComponentRef.value?.getInstance();
  };

  return {
    gridComponentRef,
    resize,
    render,
    getInstance
  };
}
