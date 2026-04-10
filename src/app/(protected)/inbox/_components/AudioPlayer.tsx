'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

const SPEEDS = [1, 1.5, 2] as const
type PlaybackSpeed = (typeof SPEEDS)[number]

function formatTime(seconds: number) {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

function getSpeedLabel(speed: number) {
  return Number.isInteger(speed) ? `${speed}x` : `${speed.toFixed(1)}x`
}

export function AudioPlayer({ src, isOutbound }: { src: string; isOutbound: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState<PlaybackSpeed>(() => {
    if (typeof window === 'undefined') return 1
    try {
      const saved = window.localStorage.getItem('whatsapp-audio-speed')
      const parsed = saved ? Number(saved) : 1
      return SPEEDS.includes(parsed as PlaybackSpeed) ? (parsed as PlaybackSpeed) : 1
    } catch {
      return 1
    }
  })
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return

    a.playbackRate = speed
  }, [speed])

  // Força carregamento dos metadados no mount - proxies de stream nem sempre disparam
  // onLoadedMetadata automaticamente sem um load() explícito em mobile.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return

    // Se a duração já estiver disponível (cache do browser), lê imediatamente.
    if (a.duration && isFinite(a.duration)) {
      setDuration(a.duration)
      return
    }

    a.load()
  }, [src])

  const syncDuration = () => {
    const a = audioRef.current
    if (a && isFinite(a.duration) && a.duration > 0) setDuration(a.duration)
  }

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
    } else {
      void a.play()
    }
  }

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || !a.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * a.duration
  }

  const cycleSpeed = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const currentIndex = SPEEDS.indexOf(speed)
    const next = SPEEDS[(currentIndex + 1) % SPEEDS.length]
    setSpeed(next)
    try {
      window.localStorage.setItem('whatsapp-audio-speed', String(next))
    } catch {
      // Ignore storage errors.
    }

    const a = audioRef.current
    if (a) a.playbackRate = next
  }

  return (
    <div className="flex items-center gap-2.5 w-[228px] my-1" onClick={(e) => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
          setCurrentTime(0)
        }}
        onTimeUpdate={() => {
          const a = audioRef.current
          if (!a?.duration) return
          setCurrentTime(a.currentTime)
          setProgress(a.currentTime / a.duration)
        }}
        onLoadedMetadata={syncDuration}
        onDurationChange={syncDuration}
        onCanPlay={syncDuration}
      />

      <button
        onClick={toggle}
        className={cn(
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
          isOutbound
            ? 'bg-white/20 hover:bg-white/30 text-primary-foreground'
            : 'bg-primary/10 hover:bg-primary/20 text-primary'
        )}
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        title={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {playing
          ? <Pause className="w-3.5 h-3.5" />
          : <Play className="w-3.5 h-3.5 ml-0.5" />
        }
      </button>

      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div
          className={cn(
            'h-1 rounded-full cursor-pointer',
            isOutbound ? 'bg-white/25' : 'bg-muted-foreground/20'
          )}
          onClick={seek}
          aria-label="Progresso do áudio"
        >
          <div
            className={cn('h-full rounded-full transition-[width]', isOutbound ? 'bg-white/80' : 'bg-primary/70')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <button
            onClick={cycleSpeed}
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums tracking-wide transition-colors',
              isOutbound
                ? 'border-white/20 bg-white/10 text-primary-foreground hover:bg-white/20'
                : 'border-border bg-background text-foreground hover:bg-muted'
            )}
            aria-label={`Alterar velocidade do áudio, atual ${getSpeedLabel(speed)}`}
            title={`Velocidade ${getSpeedLabel(speed)}. Toque para alternar.`}
          >
            {getSpeedLabel(speed)}
          </button>

          <span className={cn('text-[10px] leading-none tabular-nums truncate', isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
