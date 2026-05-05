import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

import { transcribeAudio } from '../services/voice';

export type VoiceRecordingState = {
  recording: Audio.Recording | null;
  recordingPropertyId: string | null;
  transcribing: boolean;
  error: string;
};

export type UseVoiceRecorderOptions = {
  organizationId?: string;
  userId?: string;
  /** Called after records are auto-inserted successfully */
  onInserted?: (propertyId: string, count: number, propertyName?: string) => void;
  /** Fallback when auto-insert doesn't happen — e.g. open a manual form */
  onFallback?: (propertyId: string, draft: VoiceDraft) => void;
};

export type VoiceDraft = {
  type?: string;
  amount?: string;
  record_date?: string;
  description?: string;
  counterparty?: string;
  category_code?: string;
  notes?: string;
};

function inferRecordDraft(transcript: string): VoiceDraft {
  const normalized = transcript.toLowerCase();
  const amountMatch = transcript.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch?.[1] ?? '';
  const type = /received|collected|rent|income|paid me|deposit/.test(normalized) ? 'income' : 'expense';
  let category_code = '';
  if (type === 'income') category_code = 'rent';
  if (/rent/.test(normalized)) category_code = 'rent';
  else if (/repair|fix|plumb|hvac|water heater|contractor/.test(normalized)) category_code = 'repair';
  else if (/maintenance/.test(normalized)) category_code = 'maintenance';
  else if (/utilit|electric|gas|water/.test(normalized)) category_code = 'utility';
  else if (/legal|lawyer|attorney|management|manager|hoa|insurance|tax|cleaning|travel|fee/.test(normalized)) category_code = 'other';
  return { amount, type, category_code, description: transcript };
}

export function useVoiceRecorder({ organizationId, userId, onInserted, onFallback }: UseVoiceRecorderOptions) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingPropertyId, setRecordingPropertyId] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const handleVoicePress = useCallback(async (propertyId: string, propertyName?: string) => {
    if (transcribing) return;
    // If already recording for a different property, ignore
    if (recording && recordingPropertyId && recordingPropertyId !== propertyId) return;

    if (!recording) {
      // Start recording
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) { setVoiceError('Microphone permission required.'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(created.recording);
        setRecordingPropertyId(propertyId);
        setVoiceError('');
      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : 'Could not start recording.');
      }
      return;
    }

    // Stop + transcribe + auto-insert
    try {
      setTranscribing(true);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const recordingStatus = await recording.getStatusAsync();
      setRecording(null);
      if (!uri) throw new Error('No recording file.');
      const durationMillis = typeof recordingStatus.durationMillis === 'number' ? recordingStatus.durationMillis : 0;
      if (durationMillis < 1200) {
        setVoiceError('Recording too short.');
        setRecordingPropertyId(null);
        return;
      }
      const stableUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}voice-upload-${Date.now()}.m4a`;
      await FileSystem.copyAsync({ from: uri, to: stableUri });
      const result = await transcribeAudio(stableUri, `recording-${Date.now()}.m4a`, 'audio/x-m4a', {
        organizationId,
        propertyId,
        createdBy: userId,
        autoInsert: true,
      });

      const transcript = (result.transcript || '').trim();
      const extractedRecord = result.extracted_records?.find((item) => item.amount !== null) || result.extracted_records?.[0];

      if (!result.extracted_records?.length) {
        setVoiceError('No records detected from voice.');
      } else if (result.inserted_records?.length) {
        onInserted?.(propertyId, result.inserted_records.length, propertyName);
      } else {
        // Build draft for manual form fallback
        const inferred = inferRecordDraft(transcript);
        const draft: VoiceDraft = {
          ...inferred,
          type: extractedRecord?.type ?? inferred.type,
          amount: extractedRecord?.amount != null ? String(extractedRecord.amount) : inferred.amount,
          counterparty: extractedRecord?.counterparty ?? undefined,
          description: extractedRecord?.description ?? inferred.description,
          record_date: extractedRecord?.date ?? new Date().toISOString().slice(0, 10),
          notes: transcript ? `Voice transcript: ${transcript}` : undefined,
        };
        onFallback?.(propertyId, draft);
      }
    } catch (err) {
      setRecording(null);
      setVoiceError(err instanceof Error ? err.message : 'Could not transcribe.');
    } finally {
      setTranscribing(false);
      setRecordingPropertyId(null);
    }
  }, [recording, recordingPropertyId, transcribing, organizationId, userId, onInserted, onFallback]);

  const clearVoiceError = useCallback(() => setVoiceError(''), []);

  return {
    recording,
    recordingPropertyId,
    transcribing,
    voiceError,
    clearVoiceError,
    handleVoicePress,
  };
}
