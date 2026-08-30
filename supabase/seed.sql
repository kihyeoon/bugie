-- Bugie 로컬 개발용 시드 데이터
-- npx supabase db reset 시 자동 실행

DO $$
DECLARE
  v_husband_id uuid := '11111111-1111-1111-1111-111111111111';
  v_wife_id uuid := '22222222-2222-2222-2222-222222222222';
  v_shared_ledger_id uuid;
BEGIN
  -- ================================================================
  -- 1. auth.users 생성 (이메일/패스워드 로그인용)
  -- ================================================================
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current,
    email_change, phone_change,
    phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous
  ) VALUES
  (
    v_husband_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'husband@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"김철수"}',
    now(), now(),
    '', '', '', '', '', '', '', '',
    false, false
  ),
  (
    v_wife_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'wife@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"이영희"}',
    now(), now(),
    '', '', '', '', '', '', '', '',
    false, false
  );

  -- ================================================================
  -- 2. 프로필 + 개인 가계부 생성 (create_user_profile RPC 활용)
  -- ================================================================
  -- BGI-38: create_user_profile/setup_new_user 에 소유권 가드(auth.uid()=대상)가 추가돼,
  -- superuser 로 도는 seed 에서는 request.jwt.claims 로 본인 호출을 위장해야 통과한다.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_husband_id)::text, true);
  PERFORM create_user_profile(v_husband_id, 'husband@test.com', '김철수');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_wife_id)::text, true);
  PERFORM create_user_profile(v_wife_id, 'wife@test.com', '이영희');

  -- 이후 직접 INSERT 를 위해 claims 원복
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- ================================================================
  -- 3. 공유 가계부 생성
  -- ================================================================
  INSERT INTO ledgers (name, description, created_by)
  VALUES ('우리집 가계부', '함께 쓰는 공유 가계부', v_husband_id)
  RETURNING id INTO v_shared_ledger_id;

  -- 멤버 추가
  INSERT INTO ledger_members (ledger_id, user_id, role) VALUES
    (v_shared_ledger_id, v_husband_id, 'owner'),
    (v_shared_ledger_id, v_wife_id, 'member');

  -- 카테고리 활성화
  PERFORM activate_default_categories(v_shared_ledger_id);

  -- ================================================================
  -- 4. 샘플 거래 (공유 가계부, 지출 4건 + 수입 2건)
  -- ================================================================
  INSERT INTO transactions (ledger_id, category_id, created_by, paid_by, amount, type, title, transaction_date) VALUES
  -- 지출
  (
    v_shared_ledger_id,
    (SELECT c.id FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '식비' LIMIT 1),
    v_husband_id, v_husband_id,
    35000, 'expense', '주말 외식', CURRENT_DATE - INTERVAL '1 day'
  ),
  (
    v_shared_ledger_id,
    (SELECT c.id FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '교통비' LIMIT 1),
    v_wife_id, v_wife_id,
    1500, 'expense', '버스 출근', CURRENT_DATE - INTERVAL '2 days'
  ),
  (
    v_shared_ledger_id,
    (SELECT c.id FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '쇼핑' LIMIT 1),
    v_husband_id, v_wife_id,
    89000, 'expense', '생필품 구매', CURRENT_DATE - INTERVAL '3 days'
  ),
  (
    v_shared_ledger_id,
    (SELECT c.id FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '식비' LIMIT 1),
    v_wife_id, v_wife_id,
    12000, 'expense', '점심 도시락', CURRENT_DATE
  ),
  -- 수입
  (
    v_shared_ledger_id,
    (SELECT c.id FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '급여' LIMIT 1),
    v_husband_id, NULL,
    3500000, 'income', '3월 급여', CURRENT_DATE - INTERVAL '5 days'
  ),
  (
    v_shared_ledger_id,
    (SELECT c.id FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '용돈/선물' LIMIT 1),
    v_wife_id, NULL,
    100000, 'income', '용돈', CURRENT_DATE - INTERVAL '4 days'
  );

END $$;

-- ================================================================
-- 5. 캘린더 검증용 추가 거래 (PAGE_SIZE=20 초과 + 한 달 분산 + 같은 날 다건)
--    홈 캘린더와 거래 목록 화면 캘린더의 합계 일치 검증을 위해 필요.
-- ================================================================
DO $$
DECLARE
  v_husband_id uuid := '11111111-1111-1111-1111-111111111111';
  v_wife_id uuid := '22222222-2222-2222-2222-222222222222';
  v_shared_ledger_id uuid;
  v_cat_food uuid;
  v_cat_transport uuid;
  v_cat_shopping uuid;
  v_cat_salary uuid;
  v_cat_gift uuid;
BEGIN
  SELECT id INTO v_shared_ledger_id FROM ledgers WHERE name = '우리집 가계부' LIMIT 1;

  SELECT c.id INTO v_cat_food FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '식비' LIMIT 1;
  SELECT c.id INTO v_cat_transport FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '교통비' LIMIT 1;
  SELECT c.id INTO v_cat_shopping FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '쇼핑' LIMIT 1;
  SELECT c.id INTO v_cat_salary FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '급여' LIMIT 1;
  SELECT c.id INTO v_cat_gift FROM categories c JOIN category_templates ct ON c.template_id = ct.id WHERE c.ledger_id = v_shared_ledger_id AND ct.name = '용돈/선물' LIMIT 1;

  INSERT INTO transactions (ledger_id, category_id, created_by, paid_by, amount, type, title, transaction_date) VALUES
    -- 같은 날 3건 — 캘린더 합계 차이 핵심 케이스 (-14일)
    (v_shared_ledger_id, v_cat_food,     v_wife_id,    v_wife_id,    8500,   'expense', '아침 김밥',       CURRENT_DATE - INTERVAL '14 days'),
    (v_shared_ledger_id, v_cat_food,     v_husband_id, v_husband_id, 14200,  'expense', '점심 백반',       CURRENT_DATE - INTERVAL '14 days'),
    (v_shared_ledger_id, v_cat_shopping, v_wife_id,    v_wife_id,    32000,  'expense', '서점',           CURRENT_DATE - INTERVAL '14 days'),
    -- 같은 날 2건 케이스 (-1, -4, -7, -10, -20일)
    (v_shared_ledger_id, v_cat_food,     v_husband_id, v_husband_id, 6800,   'expense', '편의점 간식',     CURRENT_DATE - INTERVAL '1 day'),
    (v_shared_ledger_id, v_cat_transport,v_wife_id,    v_wife_id,    1500,   'expense', '버스',           CURRENT_DATE - INTERVAL '1 day'),
    (v_shared_ledger_id, v_cat_food,     v_wife_id,    v_wife_id,    9500,   'expense', '카페 라떼',       CURRENT_DATE - INTERVAL '4 days'),
    (v_shared_ledger_id, v_cat_food,     v_husband_id, v_husband_id, 25000,  'expense', '점심 회식',       CURRENT_DATE - INTERVAL '4 days'),
    (v_shared_ledger_id, v_cat_food,     v_husband_id, v_husband_id, 7800,   'expense', '아침 토스트',     CURRENT_DATE - INTERVAL '7 days'),
    (v_shared_ledger_id, v_cat_shopping, v_wife_id,    v_wife_id,    48000,  'expense', '의류',           CURRENT_DATE - INTERVAL '7 days'),
    (v_shared_ledger_id, v_cat_food,     v_wife_id,    v_wife_id,    18500,  'expense', '저녁 한식',       CURRENT_DATE - INTERVAL '10 days'),
    (v_shared_ledger_id, v_cat_transport,v_husband_id, v_husband_id, 4200,   'expense', '택시',           CURRENT_DATE - INTERVAL '10 days'),
    (v_shared_ledger_id, v_cat_food,     v_husband_id, v_husband_id, 11000,  'expense', '점심 도시락',     CURRENT_DATE - INTERVAL '20 days'),
    (v_shared_ledger_id, v_cat_shopping, v_wife_id,    v_wife_id,    72000,  'expense', '주방용품',        CURRENT_DATE - INTERVAL '20 days'),
    -- 분산 단건 (월 전체에 흩뿌려 한 달 캘린더가 채워지는지 확인)
    (v_shared_ledger_id, v_cat_food,     v_husband_id, v_husband_id, 13500,  'expense', '저녁 외식',       CURRENT_DATE - INTERVAL '0 days'),
    (v_shared_ledger_id, v_cat_shopping, v_husband_id, v_husband_id, 22000,  'expense', '간식',           CURRENT_DATE - INTERVAL '2 days'),
    (v_shared_ledger_id, v_cat_food,     v_wife_id,    v_wife_id,    9200,   'expense', '베이커리',        CURRENT_DATE - INTERVAL '3 days'),
    (v_shared_ledger_id, v_cat_shopping, v_wife_id,    v_wife_id,    15500,  'expense', '편의점',         CURRENT_DATE - INTERVAL '5 days'),
    (v_shared_ledger_id, v_cat_transport,v_husband_id, v_husband_id, 1500,   'expense', '지하철',         CURRENT_DATE - INTERVAL '6 days'),
    (v_shared_ledger_id, v_cat_food,     v_wife_id,    v_wife_id,    16800,  'expense', '점심',           CURRENT_DATE - INTERVAL '9 days'),
    (v_shared_ledger_id, v_cat_transport,v_wife_id,    v_wife_id,    1500,   'expense', '버스',           CURRENT_DATE - INTERVAL '11 days'),
    (v_shared_ledger_id, v_cat_transport,v_husband_id, v_husband_id, 3300,   'expense', '택시',           CURRENT_DATE - INTERVAL '12 days'),
    (v_shared_ledger_id, v_cat_shopping, v_husband_id, v_husband_id, 26500,  'expense', '생활용품',        CURRENT_DATE - INTERVAL '13 days'),
    (v_shared_ledger_id, v_cat_food,     v_husband_id, v_husband_id, 12500,  'expense', '점심',           CURRENT_DATE - INTERVAL '16 days'),
    (v_shared_ledger_id, v_cat_transport,v_wife_id,    v_wife_id,    1500,   'expense', '버스',           CURRENT_DATE - INTERVAL '18 days'),
    (v_shared_ledger_id, v_cat_food,     v_husband_id, v_husband_id, 8900,   'expense', '아침',           CURRENT_DATE - INTERVAL '19 days'),
    (v_shared_ledger_id, v_cat_shopping, v_wife_id,    v_wife_id,    34000,  'expense', '잡화',           CURRENT_DATE - INTERVAL '21 days'),
    (v_shared_ledger_id, v_cat_food,     v_wife_id,    v_wife_id,    10500,  'expense', '점심',           CURRENT_DATE - INTERVAL '22 days'),
    (v_shared_ledger_id, v_cat_food,     v_husband_id, v_husband_id, 7200,   'expense', '간식',           CURRENT_DATE - INTERVAL '24 days'),
    (v_shared_ledger_id, v_cat_transport,v_husband_id, v_husband_id, 5500,   'expense', '택시',           CURRENT_DATE - INTERVAL '26 days'),
    (v_shared_ledger_id, v_cat_transport,v_wife_id,    v_wife_id,    1500,   'expense', '버스',           CURRENT_DATE - INTERVAL '27 days'),
    -- 수입 (-15: 보너스, -25: 용돈)
    (v_shared_ledger_id, v_cat_salary,   v_wife_id,    NULL,         500000, 'income',  '성과급',         CURRENT_DATE - INTERVAL '15 days'),
    (v_shared_ledger_id, v_cat_gift,     v_husband_id, NULL,         50000,  'income',  '명절 용돈',      CURRENT_DATE - INTERVAL '25 days');
END $$;
