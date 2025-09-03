const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Check console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}]`, msg.text());
  });
  
  page.on('pageerror', error => {
    console.log('Page error:', error.message);
  });
  
  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');
  
  const title = await page.title();
  console.log('Page title:', title);
  
  // Wait for page to load
  await page.waitForTimeout(5000);
  
  // Check console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  // Wait a bit more and check again
  await page.waitForTimeout(5000);
  
  // Check what's on window
  const windowInfo = await page.evaluate(() => {
    const keys = Object.keys(window).filter(key => !key.startsWith('__'));
    return {
      hasApp: 'app' in window,
      hasLiteGraph: 'LiteGraph' in window,
      hasComfyApp: 'ComfyApp' in window,
      topKeys: keys.slice(0, 30),
      appType: typeof window['app']
    };
  });
  
  console.log('Window info:', JSON.stringify(windowInfo, null, 2));
  
  await browser.close();
})();