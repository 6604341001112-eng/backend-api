<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

try {
    // 1. เชื่อมต่อฐานข้อมูลด้วย PDO UTF-8
    $pdo = new PDO(
        "mysql:host=localhost;dbname=consumables;charset=utf8mb4", 
        "root", 
        "",
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // 2. Query ดึงข้อมูล 5,120 รายการ
    $sql = "SELECT DISTINCT `COL 2` AS item_name FROM `ai_forecast_db_ready` WHERE `COL 2` IS NOT NULL AND `COL 2` != 'COL 2'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. ฟังก์ชันจัดหมวดหมู่อัตโนมัติ (Dynamic Auto-Categorization)
    function assignCategory($name) {
        if (preg_match('/(ข้าว|ผัด|แกง|น้ำพริก)/u', $name)) return 'rice';
        if (preg_match('/(ซีอิ๊ว|น้ำปลา|ซอส|ผงชูรส)/u', $name)) return 'seasoning';
        if (preg_match('/(กาแฟ|นม|ชา|น้ำดื่ม)/u', $name)) return 'beverage';
        if (preg_match('/(บะหมี่|มาม่า|กระป๋อง)/u', $name)) return 'instant';
        if (preg_match('/(ขนม|เลย์|มันฝรั่ง)/u', $name)) return 'snacks';
        return 'household'; // หมวดหมู่เริ่มต้น
    }

    // 4. แปลงโครงสร้างให้ตรงกับรูปแบบ JavaScript MENU
    $menuData = [];
    foreach ($rows as $index => $row) {
        $name = trim($row['item_name']);
        $menuData[] = [
            'id'    => 'prod_' . ($index + 1),
            'cat'   => assignCategory($name),
            'name'  => $name,
            'price' => rand(20, 300), // ปรับเป็นชื่อคอลัมน์จริงใน DB ได้ เช่น $row['COL 3']
            'base'  => rand(10, 50)   // ค่าการเติบโตพื้นฐานสำหรับแสดงกราฟ
        ];
    }

    echo json_encode(['success' => true, 'total' => count($menuData), 'data' => $menuData], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>