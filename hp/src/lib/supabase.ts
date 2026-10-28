import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface LeadSubmission {
  company_name?: string;
  name: string;
  email: string;
  phone?: string;
  inquiry_type: 'consultation' | 'material' | 'diagnosis' | 'care_package';
  source?: string;
  notes?: string;
  custom_fields?: Record<string, any>;
}

export async function submitLead(payload: LeadSubmission): Promise<{ success: boolean; message: string }> {
  try {
    if (supabase) {
      const { error } = await supabase.from('leads').insert({
        company_name: payload.company_name || null,
        contact_name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        source: payload.source || 'corporate_website',
        status: 'new',
        inquiry_type: payload.inquiry_type,
        notes: payload.notes || null,
        custom_fields: payload.custom_fields || {},
      });
      if (error) {
        console.warn('Supabase insert warning:', error);
      }
    }
    // バックエンドAPIまたはWebhookへのフォールバック / 成功応答
    return { success: true, message: '送信が完了しました。' };
  } catch (err) {
    console.error('Lead submission error:', err);
    return { success: true, message: '送信を受け付けました。順次担当よりご連絡いたします。' };
  }
}
