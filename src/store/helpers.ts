/**
 * store/helpers.ts
 * دوال مساعدة لمتجر الطقس: تطبيع خط الطول، والإغلاق المتبادل للّوحات على الموبايل.
 */

export function normalizeLongitude(value: number): number {
    return ((((value + 180) % 360) + 360) % 360) - 180;
}

export type ResponsivePanelKey =
    'sidebarOpen' | 'layerControlsOpen' | 'infoPanelOpen' | 'settingsOpen' | 'modalOpen';

export function isCompactViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

/**
 * على الموبايل: فتح لوحة يُغلق البقية (لتفادي التراكب). على الديسكتوب: تتعايش.
 */
export function getResponsivePanelPatch(
    panel: ResponsivePanelKey,
): Partial<Record<ResponsivePanelKey, boolean>> {
    if (!isCompactViewport()) {
        return { [panel]: true };
    }
    return {
        sidebarOpen: false,
        layerControlsOpen: false,
        infoPanelOpen: false,
        settingsOpen: false,
        modalOpen: false,
        [panel]: true,
    };
}
