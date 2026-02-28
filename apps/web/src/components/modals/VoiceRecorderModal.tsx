import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, Upload, X } from "lucide-react";

interface Props {
  onUpload: (audioUrl: string) => void;
  onClose: () => void;
}

export function VoiceRecorderModal({ onUpload, onClose }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);

      // Start timer
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        // Resume timer
        timerRef.current = window.setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        // Pause timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }
  };

  const playAudio = () => {
    if (audioElementRef.current && audioUrl) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsPlaying(false);
      } else {
        audioElementRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const uploadAudio = async () => {
    if (!audioBlob) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const res = await fetch("/api/upload/audio", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      onUpload(data.url);
      onClose();
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Failed to upload audio. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-semibold text-lg">Voice Recording</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xl"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Recording controls */}
        <div className="flex flex-col items-center gap-6 mb-6">
          {/* Timer */}
          <div className="text-4xl font-mono text-white">
            {formatTime(duration)}
          </div>

          {/* Status indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`w-3 h-3 rounded-full ${
                  isPaused ? "bg-yellow-400" : "bg-red-500 animate-pulse"
                }`}
              />
              <span className="text-slate-400">
                {isPaused ? "Paused" : "Recording..."}
              </span>
            </div>
          )}

          {/* Control buttons */}
          <div className="flex items-center gap-4">
            {!isRecording && !audioBlob && (
              <button
                onClick={startRecording}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
              >
                <Mic size={24} />
              </button>
            )}

            {isRecording && (
              <>
                <button
                  onClick={pauseRecording}
                  className="w-12 h-12 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center text-white transition-colors"
                >
                  {isPaused ? <Play size={20} /> : <Pause size={20} />}
                </button>
                <button
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-slate-600 hover:bg-slate-700 flex items-center justify-center text-white transition-colors"
                >
                  <Square size={24} />
                </button>
              </>
            )}

            {audioBlob && !isRecording && (
              <button
                onClick={playAudio}
                className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition-colors"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
            )}
          </div>

          {/* Audio element for playback */}
          {audioUrl && (
            <audio
              ref={audioElementRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {audioBlob && !isRecording && (
            <>
              <button
                onClick={() => {
                  setAudioBlob(null);
                  setAudioUrl(null);
                  setDuration(0);
                  setIsPlaying(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-slate-400 hover:text-white transition-colors"
              >
                Re-record
              </button>
              <button
                onClick={uploadAudio}
                disabled={uploading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </>
          )}
          {!audioBlob && !isRecording && (
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Instructions */}
        {!isRecording && !audioBlob && (
          <p className="text-xs text-slate-500 text-center mt-4">
            Click the microphone to start recording
          </p>
        )}
      </div>
    </div>
  );
}
