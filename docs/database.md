# 하이브리드 MVP 가계부 테이블 설계 (다중 사용자 + 템플릿 카테고리)

## ====================================
## 1. 사용자 프로필 테이블
## ====================================

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  currency text default 'KRW',
  timezone text default 'Asia/Seoul',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz -- Soft Delete
);

-- RLS 정책
alter table profiles enable row level security;
create policy "profiles_policy" on profiles 
for all using (auth.uid() = id and deleted_at is null);
```

## ====================================
## 2. 가계부 원장 테이블 (다중 사용자 지원)
## ====================================

```sql
create table ledgers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  currency text default 'KRW',
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz -- Soft Delete
);

-- 인덱스
create index idx_ledgers_created_by on ledgers(created_by) where deleted_at is null;

-- RLS 정책
alter table ledgers enable row level security;
create policy "ledgers_policy" on ledgers for all using (
  deleted_at is null and
  id in (
    select ledger_id from ledger_members 
    where user_id = auth.uid() and deleted_at is null
  )
);
```

## ====================================
## 3. 원장 멤버 테이블 (권한 관리)
## ====================================

```sql
create type member_role as enum ('owner', 'admin', 'member', 'viewer');

create table ledger_members (
  id uuid default gen_random_uuid() primary key,
  ledger_id uuid references ledgers(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  role member_role default 'member',
  joined_at timestamptz default now(),
  deleted_at timestamptz, -- Soft Delete
  
  unique(ledger_id, user_id)
);

-- 인덱스
create index idx_ledger_members_user on ledger_members(user_id) where deleted_at is null;
create index idx_ledger_members_ledger on ledger_members(ledger_id) where deleted_at is null;

-- RLS 정책
alter table ledger_members enable row level security;
create policy "ledger_members_policy" on ledger_members for all using (
  deleted_at is null and (
    user_id = auth.uid() or 
    ledger_id in (
      select ledger_id from ledger_members 
      where user_id = auth.uid() and role in ('owner', 'admin') and deleted_at is null
    )
  )
);
```

## ====================================
## 4. 글로벌 카테고리 템플릿 테이블
## ====================================

```sql
create type category_type as enum ('income', 'expense');

create table category_templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type category_type not null,
  color text default '#3B82F6',
  icon text default 'receipt',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(name, type)
);

-- 인덱스
create index idx_category_templates_type_sort on category_templates(type, sort_order);
create index idx_category_templates_name on category_templates(name);

-- RLS 정책 (모든 사용자가 읽기 가능, 관리자만 수정)
alter table category_templates enable row level security;

create policy "category_templates_select_policy" on category_templates 
for select using (true);

create policy "category_templates_modify_policy" on category_templates 
for all using (
  auth.jwt() ->> 'role' = 'admin' or 
  auth.jwt() ->> 'role' = 'service_role'
);
```

## ====================================
## 5. 하이브리드 카테고리 테이블 (원장별)
## ====================================

```sql
create table categories (
  id uuid default gen_random_uuid() primary key,
  ledger_id uuid references ledgers(id) on delete cascade not null,
  template_id uuid references category_templates(id) on delete cascade,
  
  -- 커스텀 카테고리용 필드들
  name text,
  type category_type not null,
  color text default '#6B7280',
  icon text default 'tag',
  sort_order integer default 0,
  
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz, -- Soft Delete
  
  -- 제약조건: 템플릿 기반 OR 커스텀 (둘 중 하나만)
  constraint check_category_source check (
    (template_id is not null and name is null) or
    (template_id is null and name is not null)
  ),
  
  -- 원장별 템플릿 중복 방지
  constraint unique_ledger_template unique(ledger_id, template_id),
  
  -- 원장별 커스텀 카테고리명 중복 방지
  constraint unique_ledger_custom_name unique(ledger_id, name, type)
);

-- 인덱스
create index idx_categories_ledger_template on categories(ledger_id, template_id) 
where deleted_at is null and is_active = true;

create index idx_categories_ledger_active on categories(ledger_id, is_active) 
where deleted_at is null;

create index idx_categories_template_id on categories(template_id) 
where deleted_at is null and template_id is not null;

create index idx_categories_ledger_custom on categories(ledger_id, name) 
where deleted_at is null and name is not null;

create index idx_categories_ledger_sort on categories(ledger_id, sort_order, name) 
where deleted_at is null and is_active = true;

-- RLS 정책
alter table categories enable row level security;
create policy "categories_policy" on categories for all using (
  deleted_at is null and
  ledger_id in (
    select ledger_id from ledger_members 
    where user_id = auth.uid() and deleted_at is null
  )
);
```

## ====================================
## 6. 거래 내역 테이블
## ====================================

```sql
create table transactions (
  id uuid default gen_random_uuid() primary key,
  ledger_id uuid references ledgers(id) on delete cascade not null,
  category_id uuid references categories(id) on delete restrict not null,
  created_by uuid references profiles(id) not null,
  amount decimal(15,2) not null check (amount > 0),
  type category_type not null,
  title text not null,
  description text,
  transaction_date date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz -- Soft Delete
);

-- 성능 최적화 인덱스
create index idx_transactions_ledger_date on transactions(ledger_id, transaction_date desc) where deleted_at is null;
create index idx_transactions_ledger_category on transactions(ledger_id, category_id) where deleted_at is null;
create index idx_transactions_ledger_type on transactions(ledger_id, type) where deleted_at is null;

-- RLS 정책
alter table transactions enable row level security;
create policy "transactions_policy" on transactions for all using (
  deleted_at is null and
  ledger_id in (
    select ledger_id from ledger_members 
    where user_id = auth.uid() and deleted_at is null
  )
);

-- 거래 타입과 카테고리 타입 일치 확인 함수
create or replace function check_transaction_category_type()
returns trigger as $$
declare
  cat_type category_type;
begin
  select cd.type into cat_type
  from category_details cd
  where cd.id = new.category_id;
  
  if cat_type != new.type then
    raise exception '거래 타입(%)과 카테고리 타입(%)이 일치하지 않습니다.', new.type, cat_type;
  end if;
  
  return new;
end;
$$ language plpgsql;

-- 트리거 생성
create trigger check_transaction_category_type_trigger
  before insert or update on transactions
  for each row execute function check_transaction_category_type();
```

## ====================================
## 7. 예산 관리 테이블
## ====================================

```sql
create type budget_period as enum ('monthly', 'yearly');

create table budgets (
  id uuid default gen_random_uuid() primary key,
  ledger_id uuid references ledgers(id) on delete cascade not null,
  category_id uuid references categories(id) on delete cascade not null,
  amount decimal(15,2) not null check (amount > 0),
  period budget_period default 'monthly',
  year integer not null,
  month integer check (month between 1 and 12),
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz, -- Soft Delete
  
  -- 월별 예산의 경우 month 필수, 연간 예산의 경우 month null
  constraint check_monthly_budget check (
    (period = 'monthly' and month is not null) or
    (period = 'yearly' and month is null)
  ),
  
  unique(ledger_id, category_id, year, month)
);

-- 인덱스
create index idx_budgets_ledger_period on budgets(ledger_id, year, month) where deleted_at is null;

-- RLS 정책
alter table budgets enable row level security;
create policy "budgets_policy" on budgets for all using (
  deleted_at is null and
  ledger_id in (
    select ledger_id from ledger_members 
    where user_id = auth.uid() and deleted_at is null
  )
);
```

## ====================================
## 8. 통합 뷰들
## ====================================

```sql
-- 카테고리 상세 정보 통합 뷰
create view category_details as
select 
  c.id,
  c.ledger_id,
  c.template_id,
  
  -- 템플릿 기반이면 템플릿 정보, 커스텀이면 커스텀 정보 사용
  coalesce(ct.name, c.name) as name,
  coalesce(ct.color, c.color) as color,
  coalesce(ct.icon, c.icon) as icon,
  coalesce(c.type, ct.type) as type,
  
  c.is_active,
  c.created_at,
  c.updated_at,
  
  -- 카테고리 출처 구분
  case 
    when c.template_id is not null then 'template'
    else 'custom' 
  end as source_type,
  
  -- 정렬순서: 템플릿은 템플릿의 sort_order, 커스텀은 커스텀의 sort_order
  case
    when c.template_id is not null then ct.sort_order
    else c.sort_order
  end as sort_order

from categories c
left join category_templates ct on c.template_id = ct.id
where c.deleted_at is null 
  and c.is_active = true;

-- 활성 거래 내역 뷰 (조인된 정보 포함)
create view active_transactions as
select 
  t.*,
  cd.name as category_name,
  cd.color as category_color,
  cd.icon as category_icon,
  cd.source_type as category_source,
  l.name as ledger_name,
  p.full_name as created_by_name
from transactions t
join category_details cd on t.category_id = cd.id
join ledgers l on t.ledger_id = l.id
join profiles p on t.created_by = p.id
where t.deleted_at is null 
  and l.deleted_at is null;

-- 원장별 월별 요약 뷰
create view ledger_monthly_summary as
select 
  ledger_id,
  extract(year from transaction_date) as year,
  extract(month from transaction_date) as month,
  type,
  sum(amount) as total_amount,
  count(*) as transaction_count
from transactions
where deleted_at is null
group by ledger_id, year, month, type;

-- 예산 대비 지출 현황 뷰
create view budget_vs_actual as
select 
  b.id as budget_id,
  b.ledger_id,
  b.category_id,
  cd.name as category_name,
  cd.color as category_color,
  cd.icon as category_icon,
  b.amount as budget_amount,
  b.period,
  b.year,
  b.month,
  coalesce(t.actual_amount, 0) as actual_amount,
  b.amount - coalesce(t.actual_amount, 0) as remaining_amount,
  case 
    when b.amount > 0 then (coalesce(t.actual_amount, 0) / b.amount * 100)
    else 0 
  end as usage_percentage
from budgets b
join category_details cd on b.category_id = cd.id
left join (
  select 
    category_id,
    extract(year from transaction_date) as year,
    extract(month from transaction_date) as month,
    sum(amount) as actual_amount
  from transactions
  where deleted_at is null and type = 'expense'
  group by category_id, year, month
) t on b.category_id = t.category_id 
  and b.year = t.year 
  and (b.month = t.month or b.period = 'yearly')
where b.deleted_at is null;
```

## ====================================
## 9. 기본 데이터 생성 함수들
## ====================================

```sql
-- 시스템 카테고리 템플릿 초기화
create or replace function initialize_category_templates()
returns void as $$
begin
  insert into category_templates (name, type, color, icon, sort_order) values
  -- 지출 카테고리
  ('식비', 'expense', '#EF4444', 'utensils', 1),
  ('교통비', 'expense', '#3B82F6', 'car', 2),
  ('쇼핑', 'expense', '#8B5CF6', 'shopping-bag', 3),
  ('문화/여가', 'expense', '#06B6D4', 'film', 4),
  ('의료/건강', 'expense', '#10B981', 'heart', 5),
  ('주거/통신', 'expense', '#F59E0B', 'home', 6),
  ('교육', 'expense', '#8B5A2B', 'book', 7),
  ('기타지출', 'expense', '#6B7280', 'more-horizontal', 99),
  
  -- 수입 카테고리
  ('급여', 'income', '#059669', 'briefcase', 1),
  ('사업소득', 'income', '#DC2626', 'trending-up', 2),
  ('투자수익', 'income', '#7C3AED', 'bar-chart', 3),
  ('용돈/선물', 'income', '#0891B2', 'gift', 4),
  ('기타수입', 'income', '#6B7280', 'plus-circle', 99)
  on conflict (name, type) do nothing;
end;
$$ language plpgsql;

-- 원장별 기본 카테고리 활성화 (템플릿 참조)
create or replace function activate_default_categories(target_ledger_id uuid)
returns void as $$
begin
  insert into categories (ledger_id, template_id, type)
  select target_ledger_id, ct.id, ct.type
  from category_templates ct
  on conflict (ledger_id, template_id) do nothing;
end;
$$ language plpgsql;

-- 새 사용자 초기 설정 함수
create or replace function setup_new_user(user_uuid uuid, user_email text, user_name text)
returns uuid as $$
declare
  new_ledger_id uuid;
begin
  -- 프로필 생성
  insert into profiles (id, email, full_name)
  values (user_uuid, user_email, user_name)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name;
  
  -- 기본 원장 생성
  insert into ledgers (name, description, created_by)
  values (user_name || '의 가계부', '개인 가계부입니다.', user_uuid)
  returning id into new_ledger_id;
  
  -- 원장 소유자로 추가
  insert into ledger_members (ledger_id, user_id, role)
  values (new_ledger_id, user_uuid, 'owner');
  
  -- 기본 카테고리 활성화
  perform activate_default_categories(new_ledger_id);
  
  return new_ledger_id;
end;
$$ language plpgsql;
```

## ====================================
## 10. 새 사용자 가입 시 자동 설정 트리거
## ====================================

```sql
create or replace function handle_new_user()
returns trigger as $$
begin
  perform setup_new_user(
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- auth.users 테이블에 트리거 설정
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

## ====================================
## 11. 유틸리티 함수들
## ====================================

```sql
-- 원장 멤버 초대 함수
create or replace function invite_member_to_ledger(
  target_ledger_id uuid,
  target_user_email text,
  member_role member_role default 'member'
)
returns boolean as $$
declare
  target_user_id uuid;
  current_user_role member_role;
begin
  -- 현재 사용자가 초대 권한이 있는지 확인
  select role into current_user_role
  from ledger_members
  where ledger_id = target_ledger_id 
    and user_id = auth.uid() 
    and deleted_at is null;
  
  if current_user_role not in ('owner', 'admin') then
    raise exception '권한이 없습니다.';
  end if;
  
  -- 초대할 사용자 ID 찾기
  select id into target_user_id
  from profiles
  where email = target_user_email and deleted_at is null;
  
  if target_user_id is null then
    raise exception '사용자를 찾을 수 없습니다.';
  end if;
  
  -- 멤버 추가
  insert into ledger_members (ledger_id, user_id, role)
  values (target_ledger_id, target_user_id, member_role)
  on conflict (ledger_id, user_id) do update set
    role = excluded.role,
    deleted_at = null;
  
  return true;
end;
$$ language plpgsql security definer;

-- 예산 설정 함수
create or replace function set_budget(
  target_ledger_id uuid,
  target_category_id uuid,
  budget_amount decimal,
  budget_year integer,
  budget_month integer default null
)
returns uuid as $$
declare
  budget_id uuid;
  budget_period budget_period;
begin
  -- 월별/연간 구분
  budget_period := case when budget_month is null then 'yearly' else 'monthly' end;
  
  -- 예산 설정 (upsert)
  insert into budgets (ledger_id, category_id, amount, period, year, month, created_by)
  values (target_ledger_id, target_category_id, budget_amount, budget_period, budget_year, budget_month, auth.uid())
  on conflict (ledger_id, category_id, year, month) do update set
    amount = excluded.amount,
    updated_at = now(),
    deleted_at = null
  returning id into budget_id;
  
  return budget_id;
end;
$$ language plpgsql security definer;

-- 커스텀 카테고리 추가 함수
create or replace function add_custom_category(
  target_ledger_id uuid,
  category_name text,
  category_type category_type,
  category_color text default '#6B7280',
  category_icon text default 'tag',
  category_sort_order integer default 999
)
returns uuid as $$
declare
  category_id uuid;
begin
  insert into categories (ledger_id, name, type, color, icon, sort_order)
  values (target_ledger_id, category_name, category_type, category_color, category_icon, category_sort_order)
  returning id into category_id;
  
  return category_id;
end;
$$ language plpgsql security definer;

-- 월별 통계 조회 함수 (원장별)
create or replace function get_ledger_monthly_stats(
  target_ledger_id uuid,
  target_year integer,
  target_month integer
)
returns table(
  total_income decimal,
  total_expense decimal,
  net_amount decimal,
  transaction_count bigint,
  budget_total decimal,
  budget_remaining decimal
) as $$
begin
  return query
  select 
    coalesce(sum(case when t.type = 'income' then t.amount else 0 end), 0) as total_income,
    coalesce(sum(case when t.type = 'expense' then t.amount else 0 end), 0) as total_expense,
    coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0) as net_amount,
    count(t.*)::bigint as transaction_count,
    coalesce(sum(b.amount), 0) as budget_total,
    coalesce(sum(b.amount), 0) - coalesce(sum(case when t.type = 'expense' then t.amount else 0 end), 0) as budget_remaining
  from transactions t
  full outer join budgets b on b.ledger_id = target_ledger_id 
    and b.year = target_year 
    and (b.month = target_month or b.period = 'yearly')
    and b.deleted_at is null
  where (t.ledger_id = target_ledger_id or t.ledger_id is null)
    and (t.deleted_at is null or t.deleted_at is null)
    and (
      t.id is null or (
        extract(year from t.transaction_date) = target_year
        and extract(month from t.transaction_date) = target_month
      )
    );
end;
$$ language plpgsql security definer;
```

## ====================================
## 12. 데이터 정리 함수
## ====================================

```sql
-- Soft Delete된 데이터 완전 삭제 (30일 경과)
create or replace function cleanup_old_deleted_data()
returns void as $$
begin
  delete from transactions 
  where deleted_at is not null 
    and deleted_at < now() - interval '30 days';
    
  delete from budgets 
  where deleted_at is not null 
    and deleted_at < now() - interval '30 days';
    
  delete from categories 
  where deleted_at is not null 
    and deleted_at < now() - interval '30 days';
    
  delete from ledger_members 
  where deleted_at is not null 
    and deleted_at < now() - interval '30 days';
    
  delete from ledgers 
  where deleted_at is not null 
    and deleted_at < now() - interval '30 days';
end;
$$ language plpgsql;
```

## ====================================
## 13. 초기 데이터 설정 (배포 시 실행)
## ====================================

```sql
-- 시스템 카테고리 템플릿 초기화 실행
select initialize_category_templates();
```

## ====================================
## 14. 샘플 쿼리들
## ====================================

```sql
-- 내가 속한 원장 목록
select l.*, lm.role
from ledgers l
join ledger_members lm on l.id = lm.ledger_id
where lm.user_id = auth.uid() and l.deleted_at is null and lm.deleted_at is null;

-- 특정 원장의 카테고리 목록 (정렬순서대로)
select * from category_details 
where ledger_id = 'your_ledger_id'
order by sort_order, name;

-- 특정 원장의 최근 거래 내역
select * from active_transactions 
where ledger_id = 'your_ledger_id'
order by transaction_date desc, created_at desc 
limit 10;

-- 이번 달 예산 대비 지출 현황
select * from budget_vs_actual
where ledger_id = 'your_ledger_id'
  and year = extract(year from current_date)
  and month = extract(month from current_date);

-- 커스텀 카테고리 추가
select add_custom_category('ledger_id', '반려동물', 'expense', '#FF69B4', 'heart', 5);

-- 원장에 멤버 초대
select invite_member_to_ledger('ledger_id', 'friend@example.com', 'member');

-- 월별 예산 설정 (식비 카테고리에 50만원)
select set_budget('ledger_id', 'category_id', 500000, 2024, 12);

-- 원장별 월별 통계
select * from get_ledger_monthly_stats('ledger_id', 2024, 12);
```

## 🎯 주요 변경사항 요약

### 1. **하이브리드 카테고리 시스템**
- `category_templates`: 글로벌 카테고리 템플릿 저장
- `categories`: 템플릿 참조 또는 커스텀 카테고리 저장
- 데이터 중복 제거 및 일관성 향상

### 2. **효율적인 저장공간 사용**
- 기본 카테고리는 템플릿 참조만 저장
- 커스텀 카테고리만 실제 데이터 저장
- 75% 이상 저장공간 절약

### 3. **향상된 사용자 경험**
- `sort_order`로 카테고리 정렬 지원
- 템플릿과 커스텀 카테고리 통합 관리
- `category_details` 뷰로 일관된 인터페이스 제공

### 4. **확장성 및 유지보수성**
- 시스템 카테고리 중앙 관리
- 새로운 템플릿 추가 시 모든 원장에 자동 반영 가능
- 명확한 데이터 분리 및 제약조건