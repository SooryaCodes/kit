"use client";

// Frame-stepped MP4 export with canvas-record (WebCodecs). Deterministic: every frame is rendered at an
// exact timestamp, so the video matches the preview regardless of how fast the device encodes.

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { DURATION_S, FPS } from "./reel-settings";

export interface ExportResult {
  mp4: Blob;
  cover: Blob;
}

export type ExportFn = (onProgress: (p: number) => void) => Promise<ExportResult>;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * `setOutputDpr` is owned by the parent and passed to <Canvas dpr>: a re-render of the Canvas
 * (every progress update) would otherwise reset the pixel ratio and shrink the video.
 */
export function Exporter({
  timeRef,
  exportRef,
  outputWidth,
  setOutputDpr,
}: {
  timeRef: React.RefObject<number>;
  exportRef: React.RefObject<ExportFn | null>;
  outputWidth: number;
  setOutputDpr: (dpr: number | null) => void;
}) {
  const { gl, size, advance, setFrameloop } = useThree();

  useEffect(() => {
    exportRef.current = async (onProgress) => {
      setFrameloop("never");
      setOutputDpr(outputWidth / size.width);
      // wait until the drawing buffer really is output size
      for (let i = 0; i < 60 && Math.abs(gl.domElement.width - outputWidth) > 2; i++) await nextFrame();
      if (Math.abs(gl.domElement.width - outputWidth) > 2) throw new Error(`could not size the canvas to ${outputWidth}px`);

      const total = DURATION_S * FPS;
      // loaded on demand: keeps the encoder out of the first page load
      const { Recorder } = await import("canvas-record");
      const recorder = new Recorder(gl.getContext(), { name: "kit-reel", duration: Infinity, frameRate: FPS, download: false, extension: "mp4" });
      try {
        timeRef.current = 0;
        advance(performance.now());
        await recorder.start();
        for (let f = 1; f < total; f++) {
          timeRef.current = f / FPS;
          advance(performance.now());
          await recorder.step();
          if (f % 6 === 0) onProgress(f / total);
        }
        const out = await recorder.stop();
        const parts = Array.isArray(out) ? out : out ? [out as BlobPart] : [];
        if (!parts.length) throw new Error("the encoder returned no video");
        const mp4 = new Blob(parts as BlobPart[], { type: "video/mp4" });

        timeRef.current = DURATION_S * 0.8;
        advance(performance.now());
        const cover = await new Promise<Blob>((resolve, reject) =>
          gl.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error("cover capture failed"))), "image/jpeg", 0.9),
        );
        onProgress(1);
        return { mp4, cover };
      } finally {
        await recorder.dispose?.();
        setOutputDpr(null);
        setFrameloop("always");
      }
    };
    return () => {
      exportRef.current = null;
    };
  }, [gl, size.width, advance, setFrameloop, setOutputDpr, timeRef, exportRef, outputWidth]);

  return null;
}
