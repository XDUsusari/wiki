"use client";
import { useState } from "react";

export default function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input {...props} type={visible ? "text" : "password"} style={{ paddingRight: 84 }} />
      <button
        type="button"
        className="secondary small"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Amagar la contrasenya" : "Mostrar la contrasenya"}
        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}
      >
        {visible ? "Amagar" : "Mostrar"}
      </button>
    </div>
  );
}
