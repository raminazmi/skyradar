/**
 * apiBase.ts
 * يحدّد عنوان أساس الـ API الموحَّد لكل الخدمات.
 *
 * الاستراتيجية (تتجنّب CORS تماماً):
 *  - التطوير: نترك VITE_API_URL فارغاً → نستخدم مساراً نسبياً '/api/v1'.
 *    يطلب المتصفّح من نفس أصل Vite (5173)، ووكيل Vite يمرّره لخادم Laravel.
 *  - الإنتاج: Laravel يخدم الواجهة من نفس الأصل → المسار النسبي يعمل مباشرة.
 *  - مصدر خارجي/بعيد: اضبط VITE_API_URL على العنوان المطلق ليتم تجاوز ما سبق.
 */

const API_PREFIX = '/api/v1';

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

export const apiBaseUrl = (() => {
    const configured = trimTrailingSlash((import.meta.env.VITE_API_URL ?? '').trim());

    // لا عنوان مطلق مضبوط → مسار نسبي (يمرّ عبر وكيل التطوير / نفس الأصل في الإنتاج).
    if (!configured) return API_PREFIX;

    return configured.endsWith(API_PREFIX) ? configured : `${configured}${API_PREFIX}`;
})();
