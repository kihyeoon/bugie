import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  // 환경 변수 확인
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ 
      error: '환경 변수가 설정되지 않았습니다.',
      env: {
        url: supabaseUrl ? '설정됨' : '없음',
        key: supabaseKey ? '설정됨' : '없음'
      },
      hint: '.env.local 파일이 apps/web 디렉토리에 있는지 확인하세요.'
    }, { status: 500 })
  }
  
  try {
    const supabase = await createClient()
    
    // 카테고리 템플릿 조회 테스트
    const { data: templates, error } = await supabase
      .from('category_templates')
      .select('*')
      .order('type', { ascending: true })
      .order('sort_order', { ascending: true })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({
      message: '데이터베이스 연결 성공!',
      categoryTemplates: templates,
      totalCount: templates?.length || 0
    })
  } catch (error) {
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}