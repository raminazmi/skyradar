const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const wi = require("react-icons/wi");

// ---------- palette ----------
const BG = "0B1220";        // deep night
const BG2 = "111B2E";       // card
const CYAN = "1CA9DF";
const BLUE = "0D76B3";
const NAVY = "2B3A8C";
const INK = "E8EEF6";       // near-white text
const MUTE = "9DB0C7";      // muted
const LINE = "243349";

const FH = "Cambria";       // headers
const FB = "Arial";         // body (good Arabic shaping)

async function iconPng(IconComponent, color = "#FFFFFF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.defineLayout({ name: "W", width: 13.333, height: 7.5 });
  pres.layout = "W";
  pres.author = "Sky Radar";
  pres.title = "Sky Radar — منصة الطقس التفاعلية";
  const W = 13.333, H = 7.5;

  const ar = (text, opts = {}) =>
    Object.assign({ fontFace: FB, rtlMode: true, align: "right", color: INK }, opts) && { text, options: Object.assign({ fontFace: FB, rtlMode: true, color: INK }, opts) };

  // helper: section heading block (right aligned, RTL)
  function heading(slide, kicker, title) {
    slide.addText(kicker, {
      x: 0.6, y: 0.55, w: 12.1, h: 0.4, fontFace: FB, rtlMode: true,
      align: "right", color: CYAN, fontSize: 14, bold: true, charSpacing: 2, margin: 0,
    });
    slide.addText(title, {
      x: 0.6, y: 0.95, w: 12.1, h: 0.9, fontFace: FH, rtlMode: true,
      align: "right", color: INK, fontSize: 34, bold: true, margin: 0,
    });
  }

  function card(slide, x, y, w, h, fill = BG2) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.09, fill: { color: fill },
      line: { color: LINE, width: 1 },
      shadow: { type: "outer", color: "000000", blur: 9, offset: 3, angle: 90, opacity: 0.28 },
    });
  }

  // ============================================================ SLIDE 1 — COVER
  let s = pres.addSlide();
  s.background = { color: BG };
  // soft glow blobs
  s.addShape(pres.shapes.OVAL, { x: 8.5, y: -2.2, w: 7, h: 7, fill: { color: BLUE, transparency: 78 } });
  s.addShape(pres.shapes.OVAL, { x: 9.8, y: 2.6, w: 5.5, h: 5.5, fill: { color: CYAN, transparency: 82 } });
  s.addShape(pres.shapes.OVAL, { x: -1.8, y: 4.2, w: 5, h: 5, fill: { color: NAVY, transparency: 70 } });

  s.addImage({ path: "assets/logo-04.png", x: 0.85, y: 0.7, w: 2.7, h: 2.7 * (1) , sizing: { type: "contain", w: 2.7, h: 1.5 } });
  s.addText("منصّة الطقس التفاعلية", {
    x: 0.6, y: 3.05, w: 9, h: 0.5, fontFace: FB, rtlMode: true, align: "right",
    color: CYAN, fontSize: 18, bold: true, charSpacing: 1, margin: 0,
  });
  s.addText("خرائط جوية حيّة بتقنية WebGL", {
    x: 0.4, y: 3.55, w: 12.5, h: 1.1, fontFace: FH, rtlMode: true, align: "right",
    color: INK, fontSize: 46, bold: true, margin: 0,
  });
  s.addText("بمستوى Zoom Earth و Windy — معرّبة بالكامل وجاهزة للإطلاق", {
    x: 0.4, y: 4.7, w: 12.5, h: 0.6, fontFace: FB, rtlMode: true, align: "right",
    color: MUTE, fontSize: 20, margin: 0,
  });
  // chips
  const chips = ["جسيمات رياح متحركة", "‏13 طبقة بيانات", "‏GPU / WebGL", "عربي RTL"];
  let cx = W - 0.6;
  for (const c of chips) {
    const cw = 0.32 + c.length * 0.13;
    cx -= cw;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 5.7, w: cw, h: 0.55, rectRadius: 0.27, fill: { color: BG2 }, line: { color: CYAN, width: 1 } });
    s.addText(c, { x: cx, y: 5.7, w: cw, h: 0.55, fontFace: FB, rtlMode: true, align: "center", valign: "middle", color: INK, fontSize: 12.5, margin: 0 });
    cx -= 0.25;
  }

  // ============================================================ SLIDE 2 — WHAT IS IT
  s = pres.addSlide();
  s.background = { color: BG };
  heading(s, "نظرة عامة", "ما هو Sky Radar؟");
  s.addText(
    "منصّة طقس تفاعلية متكاملة تعرض بيانات الطقس العالمية فوق خريطة داكنة أنيقة، مع جسيمات رياح متحركة بأسلوب سينمائي وشريط زمني للتنقّل بين ساعات التوقّعات. الواجهة عربية بالكامل (RTL) وتركّز على المنطقة العربية.",
    { x: 6.7, y: 2.0, w: 6.1, h: 2.4, fontFace: FB, rtlMode: true, align: "right", valign: "top", color: MUTE, fontSize: 17, lineSpacingMultiple: 1.3, margin: 0 }
  );
  const feats = [
    [fa.FaGlobe, "خريطة عالمية تفاعلية", "تركّز على المنطقة العربية"],
    [fa.FaWind, "جسيمات رياح متحركة", "محرّك WebGL على معالج الرسوميات"],
    [fa.FaClock, "شريط زمني", "ماضٍ مرصود + مستقبل متوقّع"],
    [fa.FaLanguage, "واجهة عربية كاملة", "تصميم داكن واتجاه RTL"],
  ];
  let fy = 1.95;
  for (const [Ic, t, d] of feats) {
    card(s, 0.6, fy, 5.9, 1.02);
    s.addShape(pres.shapes.OVAL, { x: 5.55, y: fy + 0.26, w: 0.5, h: 0.5, fill: { color: NAVY } });
    s.addImage({ data: await iconPng(Ic, "#" + CYAN, 256), x: 5.64, y: fy + 0.35, w: 0.32, h: 0.32 });
    s.addText(t, { x: 0.85, y: fy + 0.14, w: 4.5, h: 0.4, fontFace: FB, rtlMode: true, align: "right", color: INK, fontSize: 16, bold: true, margin: 0 });
    s.addText(d, { x: 0.85, y: fy + 0.54, w: 4.5, h: 0.35, fontFace: FB, rtlMode: true, align: "right", color: MUTE, fontSize: 12.5, margin: 0 });
    fy += 1.18;
  }

  // ============================================================ SLIDE 3 — 13 LAYERS
  s = pres.addSlide();
  s.background = { color: BG };
  heading(s, "البيانات", "‏13 طبقة طقس في منصّة واحدة");
  const layers = [
    [wi.WiStrongWind, "الرياح"], [wi.WiTornado, "هبّات الرياح"], [wi.WiThermometer, "الحرارة"],
    [wi.WiThermometerExterior, "الإحساس الحراري"], [wi.WiRain, "الأمطار"], [wi.WiBarometer, "الضغط الجوي"],
    [wi.WiHumidity, "الرطوبة"], [wi.WiRaindrop, "نقطة الندى"], [wi.WiCloudy, "الغيوم"],
    [fa.FaSatelliteDish, "رادار المطر"], [fa.FaSatellite, "أقمار صناعية"], [wi.WiHurricane, "الأعاصير"],
    [fa.FaFire, "الحرائق"],
  ];
  const cols = 4, cw = 2.92, ch = 1.18, gx = 0.18, gy = 0.2;
  const gridW = cols * cw + (cols - 1) * gx;
  const startX = (W - gridW) / 2;
  let gyy = 2.0;
  for (let i = 0; i < layers.length; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const x = startX + (cols - 1 - c) * (cw + gx); // RTL: fill right-to-left
    const y = gyy + r * (ch + gy);
    card(s, x, y, cw, ch);
    s.addShape(pres.shapes.OVAL, { x: x + cw - 0.95, y: y + 0.28, w: 0.62, h: 0.62, fill: { color: BG }, line: { color: CYAN, width: 1 } });
    s.addImage({ data: await iconPng(layers[i][0], "#" + CYAN, 256), x: x + cw - 0.83, y: y + 0.4, w: 0.38, h: 0.38 });
    s.addText(layers[i][1], { x: x + 0.15, y: y + 0.32, w: cw - 1.05, h: 0.55, fontFace: FB, rtlMode: true, align: "right", valign: "middle", color: INK, fontSize: 14.5, bold: true, margin: 0 });
  }

  // ============================================================ SLIDE 4 — TECH STACK
  s = pres.addSlide();
  s.background = { color: BG };
  heading(s, "البنية التقنية", "بُني بأحدث التقنيات");
  const stackCards = [
    ["الواجهة الأمامية", BLUE, ["React 19", "TypeScript", "MapLibre GL", "WebGL / GPU", "Tailwind CSS 4"]],
    ["الخلفية", NAVY, ["Laravel (PHP)", "طبقة Proxy + Cache ذكية", "‏9 خدمات مستقلة", "Stale-while-revalidate", "معمارية نظيفة قابلة للتوسّع"]],
  ];
  let sx = 0.6;
  const scw = 6.05;
  for (const [title, accent, items] of stackCards) {
    card(s, sx, 2.0, scw, 4.0);
    s.addShape(pres.shapes.OVAL, { x: sx + scw - 0.95, y: 2.25, w: 0.55, h: 0.55, fill: { color: accent } });
    s.addText(title, { x: sx + 0.3, y: 2.28, w: scw - 1.3, h: 0.5, fontFace: FB, rtlMode: true, align: "right", valign: "middle", color: INK, fontSize: 20, bold: true, margin: 0 });
    let iy = 3.15;
    for (const it of items) {
      s.addShape(pres.shapes.OVAL, { x: sx + scw - 0.55, y: iy + 0.08, w: 0.14, h: 0.14, fill: { color: CYAN } });
      s.addText(it, { x: sx + 0.3, y: iy - 0.05, w: scw - 1.0, h: 0.45, fontFace: FB, rtlMode: true, align: "right", valign: "middle", color: MUTE, fontSize: 15.5, margin: 0 });
      iy += 0.55;
    }
    sx += scw + 0.13;
  }
  s.addText("≈ 16,000 سطر كود إنتاجي فعلي — مشروع مكتمل يعمل الآن", {
    x: 0.6, y: 6.35, w: 12.1, h: 0.5, fontFace: FB, rtlMode: true, align: "center", color: CYAN, fontSize: 15, bold: true, margin: 0,
  });

  // ============================================================ SLIDE 5 — HOW IT WORKS
  s = pres.addSlide();
  s.background = { color: BG };
  heading(s, "آلية العمل", "من البيانات العالمية إلى شاشتك");
  const steps = [
    [fa.FaCloudDownloadAlt, "مصادر عالمية", "نماذج NOAA GFS و DWD ICON عبر مزوّدات مفتوحة"],
    [fa.FaServer, "خادم Laravel", "يبني الشبكة ويخزّنها مؤقتاً بذكاء"],
    [fa.FaMicrochip, "معالجة على GPU", "فكّ البيانات والاستيفاء داخل المتصفّح"],
    [fa.FaMapMarkedAlt, "عرض حيّ", "‏heatmap ملوّن + جسيمات ‏60 إطار/ثانية"],
  ];
  const n = steps.length, scw2 = 2.85, gap = (W - 1.2 - n * scw2) / (n - 1);
  // RTL ordering: step 1 on the right
  for (let i = 0; i < n; i++) {
    const x = W - 0.6 - scw2 - i * (scw2 + gap);
    card(s, x, 2.4, scw2, 2.9);
    s.addShape(pres.shapes.OVAL, { x: x + scw2 / 2 - 0.45, y: 2.7, w: 0.9, h: 0.9, fill: { color: NAVY } });
    s.addImage({ data: await iconPng(steps[i][0], "#" + CYAN, 256), x: x + scw2 / 2 - 0.27, y: 2.88, w: 0.54, h: 0.54 });
    s.addText("‏" + (i + 1), { x: x, y: 3.7, w: scw2, h: 0.4, align: "center", fontFace: FH, color: CYAN, fontSize: 16, bold: true, margin: 0 });
    s.addText(steps[i][1], { x: x + 0.12, y: 4.05, w: scw2 - 0.24, h: 0.45, fontFace: FB, rtlMode: true, align: "center", color: INK, fontSize: 16, bold: true, margin: 0 });
    s.addText(steps[i][2], { x: x + 0.15, y: 4.5, w: scw2 - 0.3, h: 0.75, fontFace: FB, rtlMode: true, align: "center", valign: "top", color: MUTE, fontSize: 12, lineSpacingMultiple: 1.15, margin: 0 });
    if (i < n - 1) {
      s.addImage({ data: await iconPng(fa.FaChevronLeft, "#" + BLUE, 128), x: x - gap / 2 - 0.16, y: 3.55, w: 0.3, h: 0.3 });
    }
  }

  // ============================================================ SLIDE 6 — ADVANTAGE
  s = pres.addSlide();
  s.background = { color: BG };
  heading(s, "الميزة التنافسية", "تكلفة تشغيل شبه صفرية");
  card(s, 6.7, 2.0, 6.1, 4.2);
  s.addText("≈ صفر", { x: 6.9, y: 2.4, w: 5.7, h: 1.2, fontFace: FH, align: "right", rtlMode: true, color: CYAN, fontSize: 60, bold: true, margin: 0 });
  s.addText("رسوم تراخيص البيانات", { x: 6.9, y: 3.6, w: 5.7, h: 0.5, fontFace: FB, rtlMode: true, align: "right", color: INK, fontSize: 18, bold: true, margin: 0 });
  s.addText("مصادر مفتوحة مجانية: Open-Meteo • NASA GIBS • RainViewer • FIRMS — بدلاً من التراخيص المكلفة التي تعتمدها المنصّات المنافسة.",
    { x: 6.9, y: 4.15, w: 5.7, h: 1.8, fontFace: FB, rtlMode: true, align: "right", valign: "top", color: MUTE, fontSize: 15.5, lineSpacingMultiple: 1.35, margin: 0 });
  const adv = [
    [fa.FaUnlockAlt, "بيانات مفتوحة", "لا رسوم API شهرية"],
    [fa.FaSyncAlt, "تخزين مؤقت ذكي", "يعمل حتى عند تعطّل المزوّد (Stale-while-revalidate)"],
    [fa.FaFeatherAlt, "استضافة خفيفة", "متطلبات خوادم منخفضة"],
  ];
  let ay = 2.0;
  for (const [Ic, t, d] of adv) {
    card(s, 0.6, ay, 5.9, 1.32);
    s.addShape(pres.shapes.OVAL, { x: 5.5, y: ay + 0.4, w: 0.55, h: 0.55, fill: { color: NAVY } });
    s.addImage({ data: await iconPng(Ic, "#" + CYAN, 256), x: 5.6, y: ay + 0.5, w: 0.35, h: 0.35 });
    s.addText(t, { x: 0.85, y: ay + 0.22, w: 4.4, h: 0.45, fontFace: FB, rtlMode: true, align: "right", color: INK, fontSize: 17, bold: true, margin: 0 });
    s.addText(d, { x: 0.85, y: ay + 0.68, w: 4.5, h: 0.5, fontFace: FB, rtlMode: true, align: "right", valign: "top", color: MUTE, fontSize: 12.5, lineSpacingMultiple: 1.15, margin: 0 });
    ay += 1.45;
  }

  // ============================================================ SLIDE 7 — ROADMAP / FUTURE
  s = pres.addSlide();
  s.background = { color: BG };
  heading(s, "قابل للنمو", "تطويرات قادمة ولوحة تحكّم للإدارة");
  s.addText("النظام مصمَّم ليتوسّع — ستُضاف عليه ميزات جديدة تباعاً، وعلى رأسها لوحة تحكّم (Dashboard) كاملة للمشرف لإدارة المحتوى والطبقات والمستخدمين.",
    { x: 0.6, y: 1.9, w: 12.1, h: 0.7, fontFace: FB, rtlMode: true, align: "right", color: MUTE, fontSize: 16, margin: 0 });
  const road = [
    [fa.FaTachometerAlt, "لوحة تحكّم للأدمن", "إدارة الطبقات والمحتوى والإعدادات والمستخدمين من مكان واحد"],
    [fa.FaBell, "تنبيهات جوية", "إشعارات تلقائية عند الظواهر الحرجة"],
    [fa.FaMobileAlt, "تطبيق موبايل", "تجربة أصلية على iOS و Android"],
    [fa.FaPlug, "‏API للمطوّرين", "إتاحة البيانات لأنظمة وجهات أخرى"],
    [fa.FaLayerGroup, "طبقات إضافية", "توسعة مستمرة لمصادر ونماذج جديدة"],
    [fa.FaBolt, "تحسين الأداء", "طلبات مجمّعة لرفع الدقّة والسرعة"],
  ];
  const rc = 3, rcw = 3.95, rch = 1.7, rgx = 0.18, rgy = 0.22;
  const rgridW = rc * rcw + (rc - 1) * rgx;
  const rstartX = (W - rgridW) / 2;
  let ry0 = 2.75;
  for (let i = 0; i < road.length; i++) {
    const r = Math.floor(i / rc), c = i % rc;
    const x = rstartX + (rc - 1 - c) * (rcw + rgx);
    const y = ry0 + r * (rch + rgy);
    const first = i === 0;
    card(s, x, y, rcw, rch, first ? "16314D" : BG2);
    s.addShape(pres.shapes.OVAL, { x: x + rcw - 0.92, y: y + 0.28, w: 0.6, h: 0.6, fill: { color: first ? CYAN : NAVY } });
    s.addImage({ data: await iconPng(road[i][0], first ? "#0B1220" : "#" + CYAN, 256), x: x + rcw - 0.79, y: y + 0.41, w: 0.34, h: 0.34 });
    s.addText(road[i][1], { x: x + 0.2, y: y + 0.25, w: rcw - 1.0, h: 0.6, fontFace: FB, rtlMode: true, align: "right", valign: "middle", color: INK, fontSize: 15.5, bold: true, margin: 0 });
    s.addText(road[i][2], { x: x + 0.25, y: y + 0.92, w: rcw - 0.5, h: 0.65, fontFace: FB, rtlMode: true, align: "right", valign: "top", color: MUTE, fontSize: 12, lineSpacingMultiple: 1.15, margin: 0 });
  }

  // ============================================================ SLIDE 8 — CLOSING
  s = pres.addSlide();
  s.background = { color: BG };
  s.addShape(pres.shapes.OVAL, { x: 8.8, y: -2.4, w: 7.5, h: 7.5, fill: { color: BLUE, transparency: 80 } });
  s.addShape(pres.shapes.OVAL, { x: -2, y: 3.5, w: 6, h: 6, fill: { color: NAVY, transparency: 74 } });
  s.addImage({ path: "assets/logo-04.png", x: 5.0, y: 1.5, w: 3.3, h: 1.7, sizing: { type: "contain", w: 3.3, h: 1.7 } });
  s.addText("جاهز للإطلاق اليوم", {
    x: 1, y: 3.5, w: 11.3, h: 1, fontFace: FH, rtlMode: true, align: "center", color: INK, fontSize: 40, bold: true, margin: 0,
  });
  s.addText("منتج مكتمل — واجهة وخلفية — وقابل للتوسّع حسب احتياجك", {
    x: 1, y: 4.55, w: 11.3, h: 0.6, fontFace: FB, rtlMode: true, align: "center", color: MUTE, fontSize: 19, margin: 0,
  });

  await pres.writeFile({ fileName: "Sky_Radar.pptx" });
  console.log("written Sky_Radar.pptx");
})();
