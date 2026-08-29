const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function ensureMockMenu() {
  try {
    const res = await pool.query('SELECT id FROM menu_items LIMIT 1');
    if (res.rows.length === 0) {
      await pool.query(`INSERT INTO ingredients (name, category, default_portion_size_kg) VALUES 
        ('หมูสามชั้นสไลด์', 'meat', 0.1), 
        ('เนื้อวากิวสไลด์', 'meat', 0.1), 
        ('ผักกาดขาว', 'vegetable', 0.05),
        ('ผักบุ้ง', 'vegetable', 0.05)
        ON CONFLICT (name) DO NOTHING`);
        
      const menuRes = await pool.query(`INSERT INTO menu_items (name, price, description) VALUES 
        ('ชุดหมูรวม', 199.00, 'รวมหมูสามชั้นและสันคอ'),
        ('เนื้อวากิวพรีเมียม', 299.00, 'เนื้อวากิว A4 ละลายในปาก'),
        ('ชุดผักรวม', 89.00, 'ผักกาดขาว ผักบุ้ง เห็ดเข็มทอง')
        RETURNING id`);
        
      const menuIds = menuRes.rows.map(r => r.id);
      
      const ingRes = await pool.query(`SELECT id, name FROM ingredients WHERE name IN ('หมูสามชั้นสไลด์', 'เนื้อวากิวสไลด์', 'ผักกาดขาว')`);
      const ingMap = {};
      ingRes.rows.forEach(r => { ingMap[r.name] = r.id; });
      
      if (ingMap['หมูสามชั้นสไลด์']) await pool.query(`INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, removable) VALUES ($1, $2, true)`, [menuIds[0], ingMap['หมูสามชั้นสไลด์']]);
      if (ingMap['เนื้อวากิวสไลด์']) await pool.query(`INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, removable) VALUES ($1, $2, true)`, [menuIds[1], ingMap['เนื้อวากิวสไลด์']]);
      if (ingMap['ผักกาดขาว']) await pool.query(`INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, removable) VALUES ($1, $2, true)`, [menuIds[2], ingMap['ผักกาดขาว']]);
    }
    
    const result = await pool.query(`
      SELECT 
        mi.id::text, 
        mi.name, 
        mi.price::float, 
        mi.description,
        COALESCE(
          json_agg(
            json_build_object('id', i.id::text, 'name', i.name, 'removable', mii.removable)
          ) FILTER (WHERE i.id IS NOT NULL), '[]'
        ) as ingredients
      FROM menu_items mi
      LEFT JOIN menu_item_ingredients mii ON mii.menu_item_id = mi.id
      LEFT JOIN ingredients i ON i.id = mii.ingredient_id
      WHERE mi.is_active = true
      GROUP BY mi.id, mi.name, mi.price, mi.description
      ORDER BY mi.id ASC
    `);
    console.log("Success:", result.rows.length, "rows");
  } catch(e) {
    console.error("Query Error:", e);
  } finally {
    pool.end();
  }
}
ensureMockMenu();
