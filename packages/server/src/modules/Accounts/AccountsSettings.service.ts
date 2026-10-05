import { Inject, Injectable } from '@nestjs/common';
import { SettingsStore } from '../Settings/SettingsStore';
import { SETTINGS_PROVIDER } from '../Settings/Settings.types';

export interface IAccountsSettings {
  accountCodeRequired: boolean;
  accountCodeUnique: boolean;
}

@Injectable()
export class AccountsSettingsService {
  constructor(
    @Inject(SETTINGS_PROVIDER)
    private readonly settingsStore: () => SettingsStore,
  ) {}

  /**
   * Retrieves account settings (account code required, account code unique).
   */
  public async getAccountsSettings(): Promise<IAccountsSettings> {
    const settingsStore = await this.settingsStore();
    return {
      accountCodeRequired: settingsStore.get(
        { group: 'accounts', key: 'account_code_required' },
        false,
      ),
      accountCodeUnique: settingsStore.get(
        { group: 'accounts', key: 'account_code_unique' },
        true,
      ),
    };
  }
}
