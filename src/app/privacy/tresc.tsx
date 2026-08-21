/*
  Treść dokumentu, słowo w słowo w obu językach.

  Nie idzie przez słownik z lib/i18n.ts - tamten trzyma pojedyncze zdania
  interfejsu, a tu są dwa dokumenty po kilkadziesiąt akapitów z odnośnikami,
  wyliczeniami i tabelami. Wersję wybiera strona po języku serwisu, tym samym,
  którym steruje przełącznik PL/EN w nagłówku.

  Numery kotwic (#sek1, #sek2, …) są wspólne dla obu wersji, więc przełączenie
  języka zostawia człowieka przy tym samym punkcie.
*/

export function PolitykaPl() {
  return (
    <>
      <div className="legal-sheet legal-accent">
        <p className="eyebrow">Kajet</p>
        <h1>Polityka prywatności</h1>
        <p className="lead">Ostatnia aktualizacja: 15 sierpnia 2026 r.</p>
      </div>

      <div className="legal-sheet legal-toc">
        <p className="eyebrow">Spis treści</p>
        <ol>
          <li><a href="#sek1">Kto odpowiada za Twoje dane</a></li>
          <li><a href="#sek2">Czego dotyczy ten dokument</a></li>
          <li><a href="#sek3">Jakie dane zbieramy i skąd</a></li>
          <li><a href="#sek4">Po co i na jakiej podstawie prawnej</a></li>
          <li><a href="#sek5">Jak długo przechowujemy dane</a></li>
          <li><a href="#sek6">Kto jeszcze ma dostęp do danych</a></li>
          <li><a href="#sek7">Przekazywanie danych poza Europejski Obszar Gospodarczy</a></li>
          <li><a href="#sek8">Dane, które zostają na Twoim urządzeniu</a></li>
          <li><a href="#sek9">Ciasteczka i pamięć przeglądarki</a></li>
          <li><a href="#sek10">Twoje prawa</a></li>
          <li><a href="#sek11">Usunięcie konta</a></li>
          <li><a href="#sek12">Jak dane są zabezpieczone</a></li>
          <li><a href="#sek13">Wiek użytkownika</a></li>
          <li><a href="#sek14">Czy podanie danych jest obowiązkowe</a></li>
          <li><a href="#sek15">Zmiany polityki prywatności</a></li>
          <li><a href="#sek16">Kontakt</a></li>
        </ol>
      </div>

      <h2 id="sek1">1. Kto odpowiada za Twoje dane</h2>

      <p>Administratorem Twoich danych osobowych jest <strong>Wojciech Szaliński</strong>, działający pod nazwą <strong>Wojtoteka</strong>, osoba fizyczna nieprowadząca działalności gospodarczej, dostępny pod adresem <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>.</p>

      <p>Kajet jest prowadzony samodzielnie, na małą skalę i wyłącznie dla osób zaproszonych. Nie został wyznaczony inspektor ochrony danych - we wszystkich sprawach dotyczących danych osobowych piszesz bezpośrednio do administratora, na adres podany wyżej.</p>

      <p>Dokument jest dostępny po polsku i po angielsku. <strong>Wersja polska jest wiążąca</strong>; wersja angielska ma charakter pomocniczy i w razie rozbieżności rozstrzyga brzmienie polskie.</p>

      <h2 id="sek2">2. Czego dotyczy ten dokument</h2>

      <p>Polityka opisuje przetwarzanie danych w dwóch miejscach, które razem tworzą Kajet:</p>

      <ul>
        <li><strong>strona internetowa</strong> pod adresem <a href="https://kajet.wojtoteka.ovh">kajet.wojtoteka.ovh</a> - konto, biblioteka notatek, edytory, udostępnianie i pobieranie aplikacji,</li>
        <li><strong>aplikacja Kajet na Androida</strong> - notatnik na pismo odręczne, tekst, mapy myśli i kod, z opcjonalną synchronizacją z kontem.</li>
      </ul>

      <p>Aplikacji można używać <strong>bez konta i bez internetu</strong>. Wtedy notatki leżą wyłącznie na urządzeniu i żadne dane nie trafiają na serwer - z jednym wyjątkiem opisanym w punkcie <a href="#sek3">3.6</a> (raporty o awariach) i w punkcie <a href="#sek6">6</a> (pobranie modelu rozpoznawania pisma). Konto zakłada się tylko wtedy, gdy chcesz mieć notatki w chmurze, na kilku urządzeniach albo udostępniać je innym.</p>

      <h2 id="sek3">3. Jakie dane zbieramy i skąd</h2>

      <h3>3.1. Dane konta</h3>
      <p>Podajesz je sam przy zakładaniu konta albo przychodzą z Twojego konta Google, jeśli wybierzesz logowanie przez Google:</p>
      <ul>
        <li>adres e-mail,</li>
        <li>login (nazwa widoczna, gdy komuś udostępniasz notatkę) - możesz go wybrać sam albo powstaje z Twojego adresu e-mail,</li>
        <li>hasło - przechowywane wyłącznie jako nieodwracalny skrót (patrz punkt <a href="#sek12">12</a>); administrator nie zna Twojego hasła,</li>
        <li>imię i zdjęcie profilowe - tylko przy logowaniu przez Google i tylko dlatego, że Google je przekazuje,</li>
        <li>data założenia konta i data ostatniego logowania,</li>
        <li>kod zaproszenia, którym konto zostało założone, oraz informacja, kto go wystawił.</li>
      </ul>

      <h3>3.2. Treść, którą tworzysz</h3>
      <ul>
        <li>notatki (pismo odręczne, tekst, mapy myśli, kod) wraz z tytułami, znacznikami i przynależnością do folderów,</li>
        <li>załączniki - zdjęcia i rysunki wstawione do notatek,</li>
        <li>ustawienia pisania zapisane przy koncie (autozapis, krój, rozmiar i wyrównanie pisma).</li>
      </ul>
      <p>Te dane trafiają na serwer <strong>tylko wtedy, gdy korzystasz z konta</strong>: piszesz w panelu na stronie albo masz włączoną synchronizację w aplikacji.</p>
      <p>Osobno trafia na serwer treść pliku z kodem i dane, które podajesz programowi na wejściu - w chwili, gdy sam prosisz o jego uruchomienie, także wtedy, gdy notatka nie jest zsynchronizowana. Kod uruchamia się <strong>wyłącznie na serwerze Kajetu</strong> i wymaga zalogowania; aplikacja nie ma własnego tłumacza języków. Program działa w odciętym od sieci kontenerze, a jego treść i wynik kasują się razem z kontenerem, zaraz po zakończeniu pracy. <strong>Nie zapisujemy ich ani w bazie, ani w dzienniku serwera</strong> - do dziennika trafiają wyłącznie błędy techniczne samego mechanizmu uruchamiania.</p>

      <h3>3.3. Dane urządzeń</h3>
      <p>Gdy logujesz się w aplikacji, przy koncie zapisujemy: nazwę urządzenia (domyślnie producent i model, na przykład „LENOVO TB520FU” - możesz ją zmienić na własną), skrót wydanego tokenu, datę wydania i datę ostatniego użycia. Dzięki temu widzisz listę zalogowanych urządzeń i możesz odebrać dostęp wybranemu z nich.</p>

      <h3>3.4. Udostępnianie notatek</h3>
      <p>Gdy udostępniasz notatkę, zapisujemy losowy odnośnik, zakres uprawnień (czytanie albo pisanie), datę utworzenia i ostatniego użycia, ewentualny termin ważności, a przy udostępnieniu imiennym - <strong>adres e-mail osoby, której udostępniasz</strong>. Przy wspólnym pisaniu zapisywane są także poszczególne zmiany wraz z nazwą osoby, która je wprowadziła.</p>

      <h3>3.5. Bezpieczeństwo logowania</h3>
      <p>Nieudane próby logowania są liczone według adresu e-mail i adresu IP, żeby po pięciu próbach zamknąć logowanie na kwadrans. <strong>Licznik istnieje wyłącznie w pamięci działającego programu</strong> - nic z tego nie jest zapisywane na dysku i znika najpóźniej po piętnastu minutach. Tak samo liczone są nieudane próby wpisania kodu potwierdzającego skasowanie konta.</p>

      <h3>3.6. Raporty o awariach aplikacji</h3>
      <div className="legal-note legal-note-warning">
        <p style={{ margin: "0" }}><strong>Aplikacja wysyła raporty o awariach automatycznie</strong>, bez pytania i bez możliwości wyłączenia tego w ustawieniach. Raport nie jest wysyłany w chwili awarii, tylko przy najbliższym uruchomieniu aplikacji, gdy jest dostęp do internetu.</p>
      </div>
      <p>Raport zawiera: wersję aplikacji, producenta i model urządzenia, wersję Androida, nazwę wątku, w którym wystąpił błąd, czas awarii oraz techniczny opis błędu (ślad wywołań). Serwer dopisuje do tego <strong>adres IP</strong>, z którego raport przyszedł, oraz - jeżeli w chwili wysyłki byłeś zalogowany - identyfikator Twojego konta. Raport <strong>nie zawiera treści notatek</strong>. Wyjątkowo może zawierać ich fragment, jeżeli fragment ten trafił do komunikatu błędu (na przykład nazwa pliku notatki, przy której program się wywrócił).</p>
      <p>Raport wysyłany jest wyłącznie na serwer Kajetu. Aplikacja nie zawiera Firebase, Crashlytics ani żadnego innego zewnętrznego systemu zgłaszania awarii.</p>

      <h3>3.7. Dziennik działań administratora</h3>
      <p>Zapisujemy, co administrator zrobił w panelu: zmiana limitu miejsca, zablokowanie konta, wystawienie kodu zaproszenia, skasowanie konta. Wpis zawiera rodzaj czynności, login konta, którego dotyczy, datę i identyfikator administratora. Służy wyłącznie temu, żeby dało się ustalić, kto i kiedy dokonał zmiany na cudzym koncie.</p>

      <h3>3.8. Dane techniczne przy korzystaniu ze strony</h3>
      <p>Serwer Kajetu <strong>nie prowadzi dziennika odwiedzin</strong> - nie zapisuje adresów IP, adresów odwiedzanych stron ani informacji o przeglądarce osób wchodzących na stronę. Adres IP zapisywany jest wyłącznie przy raporcie o awarii (punkt 3.6).</p>
      <p>Strona wczytuje jednak kroje pisma i ikony bezpośrednio z serwerów Google, przez co <strong>przy każdym wejściu na dowolną podstronę Twój adres IP i informacja o przeglądarce trafiają do Google</strong>. Dotyczy to również osób niezalogowanych. Szczegóły w punktach <a href="#sek6">6</a> i <a href="#sek7">7</a>.</p>

      <h3 id="sek3-9">3.9. Asystent KajetAI</h3>
      <div className="legal-note legal-note-warning">
        <p style={{ margin: "0" }}><strong>Ta funkcja wysyła treść Twojej notatki do Google.</strong> Model jest darmowy, więc Google może wykorzystać wysłaną treść do uczenia swoich modeli. Jest dobrowolna, domyślnie wyłączona i dostaje ją tylko konto, któremu administrator ją nada. Bez Twojej wyraźnej zgody nie zadziała ani razu.</p>
      </div>
      <p>KajetAI zmienia treść notatki na Twoje polecenie. Żeby to zrobić, notatka musi zostać przeczytana przez model językowy Google (Gemini). Wysyłane są:</p>
      <ul>
        <li><strong>treść notatki</strong> - cały tekst notatki tekstowej, całe źródło pliku z kodem albo napisy w węzłach mapy myśli, wraz z tytułem notatki,</li>
        <li><strong>Twoje polecenie</strong> oraz kilka wcześniejszych poleceń przy tej samej notatce, żeby „skróć to jeszcze bardziej” miało do czego się odnieść.</li>
      </ul>
      <p><strong>Nie są wysyłane:</strong> pismo odręczne, zdjęcia i rysunki wstawione do notatek, notatki odręczne w całości (przy nich KajetAI w ogóle się nie pokazuje), Twój adres e-mail, login ani identyfikator konta. Google nie dowiaduje się, czyja jest notatka.</p>
      <p>Model jest darmowy, więc Google może wykorzystać wysłaną treść <strong>do uczenia swoich modeli</strong>. Może ją też przeczytać i opisać upoważniony pracownik Google. Tak działa darmowy poziom Gemini API i nie da się tego wyłączyć. Google podaje, że przed takim przeglądem odłącza dane od konta, klucza i projektu. Niezależnie od tego treść wysłana KajetAI jest przechowywana przez Google przez <strong>55 dni</strong> na potrzeby wykrywania nadużyć.</p>
      <p>Po stronie Kajetu zapisujemy Twoje polecenia i jednozdaniowe odpowiedzi KajetAI (patrz punkt <a href="#sek5">5</a>) oraz - osobno, bez treści i bez numeru notatki - sam fakt wywołania: datę, rodzaj notatki, nazwę modelu i liczbę zużytych jednostek. To drugie służy wyłącznie pilnowaniu limitów i kosztów.</p>
      <p>Zgodę potwierdzasz raz, przy pierwszym użyciu, i możesz ją wycofać w każdej chwili w ustawieniach konta. Wycofanie kasuje zapisane polecenia i wyłącza funkcję; nie ma wpływu na to, co Google zdążył już otrzymać.</p>

      <h3>3.10. Czego nie robimy</h3>
      <p>W Kajecie <strong>nie ma</strong> analityki, statystyk odwiedzin, reklam, sieci reklamowych, narzędzi śledzących, profilowania ani zautomatyzowanego podejmowania decyzji wywołujących wobec Ciebie skutki prawne. Dane nie są sprzedawane ani udostępniane w celach marketingowych - nikomu i nigdy.</p>

      <h2 id="sek4">4. Po co i na jakiej podstawie prawnej</h2>

      <p>Podstawy prawne pochodzą z art. 6 ust. 1 rozporządzenia RODO.</p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Cel</th><th>Dane</th><th>Podstawa prawna</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Zmiana treści notatki przez KajetAI, w tym przekazanie jej do Google</td>
              <td>treść notatki, jej tytuł, Twoje polecenia</td>
              <td><strong>lit. a</strong> - Twoja zgoda, dobrowolna i możliwa do wycofania w każdej chwili</td>
            </tr>
            <tr>
              <td>Prowadzenie konta, przechowywanie i synchronizacja notatek, udostępnianie ich osobom, którym je udostępnisz, uruchamianie kodu z notatek</td>
              <td>dane konta, treść notatek i załączniki, treść uruchamianego kodu, dane urządzeń, udostępnienia</td>
              <td><strong>lit. b</strong> - wykonanie umowy o świadczenie usługi, którą zawierasz, zakładając konto</td>
            </tr>
            <tr>
              <td>Potwierdzenie adresu e-mail, odzyskiwanie hasła, powiadomienie o udostępnionej notatce, kod potwierdzający skasowanie konta, ostrzeżenie przed skasowaniem nieużywanego konta</td>
              <td>adres e-mail, login, tytuł udostępnianej notatki</td>
              <td><strong>lit. b</strong> - wykonanie umowy</td>
            </tr>
            <tr>
              <td>Ochrona kont przed zgadywaniem hasła i kodu oraz ochrona serwera przed nadużyciem</td>
              <td>adres e-mail i adres IP przy nieudanym logowaniu (tylko w pamięci programu), adres IP przy raporcie o awarii</td>
              <td><strong>lit. f</strong> - prawnie uzasadniony interes: bezpieczeństwo kont i utrzymanie serwisu w działaniu</td>
            </tr>
            <tr>
              <td>Naprawianie błędów aplikacji</td>
              <td>raporty o awariach wraz z adresem IP</td>
              <td><strong>lit. f</strong> - prawnie uzasadniony interes: usuwanie usterek we własnym programie</td>
            </tr>
            <tr>
              <td>Możliwość ustalenia, kto i kiedy dokonał zmiany na koncie</td>
              <td>dziennik działań administratora</td>
              <td><strong>lit. f</strong> - prawnie uzasadniony interes: rozliczalność i wyjaśnianie sporów</td>
            </tr>
            <tr>
              <td>Rozpatrywanie reklamacji i odpowiadanie na zgłoszenia</td>
              <td>adres e-mail, treść zgłoszenia, dane konta</td>
              <td><strong>lit. b</strong> oraz <strong>lit. f</strong> - wykonanie umowy i obrona przed roszczeniami</td>
            </tr>
            <tr>
              <td>Logowanie przez konto Google</td>
              <td>adres e-mail, imię, zdjęcie profilowe, tokeny wydane przez Google</td>
              <td><strong>lit. b</strong> - wykonanie umowy; korzystanie z tej drogi logowania jest w pełni dobrowolne</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="sek5">5. Jak długo przechowujemy dane</h2>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Dane</th><th>Okres przechowywania</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Konto i wszystko, co się z nim wiąże (notatki, załączniki, foldery, udostępnienia, urządzenia)</td>
              <td>Do usunięcia konta. Usunięcie konta kasuje te dane nieodwracalnie.</td>
            </tr>
            <tr>
              <td>Treść kodu wysłanego do uruchomienia i jego wynik</td>
              <td>Do zakończenia uruchomienia, najwyżej kilkanaście sekund. Pliki programu i kontener kasują się zaraz po jego zakończeniu; nic nie trafia do bazy ani do dziennika.</td>
            </tr>
            <tr>
              <td>Polecenia wydane KajetAI i jego odpowiedzi</td>
              <td><strong>24 godziny</strong> od ostatniego polecenia przy danej notatce. Możesz je skasować wcześniej - przyciskiem w panelu KajetAI albo wycofując zgodę.</td>
            </tr>
            <tr>
              <td>Zapis wywołań KajetAI do rozliczeń (bez treści i bez numeru notatki)</td>
              <td>Do usunięcia konta.</td>
            </tr>
            <tr>
              <td>Treść wysłana do Google przez KajetAI</td>
              <td>Po stronie Google: <strong>55 dni</strong> na potrzeby wykrywania nadużyć. Model jest darmowy, więc Google może wykorzystać tę treść do uczenia swoich modeli - po wysłaniu nie da się tego cofnąć (punkt <a href="#sek3-9">3.9</a>).</td>
            </tr>
            <tr>
              <td>Konto, z którego nikt nie korzysta</td>
              <td>Po <strong>365 dniach</strong> bez żadnego śladu korzystania wysyłamy ostrzeżenie na adres e-mail. Jeżeli przez kolejne <strong>30 dni</strong> nadal nic się nie wydarzy, konto jest kasowane razem ze wszystkimi danymi. Za korzystanie uznaje się logowanie, synchronizację z aplikacji i zapisanie notatki - wystarczy jedno z nich, żeby licznik ruszył od nowa.</td>
            </tr>
            <tr>
              <td>Notatka wyrzucona do kosza</td>
              <td><strong>30 dni</strong>, po czym znika nieodwracalnie razem z załącznikami. Wcześniej możesz ją przywrócić albo opróżnić kosz ręcznie.</td>
            </tr>
            <tr>
              <td>Raporty o awariach (wraz z adresem IP)</td>
              <td>Zostaje <strong>500 najnowszych raportów i nic starszego niż 90 dni</strong> - starsze kasują się same.</td>
            </tr>
            <tr>
              <td>Nieudane próby logowania</td>
              <td><strong>15 minut</strong>, wyłącznie w pamięci działającego programu. Nic nie trafia na dysk.</td>
            </tr>
            <tr>
              <td>Sesja na stronie (ciasteczko)</td>
              <td><strong>30 dni</strong> od zalogowania. Wcześniej kończy ją wylogowanie, zmiana hasła albo „wyloguj wszędzie”.</td>
            </tr>
            <tr>
              <td>Token urządzenia w aplikacji</td>
              <td>Do wylogowania urządzenia, odebrania mu dostępu, zmiany hasła albo usunięcia konta. Sam z siebie nie wygasa.</td>
            </tr>
            <tr>
              <td>Odnośniki i kody wysyłane pocztą (potwierdzenie adresu, zmiana hasła, skasowanie konta)</td>
              <td>Odpowiednio <strong>24 godziny</strong>, <strong>1 godzina</strong> i <strong>1 godzina</strong>; każde działa jednorazowo.</td>
            </tr>
            <tr>
              <td>Dziennik działań administratora</td>
              <td>Przez czas działania serwisu. Wpis zawiera login, rodzaj czynności i datę - <strong>bez adresu e-mail</strong>.</td>
            </tr>
            <tr>
              <td>Kopie zapasowe</td>
              <td><strong>3 dni.</strong> Kopie robi dostawca hostingu dla całego serwera. Dane usunięte znikają z kopii najpóźniej po tym czasie.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="sek6">6. Kto jeszcze ma dostęp do danych</h2>

      <p>Poza administratorem dane trafiają wyłącznie do podmiotów wymienionych niżej. Nikomu innemu nie są przekazywane, sprzedawane ani udostępniane.</p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Kto</th><th>Po co</th><th>Co dostaje</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>SkyPass Solutions Sp. z o.o.</strong>, Warszawa - dostawca hostingu; serwer stoi w Polsce, w serwerowni we Wrocławiu</td>
              <td>Utrzymanie serwera i kopii zapasowych</td>
              <td>Techniczny dostęp do całego serwera, czyli do wszystkich danych na nim - jako podmiot przetwarzający, wyłącznie w zakresie potrzebnym do utrzymania maszyny</td>
            </tr>
            <tr>
              <td><strong>Serwer poczty w domenie wojtoteka.ovh</strong> (ten sam dostawca)</td>
              <td>Wysyłka wiadomości: potwierdzenie adresu, zmiana hasła, zaproszenie, powiadomienie o udostępnieniu, kod skasowania konta, ostrzeżenie o nieużywanym koncie</td>
              <td>Adres e-mail odbiorcy oraz treść wiadomości, w tym login nadawcy i tytuł udostępnianej notatki</td>
            </tr>
            <tr>
              <td><strong>Google LLC</strong> (Stany Zjednoczone) - model językowy Gemini, tylko przy KajetAI</td>
              <td>Wprowadzenie do notatki zmiany, o którą poprosisz</td>
              <td>Treść notatki i Twoje polecenie - wyłącznie wtedy, gdy masz nadane uprawnienie, potwierdziłeś zgodę i sam poprosisz KajetAI o zmianę. Szczegóły w punkcie <a href="#sek3-9">3.9</a>.</td>
            </tr>
            <tr>
              <td><strong>Google LLC</strong> (Stany Zjednoczone) - kroje pisma i ikony</td>
              <td>Strona wczytuje kroje pisma i ikony bezpośrednio z serwerów Google</td>
              <td>Adres IP i informacja o przeglądarce każdej osoby wchodzącej na stronę, także niezalogowanej. Google nie dostaje w ten sposób żadnych danych z konta ani treści notatek.</td>
            </tr>
            <tr>
              <td><strong>Google LLC</strong> - logowanie przez konto Google</td>
              <td>Tylko jeżeli sam wybierzesz tę drogę logowania</td>
              <td>To, co i tak dzieje się między Tobą a Google przy logowaniu. Kajet otrzymuje w zamian Twój adres e-mail, imię i zdjęcie profilowe.</td>
            </tr>
            <tr>
              <td><strong>Google LLC</strong> - model rozpoznawania pisma odręcznego (ML Kit)</td>
              <td>Jednorazowe pobranie polskiego modelu do aplikacji, jeżeli włączysz zamianę pisma na tekst</td>
              <td>Samo pobranie pliku modelu. <strong>Rozpoznawanie działa potem bez internetu, a Twoje pismo nigdzie nie jest wysyłane.</strong></td>
            </tr>
            <tr>
              <td><strong>Osoby, którym udostępnisz notatkę</strong></td>
              <td>Udostępnianie odnośnikiem albo imiennie</td>
              <td>Treść udostępnionej notatki oraz Twój login. Zakres decydujesz Ty i w każdej chwili możesz cofnąć dostęp.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="sek7">7. Przekazywanie danych poza Europejski Obszar Gospodarczy</h2>

      <p><strong>Serwer Kajetu, baza danych, notatki i załączniki znajdują się wyłącznie w Polsce i nie opuszczają Europejskiego Obszaru Gospodarczego.</strong> Na tej samej maszynie uruchamia się kod z notatek.</p>

      <p>Poza EOG - do Google LLC w Stanach Zjednoczonych - trafiają:</p>
      <ul>
        <li><strong>adres IP i informacja o przeglądarce</strong> każdej osoby wchodzącej na stronę, przy wczytywaniu krojów pisma i ikon,</li>
        <li>dane wymieniane przy logowaniu przez Google, jeżeli sam wybierzesz tę drogę,</li>
        <li>zapytanie o plik modelu rozpoznawania pisma, jeżeli włączysz tę funkcję w aplikacji,</li>
        <li><strong>treść notatki i Twoje polecenie</strong> - wtedy i tylko wtedy, gdy sam poprosisz KajetAI o zmianę (punkt <a href="#sek3-9">3.9</a>). Usługa Gemini API nie pozwala wskazać regionu przetwarzania, więc dane mogą być przetwarzane i przechowywane w dowolnym kraju, w którym Google ma swoje ośrodki.</li>
      </ul>

      <p>Google LLC uczestniczy w programie Data Privacy Framework, uznanym przez Komisję Europejską za zapewniający odpowiedni stopień ochrony danych (decyzja wykonawcza z 10 lipca 2023 r.), a ponadto stosuje standardowe klauzule umowne.</p>

      <div className="legal-note legal-note-warning">
        <p style={{ margin: "0" }}><strong>Poza KajetAI treść notatek nie opuszcza EOG.</strong> Bez tej funkcji - czyli domyślnie, dopóki nie dostaniesz do niej dostępu i sam się na nią nie zgodzisz - notatki i załączniki leżą wyłącznie na serwerze w Polsce.</p>
      </div>

      <h2 id="sek8">8. Dane, które zostają na Twoim urządzeniu</h2>

      <p>Część danych nigdy nie opuszcza Twojego telefonu lub tabletu i administrator nie ma do nich dostępu:</p>
      <ul>
        <li><strong>notatki jako pliki</strong> - w folderze, który sam wskazujesz przy pierwszym uruchomieniu aplikacji,</li>
        <li><strong>indeks wyszukiwania</strong> - baza z tytułami i treścią notatek, żeby wyszukiwanie działało od razu i bez internetu,</li>
        <li><strong>ustawienia aplikacji</strong> - motyw, zachowanie palca, domyślny rodzaj strony, język, zapamiętane pisaki i kolory,</li>
        <li><strong>token konta</strong> - w zaszyfrowanym magazynie systemu Android, którego klucz leży w sprzętowym magazynie kluczy urządzenia,</li>
        <li><strong>pięć ostatnich raportów o awariach</strong> - w plikach aplikacji,</li>
        <li><strong>zdjęcia z aparatu</strong> - chwilowo w pamięci podręcznej, zanim trafią do notatki.</li>
      </ul>

      <p>Aplikacja prosi tylko o dwa uprawnienia: <strong>dostęp do internetu</strong> i <strong>sprawdzenie stanu połączenia</strong>. Nie ma uprawnienia do aparatu (zdjęcie robi systemowa aplikacja aparatu na Twoje polecenie), do plików (folder wskazujesz sam przez systemowy wybór), do kontaktów ani do położenia.</p>

      <p>Jeżeli masz włączoną kopię zapasową Androida, system może umieścić dane aplikacji w Twojej kopii na koncie Google. Dzieje się to poza Kajetem, na zasadach Google, i możesz to wyłączyć w ustawieniach urządzenia.</p>

      <p>Odinstalowanie aplikacji kasuje ustawienia, indeks i token. <strong>Pliki notatek zostają</strong> w folderze, który wskazałeś - to Twoje pliki i tylko Ty decydujesz, kiedy znikną.</p>

      <h2 id="sek9">9. Ciasteczka i pamięć przeglądarki</h2>

      <p>Strona używa wyłącznie ciasteczek niezbędnych do jej działania. <strong>Nie ma ciasteczek analitycznych, statystycznych ani reklamowych</strong>, dlatego nie pytamy o zgodę na ciasteczka - dla ciasteczek niezbędnych nie jest ona wymagana.</p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Nazwa</th><th>Do czego</th><th>Jak długo</th></tr>
          </thead>
          <tbody>
            <tr><td>ciasteczko sesji (Auth.js)</td><td>Utrzymuje zalogowanie na stronie</td><td>30 dni</td></tr>
            <tr><td><code>kajet.kod</code></td><td>Przenosi kod zaproszenia przez przejście do Google i z powrotem przy zakładaniu konta</td><td>30 minut</td></tr>
            <tr><td><code>kajet-jezyk</code></td><td>Zapamiętuje wybrany język strony</td><td>Do zmiany albo wyczyszczenia przeglądarki</td></tr>
            <tr><td><code>kajet-paleta</code></td><td>Zapamiętuje własne kolory pisaków w edytorze odręcznym na stronie</td><td>Rok</td></tr>
            <tr><td><code>kajet-motyw</code> (pamięć lokalna, nie ciasteczko)</td><td>Zapamiętuje wybór jasnego albo ciemnego motywu</td><td>Do zmiany albo wyczyszczenia przeglądarki</td></tr>
          </tbody>
        </table>
      </div>

      <h2 id="sek10">10. Twoje prawa</h2>

      <p>W związku z przetwarzaniem Twoich danych przysługuje Ci prawo do:</p>
      <ul>
        <li><strong>dostępu</strong> do danych i otrzymania ich kopii,</li>
        <li><strong>sprostowania</strong> danych nieprawidłowych i uzupełnienia niekompletnych - login i hasło zmienisz sam w ustawieniach konta,</li>
        <li><strong>usunięcia</strong> danych („prawo do bycia zapomnianym”) - patrz punkt <a href="#sek11">11</a>,</li>
        <li><strong>ograniczenia przetwarzania</strong> - możesz żądać, by dane były wyłącznie przechowywane, bez dalszego wykorzystywania,</li>
        <li><strong>przenoszenia danych</strong> - otrzymania ich w powszechnie używanym formacie nadającym się do odczytu maszynowego. Możesz to zrobić także sam, bez pytania kogokolwiek: aplikacja przechowuje notatki jako zwykłe pliki w wybranym przez Ciebie folderze i pozwala je wyeksportować do PDF, DOCX i Markdown,</li>
        <li><strong>sprzeciwu</strong> wobec przetwarzania opartego na prawnie uzasadnionym interesie (raporty o awariach, dziennik działań administratora, ochrona przed nadużyciami) - z przyczyn związanych z Twoją szczególną sytuacją.</li>
      </ul>

      <p>Żądanie wystarczy wysłać na adres <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>. Odpowiedź otrzymasz bez zbędnej zwłoki, najpóźniej w ciągu <strong>miesiąca</strong> od otrzymania żądania. Skorzystanie z tych praw jest bezpłatne.</p>

      <p>Masz też prawo <strong>wnieść skargę do organu nadzorczego</strong>, jeżeli uznasz, że przetwarzanie Twoich danych narusza przepisy:</p>
      <p style={{ marginLeft: 14 }}>Prezes Urzędu Ochrony Danych Osobowych<br />ul. Stawki 2, 00-193 Warszawa<br /><a href="https://uodo.gov.pl">uodo.gov.pl</a></p>

      <h2 id="sek11">11. Usunięcie konta</h2>

      <p>Konto usuwasz sam, w ustawieniach konta na stronie. Odbywa się to w dwóch krokach: najpierw wysyłamy kod na adres e-mail przypisany do konta, potem przepisujesz go w panelu. Po wpisaniu kodu konto znika natychmiast. Drugi krok istnieje po to, żeby nieodwracalnego skasowania nie mógł uruchomić ktoś, kto na chwilę usiądzie przy Twojej otwartej przeglądarce.</p>

      <p>Kod jest ważny <strong>godzinę</strong>, działa jeden raz i po pięciu nietrafionych próbach wpisywanie zostaje zamknięte na kwadrans. Jeżeli wiadomość nie dojdzie albo wolisz załatwić to inaczej, napisz na <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a> z adresu przypisanego do konta.</p>

      <p>Usunięcie konta oznacza nieodwracalne skasowanie: wszystkich notatek wraz z treścią, wszystkich załączników z dysku serwera, folderów, wszystkich udostępnionych odnośników (przestają działać natychmiast), tokenów zalogowanych urządzeń, powiązania z kontem Google oraz samego konta. <strong>Tego nie da się cofnąć.</strong> Z kopii zapasowych dane znikają najpóźniej po trzech dniach.</p>

      <p>W dzienniku działań administratora zostaje sam ślad, że konto o danym loginie zostało skasowane, z datą i liczbą notatek - bez adresu e-mail i bez jakichkolwiek treści.</p>

      <p>Konto zostanie też skasowane automatycznie, jeżeli nikt nie będzie z niego korzystał przez rok - po wcześniejszym ostrzeżeniu wysłanym pocztą i miesięcznym okresie oczekiwania (szczegóły w punkcie <a href="#sek5">5</a>).</p>

      <h2 id="sek12">12. Jak dane są zabezpieczone</h2>

      <ul>
        <li>Cały ruch ze stroną i z API idzie przez <strong>połączenie szyfrowane (HTTPS)</strong>.</li>
        <li><strong>Hasła nie są przechowywane.</strong> W bazie leży wyłącznie nieodwracalny skrót wyliczony algorytmem bcrypt z kosztem 12. Administrator nie zna i nie może odtworzyć Twojego hasła.</li>
        <li><strong>Tokeny urządzeń również nie są przechowywane</strong> - w bazie leżą tylko ich skróty SHA-256. Token widzisz jeden raz, w chwili zalogowania.</li>
        <li>W aplikacji token leży w <strong>zaszyfrowanym magazynie systemu Android</strong> (AES-256-GCM), z kluczem w sprzętowym magazynie kluczy urządzenia.</li>
        <li>Pięć nieudanych logowań pod rząd <strong>zamyka logowanie na piętnaście minut</strong>, osobno dla adresu e-mail i dla adresu, z którego przyszło zapytanie.</li>
        <li>Zmiana hasła i „wyloguj wszędzie” <strong>unieważniają wszystkie sesje i wszystkie tokeny</strong> na wszystkich urządzeniach naraz.</li>
        <li>Przyjmowane są wyłącznie obrazy i pliki JSON, o rozmiarze do 25 MB, a rodzaj pliku sprawdzany jest po jego zawartości, a nie po deklaracji.</li>
        <li>Uruchamianie kodu z notatek odbywa się w <strong>odciętym od sieci kontenerze</strong> z ograniczoną pamięcią, czasem i uprawnieniami. Wymaga zalogowania, a treść programu i jego wynik kasują się razem z kontenerem, zaraz po zakończeniu pracy.</li>
        <li>Dostęp do serwera i bazy ma <strong>wyłącznie administrator</strong> oraz - technicznie - dostawca hostingu utrzymujący maszynę.</li>
      </ul>

      <div className="legal-note legal-note-warning">
        <p><strong>Rzecz, o której trzeba powiedzieć wprost:</strong> treść notatek nie jest szyfrowana w bazie danych. Kajet nie stosuje szyfrowania end-to-end. Oznacza to, że administrator - mając dostęp do serwera - jest <strong>technicznie</strong> w stanie odczytać treść notatek przechowywanych w chmurze.</p>
        <p style={{ marginBottom: "0" }}>Administrator nie zagląda do cudzych notatek i nie robi tego w żadnym celu poza sytuacjami, w których byłby do tego prawnie zobowiązany. Panel administratora nie ma funkcji przeglądania cudzych notatek. Jeżeli jednak masz notatki, które muszą pozostać tajne wobec każdego - <strong>trzymaj je bez synchronizacji, wyłącznie na urządzeniu</strong>.</p>
      </div>

      <h2 id="sek13">13. Wiek użytkownika</h2>

      <p>Konto w Kajecie może założyć osoba, która ukończyła <strong>13 lat</strong>. Osoba niepełnoletnia powinna korzystać z Kajetu za wiedzą i zgodą rodzica lub opiekuna prawnego.</p>

      <p>Nie zbieramy świadomie danych osób poniżej 13. roku życia. Jeżeli okaże się, że konto założyła osoba młodsza, zostanie ono skasowane razem ze wszystkimi danymi. Jeżeli jesteś rodzicem lub opiekunem i chcesz zgłosić taki przypadek, napisz na <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>.</p>

      <h2 id="sek14">14. Czy podanie danych jest obowiązkowe</h2>

      <p>Podanie danych jest dobrowolne, ale niezbędne do korzystania z konta. Bez adresu e-mail nie da się założyć konta, potwierdzić go ani odzyskać hasła - a bez konta nie działa synchronizacja, udostępnianie i praca na kilku urządzeniach. <strong>Z samej aplikacji można korzystać bez konta i bez podawania jakichkolwiek danych.</strong></p>

      <h2 id="sek15">15. Zmiany polityki prywatności</h2>

      <p>Polityka może się zmienić, gdy zmieni się sposób działania Kajetu albo przepisy. Nowa wersja pojawia się pod tym samym adresem, z datą ostatniej aktualizacji na górze. O zmianach istotnych dla użytkowników posiadających konto informujemy pocztą elektroniczną albo komunikatem na stronie z co najmniej 14-dniowym wyprzedzeniem.</p>

      <h2 id="sek16">16. Kontakt</h2>

      <p>We wszystkich sprawach dotyczących danych osobowych, w tym w celu skorzystania z praw opisanych w punkcie 10:</p>
      <p style={{ marginLeft: 14 }}>Wojciech Szaliński (Wojtoteka)<br /><a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a></p>

      <p><a className="legal-backlink" href="/terms">Zobacz też: Regulamin</a></p>

    </>
  );
}

export function PolitykaEn() {
  return (
    <>
      <div className="legal-sheet legal-accent">
        <p className="eyebrow">Kajet</p>
        <h1>Privacy policy</h1>
        <p className="lead">Last updated: 15 August 2026</p>
      </div>

      <div className="legal-note">
        <p style={{ margin: "0" }}>This is a courtesy translation. <strong>The Polish version is the binding one</strong>; if the two differ, the Polish wording prevails.</p>
      </div>

      <div className="legal-sheet legal-toc">
        <p className="eyebrow">Contents</p>
        <ol>
          <li><a href="#sek1">Who is responsible for your data</a></li>
          <li><a href="#sek2">What this document covers</a></li>
          <li><a href="#sek3">What data we collect and where from</a></li>
          <li><a href="#sek4">Why, and on what legal basis</a></li>
          <li><a href="#sek5">How long we keep data</a></li>
          <li><a href="#sek6">Who else can reach the data</a></li>
          <li><a href="#sek7">Transfers outside the European Economic Area</a></li>
          <li><a href="#sek8">Data that stays on your device</a></li>
          <li><a href="#sek9">Cookies and browser storage</a></li>
          <li><a href="#sek10">Your rights</a></li>
          <li><a href="#sek11">Deleting your account</a></li>
          <li><a href="#sek12">How the data is protected</a></li>
          <li><a href="#sek13">Age of the user</a></li>
          <li><a href="#sek14">Is giving your data required</a></li>
          <li><a href="#sek15">Changes to this policy</a></li>
          <li><a href="#sek16">Contact</a></li>
        </ol>
      </div>

      <h2 id="sek1">1. Who is responsible for your data</h2>

      <p>The controller of your personal data is <strong>Wojciech Szaliński</strong>, operating under the name <strong>Wojtoteka</strong>, a private individual not conducting business activity, reachable at <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>.</p>

      <p>Kajet is run single-handedly, on a small scale and only for invited people. No data protection officer has been appointed - for anything concerning personal data you write directly to the controller, at the address above.</p>

      <p>This document is available in Polish and in English. <strong>The Polish version is binding</strong>; the English version is a courtesy translation and, in case of any discrepancy, the Polish wording prevails.</p>

      <h2 id="sek2">2. What this document covers</h2>

      <p>This policy describes the processing of data in the two places that together make up Kajet:</p>

      <ul>
        <li>the <strong>website</strong> at <a href="https://kajet.wojtoteka.ovh">kajet.wojtoteka.ovh</a> - account, note library, editors, sharing and downloading the application,</li>
        <li>the <strong>Kajet application for Android</strong> - a notebook for handwriting, text, mind maps and code, with optional synchronisation with an account.</li>
      </ul>

      <p>The application can be used <strong>without an account and without an internet connection</strong>. Notes then sit on the device only and no data reaches the server - with one exception described in section <a href="#sek3">3.6</a> (crash reports) and in section <a href="#sek6">6</a> (downloading the handwriting model). You only create an account if you want your notes in the cloud, on several devices, or shared with other people.</p>

      <h2 id="sek3">3. What data we collect and where from</h2>

      <h3>3.1. Account data</h3>
      <p>You give this yourself when creating an account, or it comes from your Google account if you choose to sign in with Google:</p>
      <ul>
        <li>e-mail address,</li>
        <li>login (the name shown when you share a note) - you may choose it yourself, or it is built from your e-mail address,</li>
        <li>password - kept only as an irreversible hash (see section <a href="#sek12">12</a>); the administrator does not know your password,</li>
        <li>first name and profile picture - only when signing in with Google, and only because Google passes them on,</li>
        <li>the date the account was created and the date of the last sign-in,</li>
        <li>the invite code the account was created with, and who issued it.</li>
      </ul>

      <h3>3.2. The content you create</h3>
      <ul>
        <li>notes (handwriting, text, mind maps, code) with their titles, tags and folders,</li>
        <li>attachments - photos and drawings placed in notes,</li>
        <li>writing settings saved with the account (autosave, typeface, size and alignment).</li>
      </ul>
      <p>This data reaches the server <strong>only when you use an account</strong>: writing in the panel on the website, or with synchronisation switched on in the application.</p>
      <p>Separately, the content of a code file and whatever you give the program as input reach the server the moment you ask for it to be run - including when the note is not synchronised. Code runs <strong>on the Kajet server only</strong> and requires signing in; the application has no interpreter of its own. The program works inside a container cut off from the network, and its content and output are deleted together with the container as soon as it finishes. <strong>We save neither in the database nor in the server log</strong> - the log only ever receives technical errors of the runner itself.</p>

      <h3>3.3. Device data</h3>
      <p>When you sign in from the application, we save with your account: the device name (by default the manufacturer and model, for example “LENOVO TB520FU” - you can rename it), a hash of the token issued, the date it was issued and the date it was last used. This is what lets you see the list of signed-in devices and withdraw access from any of them.</p>

      <h3>3.4. Sharing notes</h3>
      <p>When you share a note we save a random link, the permission (reading or writing), the date it was created and last used, any expiry date, and - for a personal share - <strong>the e-mail address of the person you are sharing with</strong>. When writing together, individual changes are saved along with the name of the person who made them.</p>

      <h3>3.5. Sign-in security</h3>
      <p>Failed sign-in attempts are counted per e-mail address and per IP address, so that after five attempts signing in closes for fifteen minutes. <strong>The counter exists only in the memory of the running program</strong> - none of it is written to disk and it disappears after fifteen minutes at the latest. Failed attempts at the account-deletion code are counted the same way.</p>

      <h3>3.6. Application crash reports</h3>
      <div className="legal-note legal-note-warning">
        <p style={{ margin: "0" }}><strong>The application sends crash reports automatically</strong>, without asking and with no way to switch this off in the settings. A report is not sent at the moment of the crash, but the next time the application starts with an internet connection available.</p>
      </div>
      <p>A report contains: the application version, the manufacturer and model of the device, the Android version, the name of the thread the error happened in, the time of the crash and a technical description of the error (a stack trace). The server adds to that the <strong>IP address</strong> the report came from and - if you were signed in at the time - the identifier of your account. A report <strong>does not contain the content of notes</strong>. Exceptionally it may contain a fragment of one, if that fragment made it into the error message (for example the file name of the note the program crashed on).</p>
      <p>Reports go to the Kajet server only. The application contains no Firebase, no Crashlytics and no other third-party crash reporting system.</p>

      <h3>3.7. Administrator action log</h3>
      <p>We record what the administrator did in the panel: changing a storage limit, blocking an account, issuing an invite code, deleting an account. An entry contains the kind of action, the login of the account concerned, the date and the administrator's identifier. It exists solely so that it is possible to establish who changed what on someone else's account, and when.</p>

      <h3>3.8. Technical data when using the website</h3>
      <p>The Kajet server <strong>keeps no visit log</strong> - it does not record IP addresses, the pages visited or browser information of people opening the site. An IP address is recorded only with a crash report (section 3.6).</p>
      <p>The website does, however, load typefaces and icons directly from Google's servers, which means that <strong>every time you open any page, your IP address and browser information reach Google</strong>. This also applies to people who are not signed in. Details in sections <a href="#sek6">6</a> and <a href="#sek7">7</a>.</p>

      <h3 id="sek3-9">3.9. The KajetAI assistant</h3>
      <div className="legal-note legal-note-warning">
        <p style={{ margin: "0" }}><strong>This feature sends the content of your note to Google.</strong> The model is free, so Google may use what is sent to train its models. It is voluntary, off by default, and only an account the administrator grants it to receives it. Without your explicit consent it will not run even once.</p>
      </div>
      <p>KajetAI changes the content of a note on your instruction. To do that, the note has to be read by a Google language model (Gemini). What is sent:</p>
      <ul>
        <li>the <strong>content of the note</strong> - the whole text of a text note, the whole source of a code file, or the labels in the nodes of a mind map, together with the title of the note,</li>
        <li><strong>your instruction</strong>, and a few earlier instructions about the same note, so that “make it shorter still” has something to refer to.</li>
      </ul>
      <p><strong>What is not sent:</strong> handwriting, photos and drawings placed in notes, handwritten notes as a whole (KajetAI does not show up next to them at all), your e-mail address, your login and your account identifier. Google does not learn whose note it is.</p>
      <p>The model is free, so Google may use what is sent <strong>to train its models</strong>. An authorised Google employee may also read it and describe it. That is how the free tier of the Gemini API works and it cannot be switched off. Google states that it detaches the data from the account, the key and the project before any such review. Regardless of that, content sent to KajetAI is kept by Google for <strong>55 days</strong> for abuse detection.</p>
      <p>On the Kajet side we save your instructions and KajetAI's one-sentence replies (see section <a href="#sek5">5</a>) and - separately, with no content and no note identifier - the bare fact of a call: the date, the kind of note, the name of the model and the number of units used. The second of these serves only to keep watch over limits and costs.</p>
      <p>You confirm consent once, at first use, and you can withdraw it at any time in the account settings. Withdrawing it deletes the saved instructions and switches the feature off; it has no effect on what Google has already received.</p>

      <h3>3.10. What we do not do</h3>
      <p>Kajet has <strong>no</strong> analytics, no visitor statistics, no advertising, no ad networks, no tracking tools, no profiling and no automated decision-making producing legal effects concerning you. Data is not sold or shared for marketing purposes - to anyone, ever.</p>

      <h2 id="sek4">4. Why, and on what legal basis</h2>

      <p>The legal bases come from Article 6(1) of the GDPR.</p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Purpose</th><th>Data</th><th>Legal basis</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Changing the content of a note with KajetAI, including passing it to Google</td>
              <td>note content, its title, your instructions</td>
              <td><strong>point (a)</strong> - your consent, voluntary and withdrawable at any time</td>
            </tr>
            <tr>
              <td>Running the account, storing and synchronising notes, sharing them with the people you share them with, running the code from notes</td>
              <td>account data, note content and attachments, the content of the code being run, device data, shares</td>
              <td><strong>point (b)</strong> - performance of the contract you enter into by creating an account</td>
            </tr>
            <tr>
              <td>Confirming the e-mail address, password recovery, notice of a shared note, the account-deletion code, the warning before an unused account is deleted</td>
              <td>e-mail address, login, title of the shared note</td>
              <td><strong>point (b)</strong> - performance of the contract</td>
            </tr>
            <tr>
              <td>Protecting accounts against password and code guessing, and the server against abuse</td>
              <td>e-mail address and IP address on a failed sign-in (in program memory only), IP address with a crash report</td>
              <td><strong>point (f)</strong> - legitimate interest: keeping accounts safe and the service running</td>
            </tr>
            <tr>
              <td>Fixing bugs in the application</td>
              <td>crash reports together with the IP address</td>
              <td><strong>point (f)</strong> - legitimate interest: removing faults in one's own program</td>
            </tr>
            <tr>
              <td>Being able to establish who changed what on an account, and when</td>
              <td>administrator action log</td>
              <td><strong>point (f)</strong> - legitimate interest: accountability and settling disputes</td>
            </tr>
            <tr>
              <td>Handling complaints and answering enquiries</td>
              <td>e-mail address, the content of the enquiry, account data</td>
              <td><strong>points (b) and (f)</strong> - performance of the contract and defence against claims</td>
            </tr>
            <tr>
              <td>Signing in with a Google account</td>
              <td>e-mail address, first name, profile picture, tokens issued by Google</td>
              <td><strong>point (b)</strong> - performance of the contract; using this way of signing in is entirely voluntary</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="sek5">5. How long we keep data</h2>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Data</th><th>Retention</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>The account and everything tied to it (notes, attachments, folders, shares, devices)</td>
              <td>Until the account is deleted. Deleting the account erases this data irreversibly.</td>
            </tr>
            <tr>
              <td>An account nobody uses</td>
              <td>After <strong>365 days</strong> with no sign of use we send a warning to the e-mail address. If nothing happens for another <strong>30 days</strong>, the account is deleted with all its data. Use means signing in, synchronising from the application or saving a note - any one of them starts the count again.</td>
            </tr>
            <tr>
              <td>A note in the bin</td>
              <td><strong>30 days</strong>, after which it disappears irreversibly together with its attachments. Until then you can restore it or empty the bin by hand.</td>
            </tr>
            <tr>
              <td>Crash reports (with the IP address)</td>
              <td>The <strong>500 newest reports and nothing older than 90 days</strong> are kept - older ones delete themselves.</td>
            </tr>
            <tr>
              <td>Failed sign-in attempts</td>
              <td><strong>15 minutes</strong>, in the memory of the running program only. Nothing is written to disk.</td>
            </tr>
            <tr>
              <td>Website session (cookie)</td>
              <td><strong>30 days</strong> from signing in. It ends earlier on signing out, changing the password or “sign out everywhere”.</td>
            </tr>
            <tr>
              <td>The content of code sent to be run, and its output</td>
              <td>Until the run finishes, a few seconds at most. The program's files and the container are deleted as soon as it ends; nothing reaches the database or the log.</td>
            </tr>
            <tr>
              <td>Instructions given to KajetAI and its replies</td>
              <td><strong>24 hours</strong> from the last instruction about a given note. You can delete them sooner - with the button in the KajetAI panel, or by withdrawing consent.</td>
            </tr>
            <tr>
              <td>Record of KajetAI calls for billing (no content, no note identifier)</td>
              <td>Until the account is deleted.</td>
            </tr>
            <tr>
              <td>Content sent to Google by KajetAI</td>
              <td>On Google's side: <strong>55 days</strong> for abuse detection. The model is free, so Google may use that content to train its models - once sent, it cannot be undone (section <a href="#sek3-9">3.9</a>).</td>
            </tr>
            <tr>
              <td>Device token in the application</td>
              <td>Until the device signs out, has its access withdrawn, the password is changed or the account is deleted. It does not expire on its own.</td>
            </tr>
            <tr>
              <td>Links and codes sent by e-mail (address confirmation, password change, account deletion)</td>
              <td><strong>24 hours</strong>, <strong>1 hour</strong> and <strong>1 hour</strong> respectively; each works once.</td>
            </tr>
            <tr>
              <td>Administrator action log</td>
              <td>For as long as the service runs. An entry holds the login, the kind of action and the date - <strong>no e-mail address</strong>.</td>
            </tr>
            <tr>
              <td>Backups</td>
              <td><strong>3 days.</strong> Backups are made by the hosting provider for the whole server. Deleted data disappears from them after three days at the latest.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="sek6">6. Who else can reach the data</h2>

      <p>Apart from the administrator, data reaches only the parties listed below. It is passed, sold or made available to nobody else.</p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Who</th><th>What for</th><th>What they get</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>SkyPass Solutions Sp. z o.o.</strong>, Warsaw - hosting provider; the server stands in Poland, in a data centre in Wrocław</td>
              <td>Keeping the server and the backups running</td>
              <td>Technical access to the whole server, and so to all the data on it - as a processor, only as far as maintaining the machine requires</td>
            </tr>
            <tr>
              <td><strong>The mail server in the wojtoteka.ovh domain</strong> (the same provider)</td>
              <td>Sending messages: address confirmation, password change, invitation, notice of a share, the account-deletion code, the warning about an unused account</td>
              <td>The recipient's e-mail address and the content of the message, including the sender's login and the title of the shared note</td>
            </tr>
            <tr>
              <td><strong>Google LLC</strong> (United States) - the Gemini language model, only for KajetAI</td>
              <td>Making the change to the note that you ask for</td>
              <td>The content of the note and your instruction - only when you have been granted the permission, have confirmed consent, and ask KajetAI for a change yourself. Details in section <a href="#sek3-9">3.9</a>.</td>
            </tr>
            <tr>
              <td><strong>Google LLC</strong> (United States) - typefaces and icons</td>
              <td>The website loads typefaces and icons directly from Google's servers</td>
              <td>The IP address and browser information of everyone opening the site, signed in or not. Google receives no account data and no note content this way.</td>
            </tr>
            <tr>
              <td><strong>Google LLC</strong> - signing in with a Google account</td>
              <td>Only if you choose this way of signing in</td>
              <td>What happens between you and Google when signing in anyway. In return Kajet receives your e-mail address, first name and profile picture.</td>
            </tr>
            <tr>
              <td><strong>Google LLC</strong> - handwriting recognition model (ML Kit)</td>
              <td>A one-off download of the Polish model into the application, if you turn on handwriting-to-text</td>
              <td>The download of the model file itself. <strong>Recognition then works offline and your handwriting is sent nowhere.</strong></td>
            </tr>
            <tr>
              <td><strong>People you share a note with</strong></td>
              <td>Sharing by link or personally</td>
              <td>The content of the shared note and your login. You decide the scope and can withdraw access at any time.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="sek7">7. Transfers outside the European Economic Area</h2>

      <p><strong>The Kajet server, the database, the notes and the attachments are in Poland only and do not leave the European Economic Area.</strong> Code from notes is run on that same machine.</p>

      <p>What leaves the EEA - to Google LLC in the United States - is:</p>
      <ul>
        <li>the <strong>IP address and browser information</strong> of everyone opening the site, when typefaces and icons are loaded,</li>
        <li>the data exchanged when signing in with Google, if you choose that way,</li>
        <li>the request for the handwriting model file, if you turn that feature on in the application,</li>
        <li>the <strong>content of a note and your instruction</strong> - if and only if you ask KajetAI for a change yourself (section <a href="#sek3-9">3.9</a>). The Gemini API does not allow a processing region to be chosen, so the data may be processed and stored in any country where Google maintains facilities.</li>
      </ul>

      <p>Google LLC participates in the Data Privacy Framework, which the European Commission has recognised as providing an adequate level of protection (implementing decision of 10 July 2023), and additionally applies standard contractual clauses.</p>

      <div className="legal-note legal-note-warning">
        <p style={{ margin: "0" }}><strong>Apart from KajetAI, the content of notes does not leave the EEA.</strong> Without that feature - that is, by default, until you are given access to it and consent to it yourself - notes and attachments sit on the server in Poland only.</p>
      </div>

      <h2 id="sek8">8. Data that stays on your device</h2>

      <p>Some data never leaves your phone or tablet and the administrator has no access to it:</p>
      <ul>
        <li><strong>notes as files</strong> - in the folder you choose yourself the first time you start the application,</li>
        <li><strong>the search index</strong> - a database with the titles and content of notes, so that search works instantly and offline,</li>
        <li><strong>application settings</strong> - theme, finger behaviour, default page kind, language, remembered pens and colours,</li>
        <li><strong>the account token</strong> - in Android's encrypted store, whose key sits in the device's hardware keystore,</li>
        <li><strong>the five most recent crash reports</strong> - in the application's files,</li>
        <li><strong>photos from the camera</strong> - briefly in the cache, before they go into a note.</li>
      </ul>

      <p>The application asks for two permissions only: <strong>internet access</strong> and <strong>checking the network state</strong>. It has no camera permission (the photo is taken by the system camera application on your command), no file permission (you pick the folder yourself through the system picker), and no access to contacts or location.</p>

      <p>If you have Android backup switched on, the system may place application data in your backup on your Google account. That happens outside Kajet, on Google's terms, and you can switch it off in your device settings.</p>

      <p>Uninstalling the application removes the settings, the index and the token. <strong>The note files stay</strong> in the folder you chose - they are your files and only you decide when they go.</p>

      <h2 id="sek9">9. Cookies and browser storage</h2>

      <p>The website uses only cookies necessary for it to work. <strong>There are no analytics, statistics or advertising cookies</strong>, which is why we do not ask for cookie consent - none is required for strictly necessary cookies.</p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Name</th><th>What for</th><th>How long</th></tr>
          </thead>
          <tbody>
            <tr><td>session cookie (Auth.js)</td><td>Keeps you signed in on the website</td><td>30 days</td></tr>
            <tr><td><code>kajet.kod</code></td><td>Carries the invite code across the trip to Google and back when creating an account</td><td>30 minutes</td></tr>
            <tr><td><code>kajet-jezyk</code></td><td>Remembers the chosen language of the site</td><td>Until changed or the browser is cleared</td></tr>
            <tr><td><code>kajet-paleta</code></td><td>Remembers your custom pen colours in the handwriting editor on the website</td><td>One year</td></tr>
            <tr><td><code>kajet-motyw</code> (local storage, not a cookie)</td><td>Remembers the light or dark theme choice</td><td>Until changed or the browser is cleared</td></tr>
          </tbody>
        </table>
      </div>

      <h2 id="sek10">10. Your rights</h2>

      <p>In connection with the processing of your data you have the right to:</p>
      <ul>
        <li><strong>access</strong> your data and receive a copy of it,</li>
        <li><strong>rectification</strong> of inaccurate data and completion of incomplete data - you can change your login and password yourself in the account settings,</li>
        <li><strong>erasure</strong> (“the right to be forgotten”) - see section <a href="#sek11">11</a>,</li>
        <li><strong>restriction of processing</strong> - you may ask that data only be stored, without further use,</li>
        <li><strong>data portability</strong> - receiving your data in a commonly used, machine-readable format. You can also do this yourself, without asking anyone: the application keeps notes as ordinary files in the folder you chose and can export them to PDF, DOCX and Markdown,</li>
        <li><strong>object</strong> to processing based on legitimate interest (crash reports, the administrator action log, protection against abuse) - on grounds relating to your particular situation.</li>
      </ul>

      <p>Sending a request to <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a> is enough. You will get an answer without undue delay, and within <strong>one month</strong> of the request at the latest. Exercising these rights is free of charge.</p>

      <p>You also have the right to <strong>lodge a complaint with the supervisory authority</strong> if you believe the processing of your data breaches the rules:</p>
      <p style={{ marginLeft: 14 }}>President of the Personal Data Protection Office (Prezes Urzędu Ochrony Danych Osobowych)<br />ul. Stawki 2, 00-193 Warsaw, Poland<br /><a href="https://uodo.gov.pl">uodo.gov.pl</a></p>

      <h2 id="sek11">11. Deleting your account</h2>

      <p>You delete the account yourself, in the account settings on the website. It takes two steps: first we send a code to the e-mail address tied to the account, then you type it into the panel. Once the code is in, the account disappears immediately. The second step exists so that an irreversible deletion cannot be triggered by someone who sits down at your open browser for a moment.</p>

      <p>The code is valid for <strong>one hour</strong>, works once, and after five wrong attempts entering it is closed for fifteen minutes. If the message does not arrive, or you would rather handle it differently, write to <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a> from the address tied to the account.</p>

      <p>Deleting the account means the irreversible erasure of: all notes with their content, all attachments from the server's disk, folders, all shared links (they stop working at once), the tokens of signed-in devices, the link to your Google account and the account itself. <strong>This cannot be undone.</strong> The data disappears from backups after three days at the latest.</p>

      <p>What stays in the administrator action log is only the trace that an account with a given login was deleted, with the date and the number of notes - no e-mail address and no content of any kind.</p>

      <p>The account will also be deleted automatically if nobody uses it for a year - after a warning sent by e-mail and a month of waiting (details in section <a href="#sek5">5</a>).</p>

      <h2 id="sek12">12. How the data is protected</h2>

      <ul>
        <li>All traffic with the website and the API goes over an <strong>encrypted connection (HTTPS)</strong>.</li>
        <li><strong>Passwords are not stored.</strong> The database holds only an irreversible hash computed with bcrypt at cost 12. The administrator does not know and cannot recover your password.</li>
        <li><strong>Device tokens are not stored either</strong> - the database holds only their SHA-256 hashes. You see a token once, at the moment of signing in.</li>
        <li>In the application the token sits in <strong>Android's encrypted store</strong> (AES-256-GCM), with the key in the device's hardware keystore.</li>
        <li>Five failed sign-ins in a row <strong>close signing in for fifteen minutes</strong>, counted separately for the e-mail address and for the address the request came from.</li>
        <li>Changing the password and “sign out everywhere” <strong>invalidate every session and every token</strong> on all devices at once.</li>
        <li>Only images and JSON files are accepted, up to 25 MB, and the file type is checked against the actual bytes rather than what was declared.</li>
        <li>Code from notes runs in a <strong>container cut off from the network</strong>, with limited memory, time and privileges. It requires signing in, and the content of the program and its output are deleted together with the container as soon as it finishes.</li>
        <li>Access to the server and the database belongs to <strong>the administrator alone</strong> and - technically - to the hosting provider that maintains the machine.</li>
      </ul>

      <div className="legal-note legal-note-warning">
        <p><strong>Something that has to be said plainly:</strong> the content of notes is not encrypted in the database. Kajet does not use end-to-end encryption. This means that the administrator - having access to the server - is <strong>technically</strong> able to read the content of notes kept in the cloud.</p>
        <p style={{ marginBottom: "0" }}>The administrator does not look into other people's notes and does so for no purpose other than where legally obliged. The administrator panel has no feature for browsing other people's notes. If, however, you have notes that must stay secret from everyone - <strong>keep them without synchronisation, on your device only</strong>.</p>
      </div>

      <h2 id="sek13">13. Age of the user</h2>

      <p>An account in Kajet may be created by a person who is at least <strong>13 years old</strong>. A minor should use Kajet with the knowledge and consent of a parent or legal guardian.</p>

      <p>We do not knowingly collect data of people under 13. If it turns out that an account was created by someone younger, it will be deleted with all its data. If you are a parent or guardian and want to report such a case, write to <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>.</p>

      <h2 id="sek14">14. Is giving your data required</h2>

      <p>Giving your data is voluntary, but necessary to use an account. Without an e-mail address an account cannot be created, confirmed or recovered - and without an account there is no synchronisation, no sharing and no working across several devices. <strong>The application itself can be used without an account and without giving any data at all.</strong></p>

      <h2 id="sek15">15. Changes to this policy</h2>

      <p>This policy may change when the way Kajet works changes, or when the law does. A new version appears at the same address, with the date of the last update at the top. Users with an account are told about changes that matter to them by e-mail or by a message on the website, at least 14 days in advance.</p>

      <h2 id="sek16">16. Contact</h2>

      <p>For anything concerning personal data, including exercising the rights described in section 10:</p>
      <p style={{ marginLeft: 14 }}>Wojciech Szaliński (Wojtoteka)<br /><a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a></p>

      <p><a className="legal-backlink" href="/terms">See also: Terms of service</a></p>

    </>
  );
}
