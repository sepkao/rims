const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function test() {
  try {
    await pool.query(`INSERT INTO ingredients (name, category, default_portion_size_kg) VALUES 
      ('หมูสามชั้นสไลด์', 'meat', 0.1), 
      ('เนื้อวากิวสไลด์', 'meat', 0.1), 
      ('ผักกาดขาว', 'vegetable', 0.05),
      ('ผักบุ้ง', 'vegetable', 0.05)
      ON CONFLICT (name) DO NOTHING`);
    console.log("Ingredients inserted or already exist.");
    
    const menuRes = await pool.query(`INSERT INTO menu_items (name, price, description) VALUES 
      ('ชุดหมูรวม', 199.00, 'รวมหมูสามชั้นและสันคอ'),
      ('เนื้อวากิวพรีเมียม', 299.00, 'เนื้อวากิว A4 ละลายในปาก'),
      ('ชุดผักรวม', 89.00, 'ผักกาดขาว ผักบุ้ง เห็ดเข็มทอง')
      RETURNING id`);
    console.log("Menu items inserted", menuRes.rows);
  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    pool.end();
  }
}
test();
