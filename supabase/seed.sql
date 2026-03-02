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
  PERFORM create_user_profile(v_husband_id, 'husband@test.com', '김철수');
  PERFORM create_user_profile(v_wife_id, 'wife@test.com', '이영희');

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
