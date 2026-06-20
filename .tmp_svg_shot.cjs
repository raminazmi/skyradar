const { chromium } = require('C:/Users/ramin/AppData/Local/Temp/pwtools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: 'C:/Users/ramin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 600 } })).newPage();
  await page.goto('file:///C:/Users/ramin/AppData/Local/Temp/svgview.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/ramin/Downloads/rasidweather/.tmp_logos.png' });
  await browser.close();
})();
