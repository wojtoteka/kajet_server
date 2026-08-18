"use client";

import { useEffect, useRef, useState } from "react";
import { useWords } from "@/components/LanguageProvider";
import type { Language } from "@/lib/i18n";
import { checkCaptcha } from "./actions";
import styles from "./contact.module.css";

/*
  Formularz kontaktowy - wysyła prosto z przeglądarki do API Wojtoteki.

  Celowo nie przez akcję serwerową: wojtoteka.ovh stoi za Cloudflare, który
  przepuszcza przeglądarki, a żądania między serwerami potrafi uciąć jako boty
  (sprawdzone: curl dostaje 403 zanim dojdzie do API). Klucz jedzie w kodzie
  strony - dokumentacja API wprost mówi, że formularze kontaktowe tak działają;
  nadużyć pilnuje limit 30 wiadomości na godzinę na adres IP gościa i ban
  z panelu Wojtoteki.

  Przed wysłaniem staje hCaptcha (gdy skonfigurowana): okienko rysuje skrypt
  hCaptchy, a token sprawdza nasz serwer w akcji checkCaptcha - bo do
  sprawdzenia trzeba sekretu, a sekret nie wyjeżdża do przeglądarki.
*/

/** Kawałek skryptu hCaptchy, którego używamy. Skrypt sam wstawia się w window. */
type HcaptchaApi = {
  render: (
    container: HTMLElement,
    params: {
      sitekey: string;
      theme?: "light" | "dark";
      size?: "normal" | "compact";
      hl?: string;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
  getResponse: (widgetId?: string) => string;
};

declare global {
  interface Window {
    hcaptcha?: HcaptchaApi;
    kajetHcaptchaGotowa?: () => void;
  }
}

const HCAPTCHA_SCRIPT_ID = "hcaptcha-api";

/** Szerokość zwykłego okienka hCaptchy - obca ramka o stałych wymiarach. */
const SZEROKIE_OKIENKO = 303;

/** Czy arkusz jest teraz ciemny - ręczny wybór z <html>, inaczej system. */
function ciemnyMotyw(): boolean {
  const pick = document.documentElement.dataset.theme;
  if (pick === "dark") return true;
  if (pick === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ContactForm({
  apiUrl,
  apiKey,
  captchaSiteKey,
  language,
}: {
  apiUrl: string;
  apiKey: string;
  /** Pusty napis znaczy: bez captchy, formularz działa jak dotąd. */
  captchaSiteKey: string;
  language: Language;
}) {
  const words = useWords();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Skrypt hCaptchy nie dojechał (bloker, zapora). Bez tej wiedzy formularz
  // prosiłby o zaznaczenie okienka, którego nie ma.
  const [captchaDead, setCaptchaDead] = useState(false);
  const captchaBox = useRef<HTMLDivElement>(null);
  const captchaWidget = useRef<string | null>(null);

  useEffect(() => {
    if (!captchaSiteKey) return;
    let alive = true;

    /*
      hCaptcha nie umie przemalować się w locie, więc przy zmianie motywu albo
      rozmiaru okienko rysuje się od nowa - a rozwiązana, nie wysłana captcha
      przy tym przepada. Dlatego rysujemy tylko wtedy, gdy wygląd naprawdę się
      zmienia: przełączenie „systemowy" na „jasny" przy jasnym systemie nie
      kosztuje nikogo rozwiązywania od nowa.
    */
    let paintedTheme: "light" | "dark" | null = null;
    let paintedSize: "normal" | "compact" | null = null;

    function paint() {
      const box = captchaBox.current;
      const hcaptcha = window.hcaptcha;
      if (!alive || !box || !hcaptcha) return;
      const theme = ciemnyMotyw() ? "dark" : "light";
      /*
        Ciasna odmiana okienka rośnie w dół (164 x 144) zamiast w bok i przy
        formularzu wygląda obco, więc sięgamy po nią tylko wtedy, gdy szeroka
        (303 x 78) naprawdę nie ma gdzie się położyć. Mierzymy kartkę, nie okno
        przeglądarki: to kartka decyduje o miejscu, a okno bywa dużo szersze od
        niej. Zero znaczy „kartki jeszcze nie widać" - wtedy zwykłe okienko.
      */
      const miejsce = box.clientWidth;
      const size = miejsce > 0 && miejsce < SZEROKIE_OKIENKO ? "compact" : "normal";
      if (captchaWidget.current !== null && theme === paintedTheme && size === paintedSize) {
        return;
      }
      if (captchaWidget.current !== null) {
        try {
          hcaptcha.remove(captchaWidget.current);
        } catch {
          box.innerHTML = "";
        }
        captchaWidget.current = null;
      }
      captchaWidget.current = hcaptcha.render(box, {
        sitekey: captchaSiteKey,
        theme,
        size,
        hl: language,
      });
      paintedTheme = theme;
      paintedSize = size;
      // Arkusz zaklepuje miejsce pod okienko z tego napisu - inaczej kartka
      // podskakiwałaby, gdy ciasna odmiana okaże się wyższa od zaklepanej.
      box.dataset.rozmiar = size;
    }

    if (window.hcaptcha) {
      paint();
    } else {
      // Skrypt wolno wstawić tylko raz - drugi raz sam głośno protestuje.
      window.kajetHcaptchaGotowa = paint;
      if (!document.getElementById(HCAPTCHA_SCRIPT_ID)) {
        const script = document.createElement("script");
        script.id = HCAPTCHA_SCRIPT_ID;
        script.src =
          "https://js.hcaptcha.com/1/api.js?render=explicit&onload=kajetHcaptchaGotowa" +
          `&hl=${encodeURIComponent(language)}`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          // Martwy znacznik idzie precz, żeby następne wejście na stronę
          // spróbowało od nowa - chwilowa czkawka sieci nie może zablokować
          // formularza na cały pobyt. Dlatego bez zaglądania w `alive`.
          script.remove();
          if (alive) setCaptchaDead(true);
        };
        document.head.appendChild(script);
      }
    }

    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const naSystem = () => {
      // Motyw systemu obowiązuje tylko bez ręcznego wyboru na stronie.
      if (!document.documentElement.dataset.theme) paint();
    };
    system.addEventListener("change", naSystem);
    // Kartka zmienia szerokość nie tylko przy obracaniu telefonu (siatka
    // przechodzi z jednej kolumny w dwie), a paint() sam pilnuje, żeby przy tej
    // samej szerokości nie rysować okienka od nowa - więc zapętlenia nie ma.
    const naSzerokosc = new ResizeObserver(paint);
    if (captchaBox.current) naSzerokosc.observe(captchaBox.current);
    const naWybor = new MutationObserver(paint);
    naWybor.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      alive = false;
      system.removeEventListener("change", naSystem);
      naSzerokosc.disconnect();
      naWybor.disconnect();
      if (captchaWidget.current !== null && window.hcaptcha) {
        try {
          window.hcaptcha.remove(captchaWidget.current);
        } catch {
          // Trudno - po odejściu ze strony i tak nikt okienka nie zobaczy.
        }
        captchaWidget.current = null;
      }
    };
  }, [captchaSiteKey, language]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    // Pole-pułapka: człowiek go nie widzi i zostawia puste, robot spamujący
    // wypełnia wszystko jak leci. Udajemy sukces, żeby nie było po czym
    // poznać, że wiadomość wylądowała w koszu.
    if (String(data.get("website") ?? "") !== "") {
      setError("");
      setSuccess(words.contactSent);
      form.reset();
      return;
    }

    let captchaToken = "";
    if (captchaSiteKey) {
      // Bez okienka (skrypt nie dojechał albo jeszcze jedzie) nie ma o co
      // prosić - zamiast „zaznacz okienko" mówimy, co się stało.
      if (captchaDead || captchaWidget.current === null) {
        setSuccess("");
        setError(words.contactCaptchaUnavailable);
        return;
      }
      try {
        captchaToken = window.hcaptcha?.getResponse(captchaWidget.current) ?? "";
      } catch {
        captchaToken = "";
      }
      if (!captchaToken) {
        setSuccess("");
        setError(words.contactCaptchaMissing);
        return;
      }
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (captchaSiteKey) {
        const human = await checkCaptcha(captchaToken);
        // Token jest jednorazowy - po sprawdzeniu okienko trzeba nastawić od
        // nowa, żeby następna próba dostała świeży.
        if (captchaWidget.current !== null && window.hcaptcha) {
          try {
            window.hcaptcha.reset(captchaWidget.current);
          } catch {}
        }
        if (!human) {
          setError(words.contactCaptchaFailed);
          return;
        }
      }

      const answer = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          name: String(data.get("name") ?? "").trim(),
          email: String(data.get("email") ?? "").trim(),
          subject: String(data.get("subject") ?? "").trim(),
          message: String(data.get("message") ?? "").trim(),
        }),
      });
      if (answer.ok) {
        setSuccess(words.contactSent);
        form.reset();
      } else if (answer.status === 429) {
        setError(words.contactTooMany);
      } else if (answer.status === 400) {
        setError(words.contactFillEverything);
      } else {
        setError(words.contactFailed);
      }
    } catch {
      setError(words.contactFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {/* Pole-pułapka na roboty. Schowane przed okiem i przed czytnikiem
          ekranu; człowiek zostawia je puste - patrz submit wyżej. */}
      <div style={{ position: "absolute", left: -9999, top: 0 }} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="field">
        <label htmlFor="name">{words.contactNameLabel}</label>
        <input id="name" name="name" type="text" required maxLength={255} autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="email">{words.emailAddress}</label>
        <input id="email" name="email" type="email" required maxLength={255} autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="subject">{words.contactSubjectLabel}</label>
        <input id="subject" name="subject" type="text" required maxLength={255} />
      </div>
      <div className="field">
        <label htmlFor="message">{words.contactMessageLabel}</label>
        <textarea id="message" name="message" required maxLength={5000} rows={7} />
      </div>

      {captchaSiteKey ? (
        captchaDead ? (
          <p className="error" style={{ margin: "0 0 16px 0" }}>
            {words.contactCaptchaUnavailable}
          </p>
        ) : (
          <div ref={captchaBox} className={styles.captcha} />
        )
      ) : null}

      <button type="submit" className="primary" disabled={busy}>
        {busy ? words.contactSendingWord : words.contactSendButton}
      </button>

      {/* Odpowiedź pod przyciskiem - nad polami spychała cały formularz w dół
          w chwili kliknięcia. */}
      {error ? (
        <p className="error" style={{ margin: "12px 0 0 0" }}>
          {error}
        </p>
      ) : null}
      {success ? (
        <div className="success" style={{ margin: "12px 0 0 0" }}>
          {success}
        </div>
      ) : null}
    </form>
  );
}
