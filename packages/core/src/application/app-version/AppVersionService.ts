import type {
  AppVersionPolicyRepository,
  UpdatePrompt,
} from '../../domain/app-version/types';
import { AppVersionRules } from '../../domain/app-version/rules';

/**
 * 새 버전 안내 (BGI-52)
 * 로그인 없이도 호출된다(강제 업데이트는 로그인 화면에서도 막아야 한다).
 */
export class AppVersionService {
  constructor(private policyRepo: AppVersionPolicyRepository) {}

  async getUpdatePrompt(
    platform: string,
    currentVersion: string | undefined
  ): Promise<UpdatePrompt> {
    const policy = await this.policyRepo.findByPlatform(platform);
    return AppVersionRules.evaluate(currentVersion, policy);
  }
}
