import * as FileSystem from 'expo-file-system';

import { API_BASE_URL, getAccessToken } from './api';

export type ExtractedFinancialRecord = {
  type: 'expense' | 'income' | 'improvement' | null;
  amount: number | null;
  counterparty: string | null;
  description: string | null;
  date: string | null;
};

export type VoiceTranscriptionResponse = {
  ok: boolean;
  filename?: string;
  transcript: string;
  raw_output?: string;
  extracted_records?: ExtractedFinancialRecord[];
  extraction_raw_output?: string | null;
  inserted_records?: { id: string; description: string; amount: string; type: string }[];
  openai_api_key_configured?: boolean;
};

const ensureFileUri = (uri: string) => (uri.startsWith('file://') ? uri : `file://${uri}`);

export async function transcribeAudio(
  uri: string,
  filename = 'recording.m4a',
  mimeType = 'audio/mp4',
  options?: { organizationId?: string; propertyId?: string; createdBy?: string; autoInsert?: boolean },
) {
  const normalizedUri = ensureFileUri(uri);
  const parameters: Record<string, string> = {};
  if (options?.organizationId) parameters.organization_id = options.organizationId;
  if (options?.propertyId) parameters.property_id = options.propertyId;
  if (options?.createdBy) parameters.created_by = options.createdBy;
  if (typeof options?.autoInsert === 'boolean') parameters.auto_insert = String(options.autoInsert);

  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const result = await FileSystem.uploadAsync(`${API_BASE_URL}/voice/transcribe`, normalizedUri, {
    fieldName: 'audio',
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    mimeType,
    parameters,
    headers,
  });

  const data = JSON.parse(result.body || '{}');
  if (result.status !== 200) {
    throw new Error(data.detail || data.message || `Voice transcription failed (${result.status})`);
  }
  return data as VoiceTranscriptionResponse;
}
