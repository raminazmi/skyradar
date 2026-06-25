<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * يضغط ردود الـ API (gzip) عندما يدعمها العميل والمحتوى كبير بما يكفي.
 * شبكات الطقس (JSON) ضخمة؛ الضغط يقلّل حجم النقل 70–85% فيصل الإطار أسرع بكثير.
 * يتفادى الضغط إن كان الخادم (Apache mod_deflate) ضغط مسبقاً.
 */
class CompressApiResponse
{
    /** أصغر حجم يستحق الضغط (بايت) — أقل من ذلك تكلفة الضغط أكبر من فائدته. */
    private const MIN_BYTES = 1024;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (!function_exists('gzencode')) {
            return $response;
        }

        $accept = (string) $request->header('Accept-Encoding', '');
        if (stripos($accept, 'gzip') === false) {
            return $response;
        }

        // لا تضغط مرّتين، ولا تلمس الردود المتدفّقة/الملفات.
        if ($response->headers->has('Content-Encoding') || !method_exists($response, 'getContent')) {
            return $response;
        }

        $content = $response->getContent();
        if ($content === false || strlen($content) < self::MIN_BYTES) {
            return $response;
        }

        $compressed = gzencode($content, 6);
        if ($compressed === false) {
            return $response;
        }

        $response->setContent($compressed);
        $response->headers->set('Content-Encoding', 'gzip');
        $response->headers->set('Content-Length', (string) strlen($compressed));
        $response->headers->set('Vary', 'Accept-Encoding');

        return $response;
    }
}
