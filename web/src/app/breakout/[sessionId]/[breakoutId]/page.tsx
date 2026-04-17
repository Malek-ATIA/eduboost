"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
} from "amazon-chime-sdk-js";
import { api } from "@/lib/api";

type JoinResponse = {
  meeting: unknown;
  attendee: unknown;
  breakout: { sessionId: string; breakoutId: string; label: string };
};

export default function BreakoutPage({
  params,
}: {
  params: Promise<{ sessionId: string; breakoutId: string }>;
}) {
  const { sessionId, breakoutId } = use(params);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<DefaultMeetingSession | null>(null);
  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("joining");
      try {
        const { meeting, attendee, breakout } = await api<JoinResponse>(
          `/chime/sessions/${sessionId}/breakouts/${breakoutId}/join`,
          { method: "POST" },
        );
        if (cancelled) return;
        setLabel(breakout.label);

        const logger = new ConsoleLogger("chime", LogLevel.WARN);
        const deviceController = new DefaultDeviceController(logger);
        const config = new MeetingSessionConfiguration(meeting, attendee);
        const session = new DefaultMeetingSession(config, logger, deviceController);
        sessionRef.current = session;

        const audioInputs = await session.audioVideo.listAudioInputDevices();
        if (audioInputs[0]) await session.audioVideo.startAudioInput(audioInputs[0].deviceId);
        const videoInputs = await session.audioVideo.listVideoInputDevices();
        if (videoInputs[0]) await session.audioVideo.startVideoInput(videoInputs[0].deviceId);

        if (audioRef.current) session.audioVideo.bindAudioElement(audioRef.current);
        session.audioVideo.start();
        session.audioVideo.startLocalVideoTile();
        setStatus("joined");
      } catch (err) {
        setError((err as Error).message);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.audioVideo.stop();
    };
  }, [sessionId, breakoutId]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Breakout · {label || breakoutId}</h1>
          <p className="mt-1 text-xs text-gray-500">
            Parent session:{" "}
            <Link
              href={`/classroom/${sessionId}` as never}
              className="font-mono underline"
            >
              {sessionId}
            </Link>
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-500">Status: {status}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 aspect-video w-full overflow-hidden rounded bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted />
      </div>

      <audio ref={audioRef} />
    </main>
  );
}
