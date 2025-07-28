import type { Session } from '@repo/types';

/**
 * 웹뷰에 세션 정보를 주입하기 위한 JavaScript 코드 생성
 */
export const generateSessionInjectionScript = (session: Session | null) => {
  const sessionData = session ? JSON.stringify(session) : 'null';
  
  return `
    (function() {
      // Supabase 설정 정보 주입
      window.supabaseUrl = '${process.env.EXPO_PUBLIC_SUPABASE_URL}';
      window.supabaseAnonKey = '${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}';
      window.supabaseSession = ${sessionData};
      
      // 세션 업데이트 이벤트 리스너
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'SESSION_UPDATE') {
          window.supabaseSession = event.data.session;
          // 웹 앱에 세션 업데이트 알림
          window.dispatchEvent(new CustomEvent('supabase-session-update', {
            detail: { session: event.data.session }
          }));
        }
      });
      
      // 웹뷰 준비 완료 신호
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'WEBVIEW_READY',
        hasSession: !!window.supabaseSession
      }));
    })();
    true;
  `;
};

/**
 * 웹뷰에서 네이티브로 보내는 메시지 타입
 */
export type WebViewMessage = 
  | { type: 'WEBVIEW_READY'; hasSession: boolean }
  | { type: 'REQUEST_SESSION' }
  | { type: 'SIGN_OUT' }
  | { type: 'NAVIGATE'; path: string }
  | { type: 'ERROR'; error: string };

/**
 * 네이티브에서 웹뷰로 보내는 메시지 타입
 */
export type NativeMessage =
  | { type: 'SESSION_UPDATE'; session: Session | null }
  | { type: 'NAVIGATION_READY' };