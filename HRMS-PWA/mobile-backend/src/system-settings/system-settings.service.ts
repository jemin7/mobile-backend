import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export type CompanySystemSettings = {
  smtp?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
  };
  sms?: {
    provider?: string;
    senderId?: string;
    apiKey?: string;
  };
  retention?: {
    companyRecordsDays?: number;
    systemLogsDays?: number;
  };
  integrationProvider?: string;
};

@Injectable()
export class SystemSettingsService {
  private filePath() {
    const dir = join(process.cwd(), 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return join(dir, 'company-system-settings.json');
  }

  private readAll(): Record<string, CompanySystemSettings> {
    const path = this.filePath();
    if (!existsSync(path)) return {};
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return {};
    }
  }

  get(companyID: number): CompanySystemSettings {
    return this.readAll()[String(companyID)] || {};
  }

  save(companyID: number, settings: CompanySystemSettings): CompanySystemSettings {
    const all = this.readAll();
    const next = { ...(all[String(companyID)] || {}), ...settings };
    all[String(companyID)] = next;
    writeFileSync(this.filePath(), JSON.stringify(all, null, 2));
    return next;
  }

  firstSmtp() {
    const all = this.readAll();
    for (const settings of Object.values(all)) {
      if (settings.smtp?.host && settings.smtp.user && settings.smtp.pass) return settings.smtp;
    }
    return null;
  }
}
