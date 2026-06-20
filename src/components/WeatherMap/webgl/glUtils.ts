/**
 * glUtils.ts
 * أدوات WebGL منخفضة المستوى مشتركة بين كل طبقات GPU (heatmap / particles).
 * خالية من أي منطق طقس — مجرد مساعدات تصريف/برامج/نسيج/مخازن.
 */

/** سياق WebGL — MapLibre قد يوفّر WebGL1 أو WebGL2. */
export type GLContext = WebGLRenderingContext | WebGL2RenderingContext;

export function createShader(gl: GLContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL: تعذّر إنشاء shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('WebGL: فشل تصريف shader: ' + log);
    }
    return shader;
}

export function createProgram(
    gl: GLContext,
    vertexSource: string,
    fragmentSource: string,
): WebGLProgram {
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('WebGL: تعذّر إنشاء program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    // الـ shaders تبقى مرفقة؛ نحذفها بعد الربط لتحرير الذاكرة.
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error('WebGL: فشل ربط program: ' + log);
    }
    return program;
}

/** يجمع مواقع كل الـ uniforms/attributes لاستخدام أنظف لاحقاً. */
export function getLocations(
    gl: GLContext,
    program: WebGLProgram,
    attributes: string[],
    uniforms: string[],
): { attributes: Record<string, number>; uniforms: Record<string, WebGLUniformLocation | null> } {
    const a: Record<string, number> = {};
    for (const name of attributes) a[name] = gl.getAttribLocation(program, name);
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniforms) u[name] = gl.getUniformLocation(program, name);
    return { attributes: a, uniforms: u };
}

export function createBuffer(gl: GLContext, data: Float32Array): WebGLBuffer {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('WebGL: تعذّر إنشاء buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

export interface TextureOptions {
    filter?: number;   // gl.LINEAR | gl.NEAREST
    wrap?: number;     // gl.CLAMP_TO_EDGE | gl.REPEAT
}

/** ينشئ نسيجاً RGBA8 من بيانات (أو فارغاً) بحجم محدّد. */
export function createTexture(
    gl: GLContext,
    width: number,
    height: number,
    data: Uint8Array | null,
    options: TextureOptions = {},
): WebGLTexture {
    const { filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE } = options;
    const texture = gl.createTexture();
    if (!texture) throw new Error('WebGL: تعذّر إنشاء texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return texture;
}

export function updateTexture(
    gl: GLContext,
    texture: WebGLTexture,
    width: number,
    height: number,
    data: Uint8Array,
): void {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
}

export function bindTexture(gl: GLContext, texture: WebGLTexture, unit: number): void {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
}
