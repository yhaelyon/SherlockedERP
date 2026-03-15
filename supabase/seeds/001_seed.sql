-- ============================================================
-- SEED 001 — Sherlocked Rishon LeZion
-- 2 Branches · 13 Rooms · Hours · Activities · Tasks · Vouchers
-- ⚠️  Run AFTER migrations 001–009
-- ============================================================

-- ─── BRANCHES ───────────────────────────────────────────────
INSERT INTO branches (id, name, address, wifi_ssid, timezone)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'שרלוקד מערב',
   'רח׳ אלטלנה 14, אזור תעשייה החדש, ראשון לציון',
   'sherlocked',
   'Asia/Jerusalem'),

  ('00000000-0000-0000-0000-000000000002',
   'שרלוקד מזרח',
   'רח׳ משה בקר 18, מתחם הרובע, קומה 2, ראשון לציון',
   'sherlocked',
   'Asia/Jerusalem');

-- ─── ROOMS — WEST BRANCH (אלטלנה 14) ───────────────────────
INSERT INTO rooms (id, branch_id, name, capacity_min, capacity_max, color_hex, display_order, is_mythos, age_min, slug)
VALUES
  -- אנתרקס — science/thriller, 2-7 players, age 6+
  ('10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'אנתרקס', 2, 7, '#4A9EFF', 1, FALSE, 6, 'anthrax'),

  -- הפרופסור המפוזר — family/kids version of Anthrax, 2-7 players, age 6+
  ('10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'הפרופסור המפוזר', 2, 7, '#F59E0B', 2, FALSE, 6, 'professor'),

  -- משימת שרלוק הולמס — detective, 2-7 players, age 6+
  ('10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   'משימת שרלוק הולמס', 2, 7, '#6366F1', 3, FALSE, 6, 'sherlock'),

  -- מסעות גוליבר — physical/adventure, 3-7 players, age 5+
  -- ⚠️ Not suitable for pregnant women or mobility impaired
  ('10000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   'מסעות גוליבר', 3, 7, '#10B981', 4, FALSE, 5, 'gulliver'),

  -- הקוסם מארץ עוץ — family/fantasy, 3-10 players, age 6+
  ('10000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000001',
   'הקוסם מארץ עוץ', 3, 10, '#A78BFA', 5, FALSE, 6, 'wizard-of-oz'),

  -- אוז — dark version for adults, 3-7 players, age 13+
  ('10000000-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-000000000001',
   'אוז', 3, 7, '#374151', 6, FALSE, 13, 'oz-dark'),

  -- ויקינגים — archery tag activity (NOT escape room), 6-20 players, age 10+
  -- ⚠️ 90-min activity — slots generated separately; fixed slot constraint bypassed below
  ('10000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000001',
   'ויקינגים – חץ וקשת', 6, 20, '#EF4444', 7, FALSE, 10, 'vikings'),

  -- מציאות מדומה VR — virtual reality games, 2-8 players, age 8+
  ('10000000-0000-0000-0000-000000000013',
   '00000000-0000-0000-0000-000000000001',
   'מציאות מדומה VR', 2, 8, '#06B6D4', 8, FALSE, 8, 'vr-games');

-- ─── ROOMS — EAST BRANCH (משה בקר 18) ──────────────────────
INSERT INTO rooms (id, branch_id, name, capacity_min, capacity_max, color_hex, display_order, is_mythos, age_min, slug)
VALUES
  -- הקלף של ג'ק — mystery, 3-7 players, age 6+
  ('10000000-0000-0000-0000-000000000008',
   '00000000-0000-0000-0000-000000000002',
   'הקלף של ג''ק', 3, 7, '#F97316', 1, FALSE, 6, 'jack-card'),

  -- שוקולד של טדי — family/chocolate factory, 3-7 players, age 6+
  ('10000000-0000-0000-0000-000000000009',
   '00000000-0000-0000-0000-000000000002',
   'שוקולד של טדי', 3, 7, '#B45309', 2, FALSE, 6, 'teddy-chocolate'),

  -- השאגה המסתורית — family/lions, 3-7 players, age 8+
  ('10000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000002',
   'השאגה המסתורית', 3, 7, '#059669', 3, FALSE, 8, 'roar-family'),

  -- השאגה האפלה — dark/adult version, 2-8 players, age 13+
  ('10000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000002',
   'השאגה האפלה', 2, 8, '#1D4ED8', 4, FALSE, 13, 'roar-dark'),

  -- מיתוס — horror with live actor, 2-8 players, age 16+, NO discounts
  ('10000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000002',
   'מיתוס', 2, 8, '#7C2D12', 5, TRUE, 16, 'mythos');

-- ─── LINKED ROOMS (physical room pairs) ─────────────────────
-- When one version is booked, the other is auto-blocked by trigger.
-- Set bidirectionally so the trigger works in both directions.

-- West: אנתרקס (adults) ↔ הפרופסור המפוזר (family)
UPDATE rooms SET linked_room_id = '10000000-0000-0000-0000-000000000002'
  WHERE id = '10000000-0000-0000-0000-000000000001';
UPDATE rooms SET linked_room_id = '10000000-0000-0000-0000-000000000001'
  WHERE id = '10000000-0000-0000-0000-000000000002';

-- West: הקוסם מארץ עוץ (family) ↔ אוז (dark/adults)
UPDATE rooms SET linked_room_id = '10000000-0000-0000-0000-000000000006'
  WHERE id = '10000000-0000-0000-0000-000000000005';
UPDATE rooms SET linked_room_id = '10000000-0000-0000-0000-000000000005'
  WHERE id = '10000000-0000-0000-0000-000000000006';

-- East: השאגה המסתורית (family) ↔ השאגה האפלה (dark/adults)
UPDATE rooms SET linked_room_id = '10000000-0000-0000-0000-000000000011'
  WHERE id = '10000000-0000-0000-0000-000000000010';
UPDATE rooms SET linked_room_id = '10000000-0000-0000-0000-000000000010'
  WHERE id = '10000000-0000-0000-0000-000000000011';

-- ─── BRANCH HOURS ───────────────────────────────────────────
-- Sun–Thu (0–4): 09:00–23:30  → last slot 22:30, game ends 23:30 (actual close ~00:00)
-- Fri (5): 09:00–23:59        → last slot 23:00, game ends 00:00 (actual close 01:00)
-- Sat (6): 09:00–23:59        → last slot 23:00, game ends 00:00 (actual close 01:00)
-- ⚠️ Late-night slots after midnight require manual creation or schema extension

-- West branch
INSERT INTO branch_hours (branch_id, day_of_week, open_time, close_time)
SELECT
  '00000000-0000-0000-0000-000000000001',
  day_num,
  '09:00'::TIME,
  CASE WHEN day_num IN (5, 6) THEN '23:59'::TIME ELSE '23:30'::TIME END
FROM generate_series(0, 6) AS day_num;

-- East branch
INSERT INTO branch_hours (branch_id, day_of_week, open_time, close_time)
SELECT
  '00000000-0000-0000-0000-000000000002',
  day_num,
  '09:00'::TIME,
  CASE WHEN day_num IN (5, 6) THEN '23:59'::TIME ELSE '23:30'::TIME END
FROM generate_series(0, 6) AS day_num;

-- ─── ACTIVITIES ─────────────────────────────────────────────
INSERT INTO activities (branch_id, name, duration_min, buffer_min)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'חדר בריחה', 60, 30),
  ('00000000-0000-0000-0000-000000000001', 'ויקינגים – חץ וקשת', 75, 15), -- 75 min game, slot every 90 min
  ('00000000-0000-0000-0000-000000000001', 'מציאות מדומה VR', 60, 15),
  ('00000000-0000-0000-0000-000000000002', 'חדר בריחה', 60, 30);

-- ─── SLOT GENERATION FUNCTION ───────────────────────────────
-- Generates 90-min interval slots (60 min game + 30 min buffer)
CREATE OR REPLACE FUNCTION generate_slots_for_room(
  p_room_id    UUID,
  p_branch_id  UUID,
  p_days       INT DEFAULT 60
) RETURNS INT AS $$
DECLARE
  v_day         DATE;
  v_day_of_week INT;
  v_open        TIME;
  v_close       TIME;
  v_slot_start  TIMESTAMPTZ;
  v_slot_end    TIMESTAMPTZ;
  v_count       INT := 0;
  v_tz          TEXT;
BEGIN
  SELECT timezone INTO v_tz FROM branches WHERE id = p_branch_id;

  FOR v_day IN
    SELECT generate_series(CURRENT_DATE, CURRENT_DATE + p_days - 1, '1 day'::INTERVAL)::DATE
  LOOP
    v_day_of_week := EXTRACT(DOW FROM v_day)::INT;

    SELECT open_time, close_time
      INTO v_open, v_close
      FROM branch_hours
     WHERE branch_id = p_branch_id AND day_of_week = v_day_of_week;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_slot_start := (v_day || ' ' || v_open)::TIMESTAMPTZ AT TIME ZONE v_tz;

    WHILE v_slot_start + INTERVAL '60 minutes' <=
          (v_day || ' ' || v_close)::TIMESTAMPTZ AT TIME ZONE v_tz LOOP
      v_slot_end := v_slot_start + INTERVAL '60 minutes';

      INSERT INTO slots (room_id, start_at, end_at, status)
        VALUES (p_room_id, v_slot_start, v_slot_end, 'available')
        ON CONFLICT (room_id, start_at) DO NOTHING;

      v_count := v_count + 1;
      v_slot_start := v_slot_start + INTERVAL '90 minutes';
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ─── GENERATE SLOTS — WEST BRANCH (next 60 days) ────────────
-- ויקינגים: 75-min game, slot every 90 min
SELECT generate_activity_slots('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 75, 90, 60); -- ויקינגים

SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 60); -- אנתרקס
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 60); -- הפרופסור המפוזר
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 60); -- שרלוק הולמס
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 60); -- מסעות גוליבר
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 60); -- הקוסם מארץ עוץ
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 60); -- אוז
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 60); -- מציאות מדומה VR

-- ─── GENERATE SLOTS — EAST BRANCH (next 60 days) ────────────
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000002', 60); -- הקלף של ג'ק
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002', 60); -- שוקולד של טדי
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 60); -- השאגה המסתורית
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', 60); -- השאגה האפלה
SELECT generate_slots_for_room('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 60); -- מיתוס

-- ─── OPENING TASK TEMPLATES ─────────────────────────────────
INSERT INTO task_templates (branch_id, type, items_json)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'opening',
   '[
     {"order":1,"text":"בדיקת כל החדרים וציוד"},
     {"order":2,"text":"הדלקת מערכות תאורה וסאונד"},
     {"order":3,"text":"ספירת קופה פתיחה"},
     {"order":4,"text":"בדיקת חיבור WhatsApp"},
     {"order":5,"text":"עדכון לוח משימות יומי"},
     {"order":6,"text":"בדיקת חיבור Wi-Fi"}
   ]'::JSONB),

  ('00000000-0000-0000-0000-000000000001', 'closing',
   '[
     {"order":1,"text":"ספירת קופה סגירה"},
     {"order":2,"text":"ניקוי וסידור החדרים"},
     {"order":3,"text":"כיבוי מערכות תאורה וסאונד"},
     {"order":4,"text":"נעילת מתחם"},
     {"order":5,"text":"שליחת דוח סיכום יום"}
   ]'::JSONB),

  ('00000000-0000-0000-0000-000000000002', 'opening',
   '[
     {"order":1,"text":"בדיקת כל החדרים וציוד"},
     {"order":2,"text":"הדלקת מערכות תאורה וסאונד"},
     {"order":3,"text":"ספירת קופה פתיחה"},
     {"order":4,"text":"בדיקת חיבור WhatsApp"},
     {"order":5,"text":"עדכון לוח משימות יומי"}
   ]'::JSONB),

  ('00000000-0000-0000-0000-000000000002', 'closing',
   '[
     {"order":1,"text":"ספירת קופה סגירה"},
     {"order":2,"text":"ניקוי וסידור החדרים"},
     {"order":3,"text":"כיבוי מערכות תאורה וסאונד"},
     {"order":4,"text":"נעילת מתחם"},
     {"order":5,"text":"שליחת דוח סיכום יום"}
   ]'::JSONB);

-- ─── OPERATOR INFO PLACEHOLDERS ─────────────────────────────
INSERT INTO operator_info (room_id, content_html)
SELECT id, '<p>מידע למפעיל עבור ' || name || '</p>'
FROM rooms;

-- ─── GIFT VOUCHER TYPES ─────────────────────────────────────
-- ⚠️ Update prices to match your actual pricing
INSERT INTO gift_voucher_types (name, price, description)
VALUES
  ('אנתרקס — 4 משתתפים',        520, 'שובר לחדר אנתרקס עבור 4 משתתפים'),
  ('שרלוק הולמס — 4 משתתפים',   520, 'שובר לחדר שרלוק הולמס עבור 4 משתתפים'),
  ('מסעות גוליבר — 4 משתתפים',  520, 'שובר לחדר מסעות גוליבר עבור 4 משתתפים'),
  ('הקלף של ג''ק — 4 משתתפים',  520, 'שובר לחדר הקלף של ג''ק עבור 4 משתתפים'),
  ('שוקולד של טדי — 4 משתתפים', 520, 'שובר לחדר שוקולד של טדי עבור 4 משתתפים'),
  ('מיתוס — 4 משתתפים',         600, 'שובר לחדר מיתוס עבור 4 משתתפים (ללא הנחות)'),
  ('שובר כללי ₪500',            500, 'שובר מתנה לשימוש בכל חדר');

-- ─── ISRAELI HOLIDAYS 2025-2026 ─────────────────────────────
INSERT INTO holiday_calendar (name, type, starts_at, ends_at, overtime_pct)
VALUES
  ('ערב ראש השנה',           'holiday', '2025-09-22 18:00+03', '2025-09-23 00:00+03', 150),
  ('ראש השנה א׳',            'holiday', '2025-09-23 00:00+03', '2025-09-24 00:00+03', 200),
  ('ראש השנה ב׳',            'holiday', '2025-09-24 00:00+03', '2025-09-25 00:00+03', 200),
  ('ערב יום כיפור',          'holiday', '2025-10-01 18:00+03', '2025-10-02 00:00+03', 150),
  ('יום כיפור',              'holiday', '2025-10-02 00:00+03', '2025-10-03 00:00+03', 200),
  ('ערב סוכות',              'holiday', '2025-10-06 18:00+03', '2025-10-07 00:00+03', 150),
  ('סוכות',                  'holiday', '2025-10-07 00:00+03', '2025-10-08 00:00+03', 200),
  ('הושענא רבה + שמחת תורה', 'holiday', '2025-10-13 18:00+03', '2025-10-14 00:00+03', 150),
  ('שמחת תורה',              'holiday', '2025-10-14 00:00+03', '2025-10-15 00:00+03', 200),
  ('חנוכה',                  'special', '2025-12-14 00:00+02', '2025-12-22 23:59+02', 100),
  ('ערב פורים',              'special', '2026-03-12 18:00+02', '2026-03-13 00:00+02', 150),
  ('פורים',                  'holiday', '2026-03-13 00:00+02', '2026-03-14 00:00+02', 200),
  ('ערב פסח',                'holiday', '2026-04-01 18:00+03', '2026-04-02 00:00+03', 150),
  ('פסח א׳',                 'holiday', '2026-04-02 00:00+03', '2026-04-03 00:00+03', 200),
  ('פסח ז׳',                 'holiday', '2026-04-08 00:00+03', '2026-04-09 00:00+03', 200),
  ('יום העצמאות',            'holiday', '2026-04-29 00:00+03', '2026-04-30 00:00+03', 200),
  ('ערב שבועות',             'holiday', '2026-05-21 18:00+03', '2026-05-22 00:00+03', 150),
  ('שבועות',                 'holiday', '2026-05-22 00:00+03', '2026-05-23 00:00+03', 200),
  ('שינוי שעון קיץ 2026',    'special', '2026-03-27 02:00+02', '2026-03-27 03:00+03', 100),
  ('שינוי שעון חורף 2025',   'special', '2025-10-26 02:00+03', '2025-10-26 01:00+02', 100);
