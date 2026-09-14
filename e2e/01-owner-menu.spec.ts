import { test, expect } from '@playwright/test'
import { E2E_PREFIX, E2E_PASSWORD } from './global-setup'

test.describe.configure({ mode: 'serial' })

async function loginAsOwner(page: import('@playwright/test').Page) {
  await page.goto('http://localhost:5174/login')
  await page.getByLabel('Email').fill(E2E_PREFIX + '-owner@example.test')
  await page.getByLabel('Password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: /เข้าสู่ระบบ/ }).click()
  await expect(page).toHaveURL(/\/owner\/dashboard/)
}

test('owner logs in, sees an empty menu, and creates one (T19 empty state + T03 create)', async ({ page }) => {
  await loginAsOwner(page)

  await page.goto('http://localhost:5174/owner/menu')
  await expect(page.getByText('ไม่พบเมนู')).toBeVisible()

  await page.getByRole('button', { name: 'จัดการหมวด' }).click()
  await page.getByPlaceholder('ชื่อหมวดหมู่ใหม่').fill(E2E_PREFIX + '-category')
  await page.getByRole('button', { name: '+ เพิ่ม' }).click()
  await expect(page.getByText(E2E_PREFIX + '-category').last()).toBeVisible()
  await page.getByRole('button', { name: 'ปิด' }).click()

  await page.getByPlaceholder('เช่น ชุดหมูนุ่ม').fill(E2E_PREFIX + '-dish')
  await page.locator('select').filter({ hasText: 'เลือกหมวดหมู่' }).selectOption({ label: E2E_PREFIX + '-category' })
  await page.locator('select').filter({ hasText: 'เลือกวัตถุดิบใน Prep' }).selectOption({ label: E2E_PREFIX + '-ingredient — มี 10 ถาด' })
  // quantityRequiredPlates already defaults to 1, which is valid - no need to touch it.

  await page.getByRole('button', { name: /สร้างและแสดงในหน้าสั่งอาหาร/ }).click()
  await expect(page.getByText('ไม่พบเมนู')).toHaveCount(0)
  await expect(page.getByText(E2E_PREFIX + '-dish', { exact: false }).first()).toBeVisible()
})
