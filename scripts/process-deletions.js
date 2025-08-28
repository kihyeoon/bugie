#!/usr/bin/env node

/**
 * Account Deletion Processing Script
 *
 * 이 스크립트는 GitHub Actions에서 매일 실행되어:
 * 1. 30일 경과한 탈퇴 계정을 완전 삭제 (profiles 테이블)
 * 2. auth.users에서 해당 계정 삭제
 * 3. 관련 데이터의 created_by를 NULL로 설정하여 데이터는 보존
 * 4. 처리 결과를 로깅
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// 환경 변수 검증
function validateEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // URL 형식 검증
  try {
    new URL(process.env.SUPABASE_URL);
  } catch {
    throw new Error('Invalid SUPABASE_URL format');
  }

  // Service key 형식 검증 (JWT 형식)
  if (!process.env.SUPABASE_SERVICE_KEY.startsWith('eyJ')) {
    throw new Error('Invalid SUPABASE_SERVICE_KEY format (should be a JWT)');
  }
}

// Supabase 클라이언트 생성
function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
}

// 로그 파일 작성
async function writeLog(filename, data) {
  const logPath = path.join(process.cwd(), filename);
  const logData = {
    timestamp: new Date().toISOString(),
    ...data,
  };

  try {
    await fs.writeFile(logPath, JSON.stringify(logData, null, 2));
    console.log(`📝 Log written to ${filename}`);
  } catch (error) {
    console.error(`Failed to write log: ${error.message}`);
  }
}

// 메인 처리 함수
async function processAccountDeletions() {
  const isDryRun = process.env.DRY_RUN === 'true';
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════');
  console.log('🚀 Account Deletion Process Started');
  console.log('═══════════════════════════════════════════');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('───────────────────────────────────────────');

  const supabase = createSupabaseClient();

  try {
    // Step 1: RPC 함수 호출로 완전 삭제 처리
    console.log('\n📝 Step 1: Processing account deletions...');
    const { data: result, error: rpcError } = await supabase.rpc(
      'process_account_deletions'
    );

    if (rpcError) {
      throw new Error(`RPC failed: ${rpcError.message}`);
    }

    if (!result || !result.success) {
      throw new Error(`Processing failed: ${result?.error || 'Unknown error'}`);
    }

    console.log(`✅ Deleted ${result.deleted_count || 0} profiles`);
    console.log(`⏱️  Duration: ${result.duration_ms || 0}ms`);

    // Step 2: Auth 계정 삭제
    let deletedAuthCount = 0;
    const errors = [];

    if (result.profiles_to_delete && result.profiles_to_delete.length > 0) {
      console.log(
        `\n🗑️  Step 2: Deleting ${result.profiles_to_delete.length} auth users...`
      );

      for (const profile of result.profiles_to_delete) {
        const userInfo = `${profile.original_email || profile.user_id}`;

        if (isDryRun) {
          console.log(`  [DRY RUN] Would delete: ${userInfo}`);
          continue;
        }

        try {
          // Auth user 삭제
          const { error: deleteError } = await supabase.auth.admin.deleteUser(
            profile.user_id
          );

          if (deleteError) {
            throw deleteError;
          }

          // 삭제 시점 기록
          const { error: updateError } = await supabase
            .from('deleted_accounts')
            .update({ auth_deleted_at: new Date().toISOString() })
            .eq('original_user_id', profile.user_id);

          if (updateError) {
            console.warn(
              `  ⚠️  Failed to update deletion timestamp: ${updateError.message}`
            );
          }

          deletedAuthCount++;
          console.log(`  ✅ Deleted: ${userInfo}`);
        } catch (err) {
          const errorMsg = err.message || 'Unknown error';
          errors.push({
            user_id: profile.user_id,
            email: profile.original_email,
            error: errorMsg,
          });
          console.error(`  ❌ Failed to delete ${userInfo}: ${errorMsg}`);
        }
      }
    } else {
      console.log('\n✨ No accounts to delete today');
    }

    // Step 3: 작업 로그 저장
    if (!isDryRun) {
      console.log('\n💾 Step 3: Saving job log...');

      const { error: logError } = await supabase
        .from('deletion_job_logs')
        .insert({
          profiles_processed: result.deleted_count || 0,
          deleted_auth_count: deletedAuthCount,
          error_count: errors.length,
          errors: errors.length > 0 ? errors : null,
          details: {
            dry_run: false,
            duration_ms: result.duration_ms,
            total_processed: result.profiles_to_delete?.length || 0,
          },
        });

      if (logError) {
        console.warn(`⚠️  Failed to save job log: ${logError.message}`);
      } else {
        console.log('✅ Job log saved');
      }
    }

    // 실행 시간 계산
    const duration = Date.now() - startTime;

    // 최종 결과 출력
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 Final Report');
    console.log('═══════════════════════════════════════════');
    console.log(`Deleted profiles: ${result.deleted_count || 0}`);
    console.log(`Deleted auth users: ${deletedAuthCount}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Total duration: ${duration}ms`);
    console.log(
      `Status: ${errors.length > 0 ? 'COMPLETED WITH ERRORS' : 'SUCCESS'}`
    );
    console.log('═══════════════════════════════════════════');

    // 로그 파일 생성
    await writeLog('deletion-report.log', {
      success: true,
      dryRun: isDryRun,
      deletedCount: result.deleted_count || 0,
      deletedAuthCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    });

    // 에러가 있으면 부분 실패로 종료
    if (errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);

    // 에러 로그 파일 생성
    await writeLog('deletion-error.log', {
      success: false,
      error: error.message,
      stack: error.stack,
      dryRun: isDryRun,
      duration: Date.now() - startTime,
    });

    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  console.log('🔧 Validating environment...');

  try {
    validateEnvironment();
    console.log('✅ Environment validated\n');

    processAccountDeletions()
      .then(() => {
        console.log('\n👋 Process completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Unexpected error:', error);
        process.exit(1);
      });
  } catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
  }
}

module.exports = { processAccountDeletions };
