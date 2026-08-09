/*
  Adresy dokumentów prawnych.

  Jedno miejsce dla stopki, formularza zakładania konta i wszystkiego, co
  jeszcze do nich sięgnie. Same dokumenty to gotowe pliki HTML w `public`,
  a te adresy bez „.html" robi z nich `rewrites` w next.config.ts.

  Adresy są po angielsku, jak reszta serwisu; stare polskie idą na nie
  przekierowaniem z next.config.ts, bo mogły już gdzieś pójść.

  Adres nie niesie języka. Każdy dokument ma w jednym pliku wersję polską
  i angielską, a wybór PL/EN stoi na wierzchu strony i trzyma się tego samego
  ciasteczka, co przełącznik w serwisie - więc dokument sam otwiera się w tym
  języku, w którym człowiek ogląda resztę.

  Osobny plik, bo sięga po nie także formularz rejestracji, który jest
  komponentem klienckim - a stopka jest serwerowa i nie wolno jej wciągać
  do przeglądarki.
*/

export const TERMS_URL = "/terms";
export const PRIVACY_URL = "/privacy";
