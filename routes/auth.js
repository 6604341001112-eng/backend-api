const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // ใช้ bcryptjs (pure JS) แทน bcrypt เพื่อไม่ต้อง compile native module
const db = require('../config/db');

// POST /api/auth/login -> ตรวจสอบกับตาราง user จริงใน MySQL (รองรับ hash แบบ $2y$ จาก PHP ได้ด้วย)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  }

  try {
    const [users] = await db.query('SELECT * FROM user WHERE username = ?', [username]);
    if (users.length === 0) return res.status(401).json({ message: 'ไม่พบผู้ใช้นี้ในระบบ' });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });

    const token = jwt.sign(
      { id: user.user_id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: { id: user.user_id, username: user.username, name: user.full_name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
