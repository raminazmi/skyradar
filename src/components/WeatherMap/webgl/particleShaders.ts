/**
 * particleShaders.ts
 * شيدرات محرّك جسيمات الرياح (GLSL). مفصولة لإبقاء ParticleGLLayer.ts < 300 سطر.
 */

export const QUAD_VERT = `
attribute vec2 a_pos;
varying vec2 v_tex_pos;
void main() {
    v_tex_pos = a_pos;
    gl_Position = vec4(1.0 - 2.0 * a_pos, 0.0, 1.0);
}`;

// نسخ نسيج إلى آخر مع تلاشٍ (لتأثير الذيل). حيلة floor تمنع بقاء بقايا لا تتلاشى.
export const SCREEN_FRAG = `
precision mediump float;
uniform sampler2D u_screen;
uniform float u_opacity;
varying vec2 v_tex_pos;
void main() {
    vec4 color = texture2D(u_screen, 1.0 - v_tex_pos);
    gl_FragColor = vec4(floor(255.0 * color * u_opacity) / 255.0);
}`;

// تحديث مواضع الجسيمات (محاكاة على الـ GPU)
export const UPDATE_FRAG = `
precision highp float;
uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform float u_rand_seed;
uniform vec2 u_speed;          // عامل السرعة لكل محور (مقسوم على مدى الشبكة)
uniform float u_drop_rate;
uniform float u_drop_rate_bump;
varying vec2 v_tex_pos;

const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

vec2 windUV(const vec2 p) {
    // U في القناة G، V في القناة B (ترميز buildValueTexture)
    vec3 px = texture2D(u_wind, p).rgb;
    return vec2(px.g, px.b) * 2.0 - 1.0; // [-1..1]
}

void main() {
    vec4 color = texture2D(u_particles, v_tex_pos);
    vec2 pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a); // [0,1] فضاء الشبكة

    vec2 vel = windUV(pos);                     // [-1..1] نسبة من WIND_UV_MAX
    float speed_t = clamp(length(vel), 0.0, 1.0);

    vec2 offset = vel * u_speed;                // خطوة في فضاء [0,1]
    pos = fract(1.0 + pos + offset);

    // إعادة توليد عشوائية (أعلى احتمالاً للجسيمات السريعة) لإبقاء التوزيع متجانساً
    vec2 seed = (pos + v_tex_pos) * u_rand_seed;
    float drop_rate = u_drop_rate + speed_t * u_drop_rate_bump;
    float drop = step(1.0 - drop_rate, rand(seed));
    vec2 random_pos = vec2(rand(seed + 1.3), rand(seed + 2.1));
    pos = mix(pos, random_pos, drop);

    gl_FragColor = vec4(fract(pos * 255.0), floor(pos * 255.0) / 255.0);
}`;

// رسم الجسيمات نقاطاً، مُسقطة عبر مصفوفة الخريطة
export const DRAW_VERT = `
precision highp float;
attribute float a_index;
uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform float u_particles_res;
uniform mat4 u_matrix;
uniform vec4 u_bounds;          // west, south, east, north (degrees)
uniform float u_point_size;
varying float v_speed_t;
const float PI = 3.141592653589793;
void main() {
    vec2 cell = vec2(
        fract(a_index / u_particles_res),
        floor(a_index / u_particles_res) / u_particles_res);
    vec4 color = texture2D(u_particles, cell);
    vec2 pos = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);

    vec2 vel = (texture2D(u_wind, pos).gb * 2.0 - 1.0);
    v_speed_t = clamp(length(vel), 0.0, 1.0);

    float lng = u_bounds.x + pos.x * (u_bounds.z - u_bounds.x);
    float lat = u_bounds.y + pos.y * (u_bounds.w - u_bounds.y);

    // lng/lat → مركاتور [0,1] (صيغة MapLibre)
    float mx = (lng + 180.0) / 360.0;
    float my = (180.0 - (180.0 / PI) * log(tan(PI * 0.25 + radians(lat) * 0.5))) / 360.0;

    gl_Position = u_matrix * vec4(mx, my, 0.0, 1.0);
    gl_PointSize = u_point_size;
}`;

export const DRAW_FRAG = `
precision mediump float;
varying float v_speed_t;
uniform float u_alpha;
void main() {
    // أبيض خالص دائماً (والذيل يرث نفس اللون الأبيض عبر تلاشي نسيج الشاشة) — أسلوب Zoom Earth.
    // ألفا يتدرّج قليلاً مع السرعة لإحساس بالعمق، لكن اللون يبقى أبيض صرفاً.
    gl_FragColor = vec4(255, 255, 255, u_alpha * (0.6 + 0.4 * v_speed_t));
}`;
