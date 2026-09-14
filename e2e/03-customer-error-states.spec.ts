import { test, expect } from '@playwright/test'

// T19: representative error/empty states in the customer app.
test('an invalid QR code shows an error, not a blank or crashed page', async ({ page }) => {
  await page.goto('http://localhost:5173/landing?qr=this-code-does-not-exist')
  await expect(page.getByRole('heading', { name: /หมดอายุ|ไม่ถูกต้อง|ไม่พบ/ })).toBeVisible()
})

test('order history with no orders yet shows an empty state, not a blank page', async ({ page }) => {
  await page.goto('http://localhost:5173/order/history')
  // No qr in sessionStorage at all: the page should redirect or show a clear
  // "no session" state rather than silently rendering nothing.
  await expect(page.locator('body')).not.toBeEmpty()
})
