import { useCallback, useRef, useState } from 'react';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

import { transcribeAudio } from '../services/voice';

// Custom mono 16 kHz preset — avoids the stereo-channel static bug on Android
// devices that only have a mono mic (HIGH_QUALITY uses 2-ch stereo which
// produces interleaved garbage). 16 kHz mono is also Whisper's native format.
const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

export type VoiceRecordingState = {
  recording: boolean;
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

// Modified by AI on 07/18/2026. Edit #1.
// Voice recordings are capped at 30s (cost control — server also enforces
// this) to keep transcription + LLM extraction cost bounded per conversion.
const MAX_VOICE_RECORDING_MS = 30_000;

export function useVoiceRecorder({ organizationId, userId, onInserted, onFallback }: UseVoiceRecorderOptions) {
  const audioRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const [recording, setRecording] = useState(false);
  const [recordingPropertyId, setRecordingPropertyId] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  const clearAutoStopTimer = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  const stopAndTranscribe = useCallback(async (propertyId: string, propertyName?: string) => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearAutoStopTimer();
    try {
      setTranscribing(true);
      // Read elapsed time BEFORE stopping — currentTime resets once the recorder
      // unloads. Fall back to wall-clock if the native counter reports nothing.
      const reportedMillis = audioRecorder.currentTime * 1000;
      const elapsedMillis = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
      const durationMillis = reportedMillis > 0 ? reportedMillis : elapsedMillis;
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setRecording(false);
      startedAtRef.current = null;
      if (!uri) throw new Error('No recording file.');
      if (durationMillis < 1200) {
        setVoiceError('Recording too short.');
        setRecordingPropertyId(null);
        return;
      }
      // Give the audio encoder time to fully flush before copying.
      // On Android, stopAndUnloadAsync() returns before the file is written.
      await new Promise(resolve => setTimeout(resolve, 350));
      const stableUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}voice-upload-${Date.now()}.m4a`;
      await FileSystem.copyAsync({ from: uri, to: stableUri });
      // Verify the copied file actually has audio data
      const fileInfo = await FileSystem.getInfoAsync(stableUri);
      if (!fileInfo.exists || (fileInfo as any).size === 0) {
        throw new Error('Recorded audio file is empty — please try again.');
      }
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
      setRecording(false);
      startedAtRef.current = null;
      setVoiceError(err instanceof Error ? err.message : 'Could not transcribe.');
    } finally {
      setTranscribing(false);
      setRecordingPropertyId(null);
      stoppingRef.current = false;
    }
  }, [organizationId, userId, onInserted, onFallback, clearAutoStopTimer, audioRecorder]);

  const handleVoicePress = useCallback(async (propertyId: string, propertyName?: string) => {
    if (transcribing) return;
    // If already recording for a different property, ignore
    if (recording && recordingPropertyId && recordingPropertyId !== propertyId) return;

    if (!recording) {
      // Start recording
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) { setVoiceError('Microphone permission required.'); return; }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await audioRecorder.prepareToRecordAsync(VOICE_RECORDING_OPTIONS);
        audioRecorder.record();
        startedAtRef.current = Date.now();
        setRecording(true);
        setRecordingPropertyId(propertyId);
        setVoiceError('');
        clearAutoStopTimer();
        autoStopTimerRef.current = setTimeout(() => {
          stopAndTranscribe(propertyId, propertyName);
        }, MAX_VOICE_RECORDING_MS);
      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : 'Could not start recording.');
      }
      return;
    }

    // Stop + transcribe + auto-insert
    await stopAndTranscribe(propertyId, propertyName);
  }, [recording, recordingPropertyId, transcribing, stopAndTranscribe, clearAutoStopTimer, audioRecorder]);

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
