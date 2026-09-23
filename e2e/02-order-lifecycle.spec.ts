import { test, expect, chromium } from '@playwright/test'
import { E2E_PREFIX, E2E_PASSWORD } from './global-setup'

// T20: one order's full circle through every role, in one real browser flow -
// cashier check-in -> customer orders -> staff serves -> cashier checks out.
test('full order lifecycle across cashier, customer, and staff', async ({ page, browser }) => {
  test.setTimeout(120_000)
  // --- Cashier: check in the seeded table and grab the real QR link ---
  await page.goto('http://localhost:5174/login')
  await page.getByLabel('Email').fill(E2E_PREFIX + '-cashier@example.test')
  await page.getByLabel('Password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: /เข้าสู่ระบบ/ }).click()
  await expect(page).toHaveURL(/\/cashier\/tables/)

  const tableCard = page.locator('div', { has: page.getByRole('heading', { name: 'โต๊ะ ' + E2E_PREFIX, exact: true }) }).first()
  await tableCard.getByRole('button', { name: /Check In/ }).click()
  await page.getByLabel('ผู้ใหญ่').fill('2')
  await page.getByRole('button', { name: /เปิดโต๊ะและสร้าง QR/ }).click()
  const qrLink = await page.getByRole('link', { name: /เปิดหน้าลูกค้าเพื่อทดสอบ/ }).getAttribute('href')
  expect(qrLink).toBeTruthy()
  await page.getByRole('button', { name: 'ปิด' }).click()

  // --- Customer: a separate browser context, following the real QR link ---
  const customerContext = await browser.newContext()
  const customerPage = await customerContext.newPage()
  await customerPage.goto(qrLink!)
  await customerPage.getByRole('button', { name: /เริ่มสั่งอาหาร/ }).click()
  await expect(customerPage).toHaveURL(/\/order$/)
  await customerPage.getByRole('button', { name: '+ สั่งเลย' }).click()
  await customerPage.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).click()
  await customerPage.getByRole('button', { name: 'ตกลงเพิ่ม' }).click()
  await expect(customerPage).toHaveURL(/\/order$/)
  await customerPage.goto('http://localhost:5173/order/cart')
  await customerPage.getByRole('button', { name: /ส่งออเดอร์เข้าครัว/ }).click()
  await expect(customerPage).toHaveURL(/\/order\/success/)
  await customerContext.close()

  // --- Staff: acknowledge and serve the order that just came in ---
  const staffContext = await browser.newContext()
  const staffPage = await staffContext.newPage()
  await staffPage.goto('http://localhost:5174/login')
  await staffPage.getByLabel('Email').fill(E2E_PREFIX + '-staff@example.test')
  await staffPage.getByLabel('Password').fill(E2E_PASSWORD)
  await staffPage.getByRole('button', { name: /เข้าสู่ระบบ/ }).click()
  await staffPage.goto('http://localhost:5174/staff/serving-queue')
  // Confirmation is eligible after 30s and the server sweep runs every 5s.
  await expect(staffPage.getByRole('button', { name: 'รับออเดอร์ (กำลังจัดเสิร์ฟ)' })).toBeVisible({ timeout: 45_000 })
  await staffPage.getByRole('button', { name: 'รับออเดอร์ (กำลังจัดเสิร์ฟ)' }).click()
  await staffPage.getByRole('button', { name: /เสิร์ฟส่วนที่เหลือทั้งหมด/ }).click()
  await staffPage.getByRole('button', { name: 'ยืนยันว่าเสิร์ฟครบ' }).click()
  await staffContext.close()

  // --- Cashier: checkout and see a real receipt ---
  await page.goto('http://localhost:5174/cashier/tables')
  const tableCardAfter = page.locator('div', { has: page.getByRole('heading', { name: 'โต๊ะ ' + E2E_PREFIX, exact: true }) }).first()
  await tableCardAfter.getByRole('button', { name: 'Check Out' }).click()
  await page.getByLabel('รับเงินมา (บาท)').fill('300')
  await page.getByRole('button', { name: 'ยืนยันการชำระเงินและปิดโต๊ะ' }).click()
  await page.getByRole('button', { name: 'ยืนยันและปิดโต๊ะ' }).click()
  await expect(page.getByText('เช็คเอาท์สำเร็จ')).toBeVisible()
})
