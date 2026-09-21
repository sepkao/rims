import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Writes rims-er-chen.svg next to this script. Rasterize it separately
// (e.g. an SVG-to-PNG tool, or a headless browser screenshot) if a PNG is
// needed - this file only produces the vector source.
const DIR = fileURLToPath(new URL('.', import.meta.url))

const INK = '#2D1B17'
const LINE = '#8B5746'
const ENTITY_FILL = '#FFF8EF'
const REL_FILL = '#E8D8CA'
const ATTR_FILL = '#FFFFFF'
const FONT = '"Leelawadee UI","IBM Plex Sans Thai",Tahoma,sans-serif'

// Entity boxes. attrs: [label, isKey]; side: where the attribute cluster sits.
const E = {
  lot_header: { x: 820,  y: 400,  w: 210, h: 74, label: 'LOT_HEADER', th: 'รอบรับของ',
                attrs: [['lot_header_id', 1], ['received_at'], ['supplier_ref']], side: 'above' },
  stock_lot:  { x: 820,  y: 870,  w: 200, h: 74, label: 'STOCK_LOT', th: 'ล็อตสินค้า',
                attrs: [['lot_id', 1], ['qty_remaining'], ['unit_cost'], ['expiry_date']], side: 'left' },
  storage:    { x: 440,  y: 1300, w: 230, h: 74, label: 'STORAGE_LOCATION', th: 'สถานที่เก็บ',
                attrs: [['location_id', 1], ['name'], ['unit_type']], side: 'below' },
  waste:      { x: 520,  y: 1850, w: 210, h: 74, label: 'WASTE_RECORD', th: 'ของเสีย',
                attrs: [['waste_id', 1], ['quantity'], ['waste_cost'], ['status']], side: 'below' },
  movement:   { x: 1210, y: 1850, w: 220, h: 74, label: 'STOCK_MOVEMENT', th: 'การเคลื่อนไหวสต็อก',
                attrs: [['movement_id', 1], ['type'], ['quantity']], side: 'below' },
  ingredient: { x: 1620, y: 870,  w: 200, h: 74, label: 'INGREDIENT', th: 'วัตถุดิบ',
                attrs: [['ingredient_id', 1], ['name'], ['category'], ['portion_kg']], side: 'right' },
  menu_item:  { x: 2420, y: 400,  w: 200, h: 74, label: 'MENU_ITEM', th: 'เมนู',
                attrs: [['menu_item_id', 1], ['name'], ['category'], ['is_active']], side: 'right' },
  users:      { x: 1620, y: 1520, w: 200, h: 74, label: 'USERS', th: 'ผู้ใช้',
                attrs: [['user_id', 1], ['name'], ['role'], ['is_active']], side: 'below' },
  order_item: { x: 2420, y: 1520, w: 210, h: 74, label: 'ORDER_ITEM', th: 'รายการอาหาร',
                attrs: [['order_item_id', 1], ['quantity'], ['served_qty']], side: 'right' },
  order:      { x: 2420, y: 2120, w: 190, h: 74, label: 'ORDER', th: 'ออเดอร์',
                attrs: [['order_id', 1], ['status'], ['confirm_at']], side: 'right' },
  session:    { x: 1620, y: 2320, w: 220, h: 74, label: 'TABLE_SESSION', th: 'รอบใช้โต๊ะ',
                attrs: [['session_id', 1], ['qr_code'], ['expires_at'], ['headcount'], ['price_per_head']], side: 'below' },
  table:      { x: 700,  y: 2320, w: 210, h: 74, label: 'DINING_TABLE', th: 'โต๊ะอาหาร',
                attrs: [['table_id', 1], ['table_number'], ['status']], side: 'left' },
  payment:    { x: 2900, y: 2620, w: 210, h: 74, label: 'PAYMENT', th: 'การชำระเงิน',
                attrs: [['payment_id', 1], ['receipt_no'], ['method'], ['subtotal']], side: 'right' },
  notify:     { x: 700,  y: 2700, w: 210, h: 74, label: 'NOTIFICATION', th: 'แจ้งเตือน',
                attrs: [['notify_id', 1], ['message'], ['type']], side: 'left' },
}

// Relationship diamonds: from/to entity keys, cardinality on each side.
const R = [
  { x: 820,  y: 635,  label: 'ประกอบด้วย', a: 'lot_header', b: 'stock_lot', ca: '1', cb: 'N' },
  { x: 1220, y: 870,  label: 'เป็นวัตถุดิบ', a: 'stock_lot', b: 'ingredient', ca: 'N', cb: '1' },
  { x: 560,  y: 1085, label: 'เก็บที่', a: 'stock_lot', b: 'storage', ca: 'N', cb: '1' },
  { x: 640,  y: 1590, label: 'ถูกแจ้งเสีย', a: 'stock_lot', b: 'waste', ca: '1', cb: 'N' },
  { x: 1030, y: 1370, label: 'บันทึก', a: 'stock_lot', b: 'movement', ca: '1', cb: 'N' },
  { x: 1330, y: 620,  label: 'รับของเข้า', a: 'users', b: 'lot_header', ca: '1', cb: 'N' },
  { x: 1150, y: 2700, label: 'แจ้งเตือน', a: 'session', b: 'notify', ca: '1', cb: 'N' },
  { x: 2030, y: 590,  label: 'ใช้วัตถุดิบ', a: 'ingredient', b: 'menu_item', ca: 'M', cb: 'N',
    attrs: [['qty_per_serving'], ['removable']], side: 'above' },
  { x: 2420, y: 960,  label: 'เป็นเมนู', a: 'menu_item', b: 'order_item', ca: '1', cb: 'N' },
  { x: 2420, y: 1840, label: 'มีรายการ', a: 'order', b: 'order_item', ca: '1', cb: 'N' },
  { x: 2030, y: 2120, label: 'สั่ง', a: 'session', b: 'order', ca: '1', cb: 'N' },
  { x: 1150, y: 2320, label: 'ใช้โต๊ะ', a: 'table', b: 'session', ca: '1', cb: 'N' },
  { x: 2330, y: 2620, label: 'ชำระเงิน', a: 'session', b: 'payment', ca: '1', cb: '1' },
  { x: 2030, y: 1520, label: 'เสิร์ฟ', a: 'users', b: 'order_item', ca: '1', cb: 'N' },
  { x: 1620, y: 1960, label: 'เปิดโต๊ะ', a: 'users', b: 'session', ca: '1', cb: 'N' },
  { x: 1120, y: 1660, label: 'ตรวจของเสีย', a: 'users', b: 'waste', ca: '1', cb: 'N' },
  { x: 1900, y: 1780, label: 'ตัดสต็อก', a: 'order_item', b: 'movement', ca: '1', cb: 'N' },
]

const RW = 190, RH = 104 // diamond half-width / half-height ... actual full size below
const parts = []
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function rectEdge(box, tx, ty) {
  const hw = box.w / 2 + 2, hh = box.h / 2 + 2
  const dx = tx - box.x, dy = ty - box.y
  if (dx === 0 && dy === 0) return [box.x, box.y]
  const sx = dx === 0 ? Infinity : hw / Math.abs(dx)
  const sy = dy === 0 ? Infinity : hh / Math.abs(dy)
  const s = Math.min(sx, sy)
  return [box.x + dx * s, box.y + dy * s]
}

function diamondEdge(d, tx, ty) {
  const hw = RW / 2 + 4, hh = RH / 2 + 4
  const dx = tx - d.x, dy = ty - d.y
  const denom = Math.abs(dx) / hw + Math.abs(dy) / hh
  if (denom === 0) return [d.x, d.y]
  return [d.x + dx / denom, d.y + dy / denom]
}

function line(x1, y1, x2, y2) {
  parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${LINE}" stroke-width="2"/>`)
}

function cardinality(x1, y1, x2, y2, text) {
  const t = 0.30
  const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t
  parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="#FFFFFF" stroke="none"/>`)
  parts.push(`<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="${LINE}">${text}</text>`)
}

function attrCluster(owner, attrs, side) {
  if (!attrs || !attrs.length) return
  const aw = 168, ah = 50
  const n = attrs.length
  attrs.forEach((a, i) => {
    let cx, cy
    if (side === 'above' || side === 'below') {
      const span = (n - 1) * (aw + 14)
      cx = owner.x - span / 2 + i * (aw + 14)
      cy = owner.y + (side === 'above' ? -180 : 180)
    } else {
      const span = (n - 1) * (ah + 16)
      cy = owner.y - span / 2 + i * (ah + 16)
      cx = owner.x + (side === 'left' ? -300 : 300)
    }
    const [ex, ey] = owner.w
      ? rectEdge(owner, cx, cy)
      : diamondEdge(owner, cx, cy)
    line(ex, ey, cx, cy)
    parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${aw / 2}" ry="${ah / 2}" fill="${ATTR_FILL}" stroke="${INK}" stroke-width="2"/>`)
    const deco = a[1] ? ` text-decoration="underline"` : ''
    const weight = a[1] ? '700' : '400'
    parts.push(`<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="${weight}" fill="${INK}"${deco}>${esc(a[0])}</text>`)
  })
}

// --- connections first so boxes paint over the line ends ---
for (const r of R) {
  const A = E[r.a], B = E[r.b]
  const [ax, ay] = rectEdge(A, r.x, r.y)
  const [dxa, dya] = diamondEdge(r, A.x, A.y)
  line(ax, ay, dxa, dya)
  cardinality(dxa, dya, ax, ay, r.ca)

  const [bx, by] = rectEdge(B, r.x, r.y)
  const [dxb, dyb] = diamondEdge(r, B.x, B.y)
  line(bx, by, dxb, dyb)
  cardinality(dxb, dyb, bx, by, r.cb)
}

// --- attributes ---
for (const key of Object.keys(E)) attrCluster(E[key], E[key].attrs, E[key].side)
for (const r of R) if (r.attrs) attrCluster(r, r.attrs, r.side)

// --- diamonds ---
for (const r of R) {
  const pts = `${r.x},${r.y - RH / 2} ${r.x + RW / 2},${r.y} ${r.x},${r.y + RH / 2} ${r.x - RW / 2},${r.y}`
  parts.push(`<polygon points="${pts}" fill="${REL_FILL}" stroke="${INK}" stroke-width="2"/>`)
  parts.push(`<text x="${r.x}" y="${r.y + 6}" text-anchor="middle" font-family="${FONT}" font-size="17" font-weight="600" fill="${INK}">${esc(r.label)}</text>`)
}

// --- entities ---
for (const key of Object.keys(E)) {
  const b = E[key]
  parts.push(`<rect x="${b.x - b.w / 2}" y="${b.y - b.h / 2}" width="${b.w}" height="${b.h}" rx="3" fill="${ENTITY_FILL}" stroke="${INK}" stroke-width="3"/>`)
  parts.push(`<text x="${b.x}" y="${b.y - 4}" text-anchor="middle" font-family="${FONT}" font-size="17" font-weight="700" fill="${INK}">${esc(b.label)}</text>`)
  parts.push(`<text x="${b.x}" y="${b.y + 18}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="${LINE}">${esc(b.th)}</text>`)
}

// --- legend ---
const lx = 70, ly = 175
const legend = [
  `<rect x="${lx}" y="${ly}" width="330" height="300" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>`,
  `<text x="${lx + 20}" y="${ly + 34}" font-family="${FONT}" font-size="17" font-weight="700" fill="${INK}">สัญลักษณ์ (Chen notation)</text>`,
  `<rect x="${lx + 22}" y="${ly + 56}" width="74" height="34" fill="${ENTITY_FILL}" stroke="${INK}" stroke-width="3"/>`,
  `<text x="${lx + 110}" y="${ly + 79}" font-family="${FONT}" font-size="16" fill="${INK}">Entity — ตาราง</text>`,
  `<polygon points="${lx + 59},${ly + 108} ${lx + 96},${ly + 130} ${lx + 59},${ly + 152} ${lx + 22},${ly + 130}" fill="${REL_FILL}" stroke="${INK}" stroke-width="2"/>`,
  `<text x="${lx + 110}" y="${ly + 136}" font-family="${FONT}" font-size="16" fill="${INK}">Relationship</text>`,
  `<ellipse cx="${lx + 59}" cy="${ly + 184}" rx="37" ry="20" fill="${ATTR_FILL}" stroke="${INK}" stroke-width="2"/>`,
  `<text x="${lx + 110}" y="${ly + 190}" font-family="${FONT}" font-size="16" fill="${INK}">Attribute</text>`,
  `<ellipse cx="${lx + 59}" cy="${ly + 236}" rx="37" ry="20" fill="${ATTR_FILL}" stroke="${INK}" stroke-width="2"/>`,
  `<text x="${lx + 59}" y="${ly + 241}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="${INK}" text-decoration="underline">PK</text>`,
  `<text x="${lx + 110}" y="${ly + 242}" font-family="${FONT}" font-size="16" fill="${INK}">Primary key</text>`,
  `<text x="${lx + 20}" y="${ly + 280}" font-family="${FONT}" font-size="15" fill="${LINE}">1 : N และ M : N กำกับบนเส้น</text>`,
]

const W = 3420, H = 3000
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<text x="60" y="80" font-family="${FONT}" font-size="34" font-weight="700" fill="${INK}">RIMS — Entity Relationship Diagram (Chen Notation)</text>
<text x="60" y="118" font-family="${FONT}" font-size="18" fill="${LINE}">ระบบจัดการวัตถุดิบร้านชาบูบุฟเฟต์ · แบบจำลองเชิงแนวคิด</text>
${parts.join('\n')}
${legend.join('\n')}
</svg>`

await writeFile(DIR + 'rims-er-chen.svg', svg, 'utf8')
console.log('svg written')
