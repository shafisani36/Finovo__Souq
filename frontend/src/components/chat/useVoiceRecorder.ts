import { useEffect, useRef, useState } from 'react';

export const MAX_VOICE_SECONDS = 120;

// First format the browser can record that the server accepts (webm/ogg on Chrome and Firefox, mp4 on Safari)
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];

export interface VoiceRecording {
  blob: Blob;
  seconds: number;
}

/** Records from the microphone with MediaRecorder; stops by itself at the two-minute limit */
export function useVoiceRecorder(onRecorded: (recording: VoiceRecording) => void) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const discard = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  // Ticks while recording and stops at the limit
  useEffect(() => {
    if (seconds === null) return undefined;
    if (seconds >= MAX_VOICE_SECONDS) {
      recorder.current?.stop();
      return undefined;
    }
    const id = window.setTimeout(() => setSeconds((s) => (s === null ? null : s + 1)), 1000);
    return () => window.clearTimeout(id);
  }, [seconds]);

  // Releases the microphone if the page closes mid-recording
  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
    },
    [],
  );

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice messages are not supported in this browser.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Allow microphone access in your browser to record a voice message.');
      return;
    }
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const media = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    media.ondataavailable = (event) => chunks.push(event.data);
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      setSeconds(null);
      const elapsed = Math.min(MAX_VOICE_SECONDS, Math.round((Date.now() - startedAt) / 1000));
      if (!discard.current && elapsed >= 1) onRecordedRef.current({ blob: new Blob(chunks, { type: media.mimeType }), seconds: elapsed });
    };
    discard.current = false;
    recorder.current = media;
    media.start();
    setSeconds(0);
  };

  const stop = (send: boolean) => {
    discard.current = !send;
    recorder.current?.stop();
  };

  return { recording: seconds !== null, seconds: seconds ?? 0, error, start, stop };
}
