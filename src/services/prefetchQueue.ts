/**
 * prefetchQueue.ts
 * طابور إحماء بحدّ تزامن — الاستضافة المشتركة (LiteSpeed) تقطع تدفّقات HTTP/2 عندما
 * يفتح المتصفح عشرات التنزيلات دفعةً واحدة (ERR_HTTP2_PROTOCOL_ERROR + 206 لاستكمال
 * المقطوع). كل الإحماء غير العاجل (إطارات مجاورة، نُسج التلميح) يمرّ من هنا بأربعة
 * تنزيلات متزامنة كحدّ أقصى، فيبقى الخادم مرتاحاً ويكتمل كل ملف من أول مرّة.
 */

const MAX_CONCURRENT = 4;

let active = 0;
const pending: Array<() => void> = [];

function next(): void {
    if (active >= MAX_CONCURRENT) return;
    const task = pending.shift();
    if (!task) return;
    active += 1;
    task();
}

/** ينفّذ مهمة غير عاجلة ضمن حدّ التزامن. */
export function queuePrefetch(run: () => Promise<unknown>): void {
    pending.push(() => {
        run().catch(() => { /* الإحماء اختياري — الفشل لا يهم */ }).finally(() => {
            active -= 1;
            next();
        });
    });
    next();
}

/** يُحمّي صورة (تنزيل إلى كاش المتصفح) عبر الطابور. */
export function queuePrefetchImage(src: string): void {
    queuePrefetch(() => new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
    }));
}
