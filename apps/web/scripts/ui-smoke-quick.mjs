import { chromium } from 'playwright'

const baseUrl = 'http://localhost:3000'
const browser = await chromium.launch({ headless: true })

for (const [name, width] of [
  ['mobile', 390],
  ['desktop', 1440],
]) {
  const context = await browser.newContext({ viewport: { width, height: 844 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({
    path: `/Users/wangls/Desktop/workspace/ai-gateway-studio/apps/web/tmp/ui-smoke/home-${name}.png`,
    fullPage: false,
  })

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  await page.goto(`${baseUrl}/agent`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({
    path: `/Users/wangls/Desktop/workspace/ai-gateway-studio/apps/web/tmp/ui-smoke/agent-guard-${name}.png`,
    fullPage: false,
  })

  console.log(JSON.stringify({ viewport: name, pageErrors: errors }))
  await context.close()
}

await browser.close()
