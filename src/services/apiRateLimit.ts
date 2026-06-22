/**
 * apiRateLimit.ts
 * قاطِع دائرة مشترك لطلبات الـ API. عند بلوغ حصّة المزوّد اليومية (429) أو فشل
 * متكرّر، نوقف إغراق الخادم بالطلبات ونُسكِت سيل رسائل الخطأ في الكونسول حتى
 * انقضاء فترة تهدئة. هكذا لا يتجمّد المتصفّح بآلاف الطلبات الفاشلة، وتبقى الطبقات
 * النقطية (الحرارة... من نُسج PNG محلّية) تعمل دون اعتماد على المزوّد.
 */

import type { AxiosError } from 'axios';

// مدّة التهدئة بعد بلوغ الحصّة اليومية (429): لا فائدة من إعادة المحاولة قبلها.
const QUOTA_COOLDOWN_MS = 10 * 60 * 1000; // 10 دقائق
// تهدئة أقصر بعد فشل شبكي عابر (الخادم متوقّف/مهلة) كي لا نُغرقه بالمحاولات.
const TRANSIENT_COOLDOWN_MS = 30 * 1000;  // 30 ثانية

let cooldownUntil = 0;
let lastLoggedAt = 0;
const LOG_THROTTLE_MS = 15 * 1000; // سجّل مرّة كل 15 ثانية كحدّ أقصى

/** هل نحن حالياً في فترة تهدئة؟ إن نعم، يجب تخطّي أي طلب جديد للمزوّد. */
export function isApiCoolingDown(): boolean {
    return Date.now() < cooldownUntil;
}

/** الثواني المتبقّية في التهدئة (للعرض في الواجهة عند الحاجة). */
export function apiCooldownSecondsLeft(): number {
    return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
}

function isRateLimited(error: unknown): boolean {
    const status = (error as AxiosError)?.response?.status;
    if (status === 429) return true;
    const message = (error as AxiosError<{ message?: string }>)?.response?.data?.message ?? '';
    return /limit exceeded|too many requests|حصّة|الحصة/i.test(message);
}

/**
 * سجّل فشلاً وحدّث القاطع. يُرجع true إذا كان الفشل بسبب الحصّة اليومية (429).
 * يُستدعى من خطافات الـ catch في الخدمات.
 */
export function noteApiFailure(error: unknown): boolean {
    const quota = isRateLimited(error);
    cooldownUntil = Math.max(
        cooldownUntil,
        Date.now() + (quota ? QUOTA_COOLDOWN_MS : TRANSIENT_COOLDOWN_MS)
    );
    return quota;
}

/** نجاح طلب → نلغي التهدئة فوراً (عادت الحصّة/الخادم). */
export function noteApiSuccess(): void {
    cooldownUntil = 0;
}

/**
 * تسجيل مكبوح: يطبع رسالة واحدة كل LOG_THROTTLE_MS بدلاً من إغراق الكونسول
 * بمئات الأسطر المتطابقة أثناء التهدئة.
 */
export function logApiErrorThrottled(prefix: string, error: unknown): void {
    const now = Date.now();
    if (now - lastLoggedAt < LOG_THROTTLE_MS) return;
    lastLoggedAt = now;
    const msg = (error as Error)?.message ?? String(error);
    if (isApiCoolingDown()) {
        console.warn(`${prefix} — توقّف الجلب مؤقّتاً (${apiCooldownSecondsLeft()}s) بعد بلوغ حدّ المزوّد.`);
    } else {
        console.error(prefix, msg);
    }
}
