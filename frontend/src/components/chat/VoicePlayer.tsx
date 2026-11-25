import { useRef, useState, type CSSProperties } from 'react';
import { Pause, Play } from 'lucide-react';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Compact player for voice messages: play/pause, a seekable progress bar and the time left */
export function VoicePlayer({ src, duration }: { src: string; duration: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  return (
    <div className="voice">
      <button type="button" className="voice__play" onClick={toggle} aria-label={playing ? 'Pause voice message' : 'Play voice message'}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <input
        type="range"
        className="voice__bar"
        min={0}
        max={duration}
        step={0.1}
        value={position}
        style={{ '--progress': `${progress}%` } as CSSProperties}
        onChange={(e) => {
          if (audio.current) audio.current.currentTime = Number(e.target.value);
        }}
        aria-label="Voice message position"
      />
      <span className="voice__time tabular">{clock(playing || position ? duration - position : duration)}</span>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPosition(0)}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
      />
    </div>
  );
}
