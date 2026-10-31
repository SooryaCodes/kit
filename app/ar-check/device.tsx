"use client";

import { useEffect, useState } from "react";

export function Device() {
  const [ua, setUa] = useState("");
  useEffect(() => setUa(navigator.userAgent), []);
  return <p className="break-words text-[12px] text-ink-muted">{ua}</p>;
}
