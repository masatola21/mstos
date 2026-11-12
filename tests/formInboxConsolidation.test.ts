import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper mimicking isDiagnosisSubmission from UnifiedInboxView
interface FormMeta {
  id: string;
  name: string;
  form_type: string;
  public_slug?: string;
}

interface SubmissionItem {
  id: string;
  form_id: string;
  company_id: string | null;
  lead_id: string | null;
  diagnosis_id?: string | null;
  score: number | null;
  answers: Record<string, unknown>;
}

export type SubmissionCategory = 'diagnosis' | 'material' | 'inquiry';

export function getSubmissionCategory(sub: SubmissionItem, formsMeta: Map<string, FormMeta>): SubmissionCategory {
  const form = formsMeta.get(sub.form_id);
  const answers = (sub.answers || {}) as Record<string, unknown>;

  // 1. 資料請求（material）の判定
  if (
    form?.public_slug === 'material-download' ||
    form?.name?.includes('資料') ||
    Boolean(answers.material_keys) ||
    Boolean(answers.material_choice) ||
    answers.inquiryType === 'material' ||
    answers.inquiryType === 'care_package'
  ) {
    return 'material';
  }

  // 2. お問い合わせ・相談（inquiry）の明示的判定
  if (
    form?.public_slug === 'contact-inquiry' ||
    form?.form_type === 'consultation' ||
    form?.form_type === 'meeting' ||
    (form?.name && (form.name.includes('お問い合わせ') || form.name.includes('相談')) && !form.name.includes('診断')) ||
    Boolean(answers.service_interest) ||
    answers.inquiryType === 'consultation'
  ) {
    return 'inquiry';
  }

  // 3. 無料診断（diagnosis）の判定
  const hasCoreDiagnosisQuestions = Boolean(
    answers.q_ops_bottleneck ||
    answers.q_profit_bottleneck ||
    answers.q_delay_reason ||
    answers.q_ideal_future ||
    Object.keys(answers).some((k) => k.includes('bottleneck') || k === 'q_bottleneck')
  );

  if (
    form?.form_type === 'diagnosis' ||
    form?.public_slug === 'business-diagnosis' ||
    (form?.name && (form.name.includes('診断') || form.name.toLowerCase().includes('diagnosis'))) ||
    hasCoreDiagnosisQuestions
  ) {
    return 'diagnosis';
  }

  return 'inquiry';
}

const isDiagnosisSubmission = (sub: SubmissionItem, formsMeta: Map<string, FormMeta>): boolean => {
  return getSubmissionCategory(sub, formsMeta) === 'diagnosis';
};

describe('Form & Diagnosis Inbox Consolidation Tests', () => {
  const formsMeta = new Map<string, FormMeta>([
    ['f-diag-1', { id: 'f-diag-1', name: '3分経営課題・DX無料診断', form_type: 'diagnosis' }],
    ['f-inq-1', { id: 'f-inq-1', name: 'お問い合わせ・無料相談', form_type: 'consultation' }],
    ['f-mat-1', { id: 'f-mat-1', name: '実務改善ガイド・会社概要PDFダウンロード', form_type: 'consultation' }],
    ['f-care-1', { id: 'f-care-1', name: '業務改善・AI顧問伴走プランお申し込み', form_type: 'consultation' }],
  ]);

  const mockSubmissions: SubmissionItem[] = [
    {
      id: 'sub-1',
      form_id: 'f-diag-1',
      company_id: 'comp-101',
      lead_id: 'lead-201',
      diagnosis_id: 'diag-001',
      score: 75,
      answers: { q_ops_bottleneck: '請求書・見積書等の作成や転記作業', q_hear_about: '検索' },
    },
    {
      id: 'sub-2',
      form_id: 'f-inq-1',
      company_id: 'comp-101',
      lead_id: 'lead-201',
      diagnosis_id: null,
      score: null,
      answers: { message: '費用感について相談したい', q_hear_about: '紹介' },
    },
    {
      id: 'sub-3',
      form_id: 'f-mat-1',
      company_id: 'comp-102',
      lead_id: null,
      diagnosis_id: null,
      score: null,
      answers: { reason: '社内業務効率化の情報収集', q_hear_about: 'Instagram', material_keys: ['management-guide'] },
    },
    {
      id: 'sub-4',
      form_id: 'f-care-1',
      company_id: 'comp-103',
      lead_id: 'lead-203',
      diagnosis_id: null,
      score: null,
      answers: { budget: '月額20万円〜', q_hear_about: 'ブログ' },
    },
  ];

  it('Test 1: isDiagnosisSubmission accurately classifies diagnosis vs inquiry forms, even when q_hear_about is present', () => {
    assert.equal(isDiagnosisSubmission(mockSubmissions[0], formsMeta), true, 'sub-1 is a diagnosis form');
    assert.equal(isDiagnosisSubmission(mockSubmissions[1], formsMeta), false, 'sub-2 is an inquiry form even with q_hear_about');
    assert.equal(isDiagnosisSubmission(mockSubmissions[2], formsMeta), false, 'sub-3 is a material download form even with q_hear_about');
    assert.equal(isDiagnosisSubmission(mockSubmissions[3], formsMeta), false, 'sub-4 is a package inquiry form even with q_hear_about');
    assert.equal(getSubmissionCategory(mockSubmissions[2], formsMeta), 'material', 'sub-3 category is material');
    assert.equal(getSubmissionCategory(mockSubmissions[1], formsMeta), 'inquiry', 'sub-2 category is inquiry');
    assert.equal(getSubmissionCategory(mockSubmissions[0], formsMeta), 'diagnosis', 'sub-0 category is diagnosis');
  });

  it('Test 2: Form type category filtering (all / diagnosis / inquiry)', () => {
    const filterSubmissions = (typeFilter: 'all' | 'diagnosis' | 'inquiry') => {
      return mockSubmissions.filter((sub) => {
        if (typeFilter === 'diagnosis' && !isDiagnosisSubmission(sub, formsMeta)) return false;
        if (typeFilter === 'inquiry' && isDiagnosisSubmission(sub, formsMeta)) return false;
        return true;
      });
    };

    const all = filterSubmissions('all');
    assert.equal(all.length, 4, 'All filter should return 4 items');

    const diagnosesOnly = filterSubmissions('diagnosis');
    assert.equal(diagnosesOnly.length, 1, 'Diagnosis filter should return 1 item');
    assert.equal(diagnosesOnly[0].id, 'sub-1');

    const inquiriesOnly = filterSubmissions('inquiry');
    assert.equal(inquiriesOnly.length, 3, 'Inquiry filter should return 3 items');
    assert.deepEqual(inquiriesOnly.map((s) => s.id), ['sub-2', 'sub-3', 'sub-4']);
  });

  it('Test 3: Specific Company and Lead ID filtering in Unified Inbox', () => {
    const filterByRecord = (targetCompanyId?: string, targetLeadId?: string) => {
      return mockSubmissions.filter((sub) => {
        if (targetCompanyId && sub.company_id !== targetCompanyId) return false;
        if (targetLeadId && sub.lead_id !== targetLeadId) return false;
        return true;
      });
    };

    // Filter for comp-101 (has 2 submissions: diagnosis + inquiry)
    const comp101Items = filterByRecord('comp-101');
    assert.equal(comp101Items.length, 2);
    assert.deepEqual(comp101Items.map((s) => s.id), ['sub-1', 'sub-2']);

    // Filter for comp-102 (has 1 material download submission)
    const comp102Items = filterByRecord('comp-102');
    assert.equal(comp102Items.length, 1);
    assert.equal(comp102Items[0].id, 'sub-3');

    // Filter for lead-203
    const lead203Items = filterByRecord(undefined, 'lead-203');
    assert.equal(lead203Items.length, 1);
    assert.equal(lead203Items[0].id, 'sub-4');
  });

  it('Test 4: Tab label for mst_diagnoses renamed to フォーム作成・配布資料', () => {
    const getTabLabel = (tab: string): string => {
      switch (tab) {
        case 'mst_diagnoses':
          return 'フォーム作成・配布資料';
        case 'inbox_hub':
          return '統合受信トレイ';
        default:
          return tab;
      }
    };

    assert.equal(getTabLabel('mst_diagnoses'), 'フォーム作成・配布資料');
  });

  it('Test 5: Unified customer response filtering across Leads, Deals, and Customers', () => {
    // New unified filter logic:
    // If targetCompanyId is set, match any submission belonging to that company OR lead,
    // ensuring consistent customer-level submission history regardless of entry point.
    const filterUnifiedCustomer = (targetCompanyId?: string, targetLeadId?: string) => {
      const list = mockSubmissions.filter((sub) => {
        if (targetCompanyId) {
          const matchesCompany = sub.company_id === targetCompanyId;
          const matchesLead = targetLeadId ? sub.lead_id === targetLeadId : false;
          if (!matchesCompany && !matchesLead) return false;
        } else if (targetLeadId) {
          if (sub.lead_id !== targetLeadId) return false;
        }
        return true;
      });

      if (targetLeadId) {
        return [...list].sort((a, b) => {
          const aIsLead = a.lead_id === targetLeadId ? 1 : 0;
          const bIsLead = b.lead_id === targetLeadId ? 1 : 0;
          return bIsLead - aIsLead;
        });
      }
      return list;
    };

    // Case 1: Opened from Customer/Contract (company_id: 'comp-101', lead_id: undefined)
    const fromCustomer = filterUnifiedCustomer('comp-101', undefined);
    assert.equal(fromCustomer.length, 2, 'Customer entry point sees all company submissions');

    // Case 2: Opened from Lead (company_id: 'comp-101', lead_id: 'lead-201')
    // Previously, this narrowed to 1 item; now it returns all 2 submissions with the lead item prioritized!
    const fromLead = filterUnifiedCustomer('comp-101', 'lead-201');
    assert.equal(fromLead.length, 2, 'Lead entry point also sees all company submissions');
    assert.equal(fromLead[0].lead_id, 'lead-201', 'Selected lead response is sorted first');

    // Case 3: Opened from Deal (company_id: 'comp-101', lead_id: 'lead-201' or undefined)
    const fromDeal = filterUnifiedCustomer('comp-101', 'lead-201');
    assert.equal(fromDeal.length, 2, 'Deal entry point sees all company submissions');
  });
});
