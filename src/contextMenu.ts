const MENU_WIDTH = 230;
const MENU_HEIGHT = 336;
const VIEWPORT_MARGIN = 8;

export function clampContextMenuPosition(x: number, y: number, viewportWidth: number, viewportHeight: number) {
  return {
    x: Math.max(VIEWPORT_MARGIN, Math.min(x, viewportWidth - MENU_WIDTH - VIEWPORT_MARGIN)),
    y: Math.max(VIEWPORT_MARGIN, Math.min(y, viewportHeight - MENU_HEIGHT - VIEWPORT_MARGIN)),
  };
}
