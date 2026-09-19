"use client";

import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";

const navLinks = [
  { href: "/clasificacion", label: "Clasificación" },
  { href: "/jornadas", label: "Jornadas" },
  { href: "/calendario", label: "Calendario" },
  { href: "/equipos", label: "Equipos" },
  { href: "/goleadores", label: "Pitxitxi" },
  { href: "/zamora", label: "Zamora" },
  { href: "/sanciones", label: "Sanciones" },
];

export default function MainNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [isIosApp, setIsIosApp] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsIosApp(Capacitor.getPlatform() === "ios");
  }, []);

  // Close the dropdown on outside click, Escape key, or window resize back to desktop.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (navRef.current?.contains(target) || toggleRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    const handleResize = () => {
      if (window.innerWidth > 900) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="nav-toggle"
        aria-expanded={isOpen}
        aria-controls="main-nav"
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <span className="nav-toggle-bar" />
        <span className="nav-toggle-bar" />
        <span className="nav-toggle-bar" />
      </button>

      <nav
        id="main-nav"
        ref={navRef}
        className={`main-nav${isOpen ? " is-open" : ""}`}
        aria-label="Navegación principal"
      >
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} className="nav-link" onClick={() => setIsOpen(false)}>
            {link.label}
          </Link>
        ))}
        {isIosApp ? (
          <Link href="/admin" className="nav-link nav-admin" onClick={() => setIsOpen(false)}>
            Administración
          </Link>
        ) : null}
      </nav>
    </>
  );
}
