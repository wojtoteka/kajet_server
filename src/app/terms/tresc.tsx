/*
  Treść dokumentu, słowo w słowo w obu językach.

  Nie idzie przez słownik z lib/i18n.ts - tamten trzyma pojedyncze zdania
  interfejsu, a tu są dwa dokumenty po kilkadziesiąt akapitów z odnośnikami,
  wyliczeniami i tabelami. Wersję wybiera strona po języku serwisu, tym samym,
  którym steruje przełącznik PL/EN w nagłówku.

  Numery kotwic (#par1, #par2, …) są wspólne dla obu wersji, więc przełączenie
  języka zostawia człowieka przy tym samym paragrafie.
*/

export function RegulaminPl() {
  return (
    <>
      <div className="legal-sheet legal-accent">
        <p className="eyebrow">Kajet</p>
        <h1>Regulamin</h1>
        <p className="lead">Ostatnia aktualizacja: 9 sierpnia 2026 r.</p>
      </div>

      <div className="legal-sheet legal-toc">
        <p className="eyebrow">Spis treści</p>
        <ol>
          <li><a href="#par1">§ 1. Postanowienia ogólne</a></li>
          <li><a href="#par2">§ 2. Czym jest Kajet</a></li>
          <li><a href="#par3">§ 3. Wymagania techniczne</a></li>
          <li><a href="#par4">§ 4. Zakładanie konta</a></li>
          <li><a href="#par5">§ 5. Odpłatność</a></li>
          <li><a href="#par6">§ 6. Miejsce na dane</a></li>
          <li><a href="#par7">§ 7. Obowiązki użytkownika</a></li>
          <li><a href="#par8">§ 8. Zakaz treści bezprawnych</a></li>
          <li><a href="#par9">§ 9. Notatki należą do użytkownika</a></li>
          <li><a href="#par10">§ 10. Udostępnianie notatek</a></li>
          <li><a href="#par11">§ 11. Uruchamianie kodu</a></li>
          <li><a href="#par11a">§ 11a. Asystent KajetAI</a></li>
          <li><a href="#par12">§ 12. Blokada konta</a></li>
          <li><a href="#par13">§ 13. Rezygnacja i usunięcie konta</a></li>
          <li><a href="#par14">§ 14. Etap rozwojowy i ryzyko utraty danych</a></li>
          <li><a href="#par15">§ 15. Odpowiedzialność</a></li>
          <li><a href="#par16">§ 16. Reklamacje</a></li>
          <li><a href="#par17">§ 17. Zmiany regulaminu</a></li>
          <li><a href="#par18">§ 18. Prawo właściwe i spory</a></li>
          <li><a href="#par19">§ 19. Postanowienia końcowe</a></li>
        </ol>
      </div>

      <h2 id="par1">§ 1. Postanowienia ogólne</h2>
      <ol className="legal-items">
        <li>Regulamin określa zasady korzystania z serwisu Kajet i stanowi regulamin świadczenia usług drogą elektroniczną w rozumieniu art. 8 ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.</li>
        <li>Usługodawcą jest <strong>Wojciech Szaliński</strong>, działający pod nazwą <strong>Wojtoteka</strong>, osoba fizyczna nieprowadząca działalności gospodarczej, adres poczty elektronicznej: <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>. W dalszej części regulaminu nazywany „Administratorem”.</li>
        <li>Ilekroć w regulaminie mowa o:
          <ul>
            <li><strong>Kajecie</strong> — rozumie się przez to łącznie stronę internetową pod adresem <a href="https://kajet.wojtoteka.ovh">kajet.wojtoteka.ovh</a> oraz aplikację Kajet na system Android,</li>
            <li><strong>Użytkowniku</strong> — osobę korzystającą z Kajetu,</li>
            <li><strong>Koncie</strong> — zbiór danych i zasobów Użytkownika na serwerze Kajetu,</li>
            <li><strong>Notatce</strong> — dokument utworzony w Kajecie: pismo odręczne, tekst, mapa myśli albo kod, wraz z załącznikami.</li>
          </ul>
        </li>
        <li>Kontakt z Administratorem odbywa się pocztą elektroniczną, pod adresem podanym w ust. 2.</li>
        <li>Zasady przetwarzania danych osobowych opisuje odrębny dokument: <a href="/privacy">Polityka prywatności</a>.</li>
        <li>Regulamin jest dostępny po polsku i po angielsku. <strong>Wersja polska jest wiążąca</strong>; wersja angielska ma charakter pomocniczy i w razie rozbieżności rozstrzyga brzmienie polskie.</li>
      </ol>

      <h2 id="par2">§ 2. Czym jest Kajet</h2>
      <ol className="legal-items">
        <li>Kajet jest notatnikiem. Pozwala tworzyć notatki pisane odręcznie rysikiem, notatki tekstowe, mapy myśli oraz notatki z kodem, porządkować je w folderach, oznaczać znacznikami i wyszukiwać.</li>
        <li>Aplikacja na Androida działa <strong>samodzielnie, bez konta i bez internetu</strong>. Notatki przechowuje wtedy jako pliki w folderze wskazanym przez Użytkownika na jego urządzeniu.</li>
        <li>Konto jest dobrowolne i rozszerza Kajet o: przechowywanie notatek na serwerze, synchronizację między urządzeniami, dostęp do notatek przez przeglądarkę, udostępnianie notatek innym osobom oraz wspólne pisanie w czasie rzeczywistym.</li>
        <li>Usługa świadczona jest w miarę możliwości nieprzerwanie, przez całą dobę. Administrator zastrzega sobie prawo do przerw technicznych niezbędnych do konserwacji, naprawy albo rozwoju Kajetu.</li>
        <li>Administrator może zmieniać, rozwijać i wycofywać poszczególne funkcje Kajetu. O wycofaniu funkcji istotnej dla korzystania z Konta Administrator uprzedza w sposób opisany w § 17.</li>
      </ol>

      <h2 id="par3">§ 3. Wymagania techniczne</h2>
      <ol className="legal-items">
        <li>Do korzystania z aplikacji potrzebne są: urządzenie z systemem <strong>Android 8.0 lub nowszym</strong>, procesor w architekturze <strong>arm64</strong> oraz wolne miejsce na notatki. Rysik nie jest wymagany, ale bez niego pismo odręczne stawia się palcem.</li>
        <li>Do korzystania ze strony potrzebna jest przeglądarka internetowa w aktualnej wersji, z <strong>włączoną obsługą JavaScriptu i ciasteczek</strong>.</li>
        <li>Do synchronizacji, logowania, udostępniania i pobierania aktualizacji potrzebne jest połączenie z internetem. Pisanie notatek na urządzeniu połączenia nie wymaga.</li>
        <li>Zamiana pisma odręcznego na tekst wymaga jednorazowego pobrania modelu językowego z serwerów Google. Po pobraniu funkcja działa bez internetu.</li>
        <li>Korzystanie z Kajetu wiąże się ze zwykłymi zagrożeniami sieci internet, w szczególności z ryzykiem przechwycenia danych przez osoby trzecie, działania złośliwego oprogramowania i prób wyłudzenia hasła. Administrator zabezpiecza połączenie szyfrowaniem i chroni hasła w sposób opisany w Polityce prywatności, jednak Użytkownik powinien używać niepowtarzalnego hasła i nie udostępniać go nikomu.</li>
      </ol>

      <h2 id="par4">§ 4. Zakładanie konta</h2>
      <ol className="legal-items">
        <li>Kajet jest serwisem <strong>na zaproszenie</strong>. Założenie Konta wymaga ważnego kodu zaproszenia wydanego przez Administratora. Bez kodu Konta założyć się nie da — także przez Google.</li>
        <li>Konto zakłada się na stronie, podając kod zaproszenia, adres e-mail i hasło (co najmniej 8 znaków), albo wybierając logowanie przez konto Google. W aplikacji Konta się nie zakłada — aplikacja służy do zalogowania się na Konto już istniejące.</li>
        <li>Przy zakładaniu Konta Użytkownik przyjmuje regulamin i zapoznaje się z polityką prywatności. Bez tego Konto nie powstaje.</li>
        <li>Na podany adres e-mail wysyłana jest wiadomość z odnośnikiem potwierdzającym adres. Odnośnik jest ważny przez dobę.</li>
        <li>Konto może założyć osoba, która <strong>ukończyła 13 lat</strong>. Osoba niepełnoletnia korzysta z Kajetu za wiedzą i zgodą rodzica lub opiekuna prawnego.</li>
        <li>Na jeden adres e-mail przypada jedno Konto.</li>
        <li>Zawarcie umowy o świadczenie usług drogą elektroniczną następuje z chwilą założenia Konta. Umowa zawierana jest na czas nieokreślony.</li>
        <li>Użytkownik odpowiada za zachowanie hasła w tajemnicy. O podejrzeniu, że ktoś obcy uzyskał dostęp do Konta, należy niezwłocznie zawiadomić Administratora. Zmiana hasła unieważnia wszystkie sesje i wszystkie zalogowane urządzenia.</li>
      </ol>

      <h2 id="par5">§ 5. Odpłatność</h2>
      <ol className="legal-items">
        <li>Korzystanie z Kajetu jest <strong>bezpłatne</strong>. Aplikacja jest bezpłatna, Konto jest bezpłatne, a za korzystanie z niego nie są pobierane żadne opłaty ani prowizje.</li>
        <li>Kajet nie zawiera reklam, nie sprzedaje danych i nie udostępnia ich w celach marketingowych.</li>
        <li>W pojedynczych przypadkach Administrator może uzgodnić z konkretną osobą <strong>odpłatny dostęp</strong> do Kajetu. Warunki takiego dostępu, w tym wysokość opłaty i okres, na jaki jest wnoszona, ustalane są indywidualnie i wyłącznie przed założeniem Konta. Bez wyraźnego, uprzedniego uzgodnienia korzystanie z Kajetu pozostaje bezpłatne.</li>
        <li>Administrator nie może wprowadzić opłaty za Konto już istniejące bez zgody Użytkownika. Jeżeli Użytkownik takiej zgody nie wyrazi, dalsze korzystanie z Konta pozostaje na dotychczasowych, bezpłatnych warunkach albo Konto może zostać usunięte na zasadach z § 13.</li>
      </ol>

      <h2 id="par6">§ 6. Miejsce na dane</h2>
      <ol className="legal-items">
        <li>Każde Konto ma limit miejsca na serwerze. Miejsce przyznaje Administrator – przy kodzie zaproszenia albo później – i może przyznać limit dowolnej wielkości, nieograniczony albo czasowy. Konto, któremu miejsca nie przyznano, ma <strong>0 MB</strong> i nie zapisze na serwerze żadnej Notatki; na samym urządzeniu Kajet działa wtedy bez zmian.</li>
        <li>Pojedynczy załącznik może ważyć najwyżej <strong>25 MB</strong>. Przyjmowane są obrazy (PNG, JPEG, WebP, GIF, SVG) oraz pliki JSON.</li>
        <li>Po wyczerpaniu limitu Kajet odmawia zapisania nowych danych na serwerze. Notatki już zapisane pozostają dostępne, a pisanie na samym urządzeniu działa dalej. Miejsce zwalnia się, kasując notatki i opróżniając kosz.</li>
        <li>Aktualny stan zajętości Użytkownik widzi w ustawieniach Konta na stronie oraz w aplikacji.</li>
      </ol>

      <h2 id="par7">§ 7. Obowiązki użytkownika</h2>
      <ol className="legal-items">
        <li>Użytkownik korzysta z Kajetu zgodnie z prawem, regulaminem i dobrymi obyczajami.</li>
        <li>Zabronione jest w szczególności:
          <ul>
            <li>podejmowanie prób obejścia zabezpieczeń, uzyskania dostępu do cudzych Kont albo do danych, do których Użytkownik nie ma prawa,</li>
            <li>działanie zakłócające pracę serwera lub innych Użytkowników, w tym automatyczne generowanie ruchu, masowe zapytania i próby przeciążenia usługi,</li>
            <li>zakładanie Kont w sposób zautomatyzowany oraz odsprzedawanie i publiczne rozpowszechnianie kodów zaproszeń,</li>
            <li>udostępnianie własnych danych logowania osobom trzecim,</li>
            <li>wykorzystywanie Kajetu jako magazynu plików niezwiązanych z notatkami.</li>
          </ul>
        </li>
        <li>Użytkownik odpowiada za treści, które umieszcza w Kajecie, oraz za skutki ich udostępnienia innym osobom.</li>
      </ol>

      <h2 id="par8">§ 8. Zakaz treści bezprawnych</h2>
      <ol className="legal-items">
        <li>Zabronione jest umieszczanie w Kajecie i udostępnianie za jego pośrednictwem <strong>treści o charakterze bezprawnym</strong>, w szczególności: naruszających cudze prawa autorskie, dobra osobiste lub tajemnicę przedsiębiorstwa; nawołujących do nienawiści lub przemocy; propagujących ustroje totalitarne; przedstawiających seksualne wykorzystywanie małoletnich; służących oszustwu, wyłudzeniu danych lub rozpowszechnianiu złośliwego oprogramowania; a także danych uzyskanych w wyniku przestępstwa.</li>
        <li>W razie otrzymania urzędowego zawiadomienia lub wiarygodnej wiadomości o bezprawnym charakterze przechowywanych treści Administrator niezwłocznie uniemożliwi dostęp do tych treści, zgodnie z art. 14 ustawy o świadczeniu usług drogą elektroniczną.</li>
        <li>O uniemożliwieniu dostępu Administrator zawiadamia Użytkownika pocztą elektroniczną, chyba że zawiadomienie takie byłoby niezgodne z prawem. Użytkownik może odnieść się do zarzutu, pisząc na adres podany w § 1 ust. 2; jeżeli zarzut okaże się bezpodstawny, dostęp do treści zostaje przywrócony.</li>
        <li>Zgłoszenia treści bezprawnych przyjmowane są pod adresem <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>. Zgłoszenie powinno wskazywać odnośnik do treści oraz powód, dla którego zgłaszający uważa je za bezprawne.</li>
      </ol>

      <h2 id="par9">§ 9. Notatki należą do użytkownika</h2>
      <ol className="legal-items">
        <li><strong>Wszelkie prawa do treści notatek pozostają przy Użytkowniku.</strong> Administrator nie nabywa do nich żadnych praw — ani majątkowych praw autorskich, ani licencji wykraczającej poza to, co opisano w ust. 2.</li>
        <li>Administrator przechowuje i przetwarza notatki wyłącznie w zakresie technicznie niezbędnym do świadczenia usługi: zapisania ich na serwerze, przesłania na urządzenia Użytkownika, pokazania w przeglądarce, udostępnienia osobom wskazanym przez Użytkownika, wykonania kopii zapasowej i usunięcia na żądanie.</li>
        <li>Notatki nie są wykorzystywane w żadnym innym celu. W szczególności nie są <strong>czytane, analizowane, publikowane ani wykorzystywane do uczenia modeli sztucznej inteligencji</strong>. Jedyny wyjątek to KajetAI: notatka, przy której Użytkownik sam o to poprosi, jest wysyłana do Google na zasadach opisanych w § 11a.</li>
        <li>Treść notatek przechowywanych na serwerze <strong>nie jest szyfrowana</strong> w sposób uniemożliwiający jej odczytanie przez Administratora. Kajet nie stosuje szyfrowania end-to-end. Użytkownik, który chce mieć pewność, że danej notatki nie odczyta nikt poza nim, powinien trzymać ją wyłącznie na swoim urządzeniu, bez synchronizacji.</li>
        <li>Aplikacja pozwala w każdej chwili wyeksportować notatki do plików PDF, DOCX i Markdown, a notatki na urządzeniu leżą jako zwykłe pliki w folderze wskazanym przez Użytkownika. Nic nie jest zamknięte w Kajecie.</li>
      </ol>

      <h2 id="par10">§ 10. Udostępnianie notatek</h2>
      <ol className="legal-items">
        <li>Użytkownik może udostępnić notatkę, tworząc odnośnik do czytania albo do wspólnego pisania. Odnośnik może być otwarty dla każdego, kto go zna, albo imienny — przypisany do wskazanego adresu e-mail.</li>
        <li><strong>Odnośnik otwarty działa dla każdego, kto go otrzyma</strong>, także dla osoby bez Konta. Za to, komu odnośnik zostanie przekazany, odpowiada Użytkownik.</li>
        <li>Udostępnieniu można nadać termin ważności. Dostęp można cofnąć w każdej chwili, kasując odnośnik.</li>
        <li>Przy udostępnieniu imiennym na wskazany adres wysyłana jest wiadomość zawierająca login udostępniającego i tytuł notatki. Użytkownik powinien podawać wyłącznie adresy osób, które życzą sobie takiej wiadomości.</li>
        <li>Przy wspólnym pisaniu każda ze stron widzi zmiany drugiej oraz nazwę, pod jaką druga osoba pisze.</li>
      </ol>

      <h2 id="par11">§ 11. Uruchamianie kodu</h2>
      <ol className="legal-items">
        <li>Notatki z kodem można uruchamiać: na urządzeniu (wbudowany tłumacz języka Python) albo na serwerze, jeżeli Administrator włączył tę funkcję.</li>
        <li>Kod uruchamiany na serwerze działa w odciętym od sieci kontenerze, z ograniczonym czasem działania, pamięcią i uprawnieniami, i nie ma dostępu do danych innych Użytkowników.</li>
        <li>Zabronione jest uruchamianie kodu, którego celem jest obejście tych ograniczeń, obciążenie serwera, wydobywanie kryptowalut, atak na inne systemy albo dostęp do cudzych danych.</li>
        <li>Administrator może odebrać prawo uruchamiania kodu pojedynczemu Kontu albo wyłączyć tę funkcję dla wszystkich, w szczególności gdy obciąża ona serwer. Pozostałe funkcje Kajetu działają wtedy bez zmian. <strong>W chwili ostatniej aktualizacji regulaminu uruchamianie kodu na serwerze jest wyłączone</strong>, a kod uruchamia się wyłącznie na urządzeniu.</li>
      </ol>

      <h2 id="par11a">§ 11a. Asystent KajetAI</h2>
      <ol className="legal-items">
        <li>Kajet udostępnia KajetAI — asystenta, który na polecenie Użytkownika zmienia treść notatki tekstowej, mapy myśli albo pliku z kodem. Przy notatkach odręcznych KajetAI nie działa.</li>
        <li>Funkcja jest <strong>opcjonalna i domyślnie niedostępna</strong>. Prawo do korzystania z niej nadaje pojedynczemu Kontu Administrator i może je w każdej chwili odebrać. Pozostałe funkcje Kajetu działają wtedy bez zmian.</li>
        <li>Skorzystanie z KajetAI oznacza, że <strong>treść notatki jest wysyłana do Google LLC</strong>, którego model językowy wprowadza zmianę. Model jest darmowy, więc Google może wykorzystać wysłaną treść do uczenia swoich modeli. Szczegóły opisuje punkt 3.9 <a href="/privacy#sek3-9">Polityki prywatności</a>.</li>
        <li>Przed pierwszym użyciem Użytkownik potwierdza zgodę na wysyłanie treści notatek do Google. <strong>Bez zgody KajetAI nie działa.</strong> Zgodę można wycofać w każdej chwili w ustawieniach konta.</li>
        <li><strong>Wyniki pracy modelu mogą być błędne, niepełne lub niezgodne z poleceniem.</strong> Model może też zmienić więcej, niż o to poproszono. Użytkownik odpowiada za sprawdzenie wprowadzonych zmian, zanim uzna notatkę za poprawną.</li>
        <li>Każdą zmianę wprowadzoną przez KajetAI można cofnąć jednym kliknięciem, dopóki nie zostanie zastąpiona kolejną zmianą. Administrator nie przechowuje wersji notatki sprzed zmiany dłużej niż do zamknięcia edytora.</li>
        <li>Liczba wywołań KajetAI jest ograniczona dobowo i godzinowo; Administrator może ustawić własny limit dla pojedynczego Konta oraz wyłączyć funkcję dla wszystkich, w szczególności gdy jej koszt albo obciążenie serwera tego wymagają.</li>
        <li>Zabronione jest używanie KajetAI do treści bezprawnych (§ 8), do obchodzenia limitów oraz do zautomatyzowanego, masowego przetwarzania treści.</li>
      </ol>

      <h2 id="par12">§ 12. Blokada konta</h2>
      <ol className="legal-items">
        <li>Administrator może zablokować Konto, jeżeli Użytkownik rażąco lub uporczywie narusza regulamin, w szczególności § 7 i § 8, albo gdy Konto zagraża bezpieczeństwu Kajetu lub innych Użytkowników.</li>
        <li>Zablokowane Konto nie pozwala się zalogować i nie przyjmuje synchronizacji. Dane pozostają na serwerze.</li>
        <li>O blokadzie i jej powodzie Administrator zawiadamia Użytkownika pocztą elektroniczną. Użytkownik może odwołać się od blokady, pisząc na adres podany w § 1 ust. 2; odpowiedź otrzyma w terminie 14 dni.</li>
        <li>Jeżeli naruszenie nie ustanie albo blokada okaże się uzasadniona i trwała, Administrator może usunąć Konto po uprzednim wezwaniu Użytkownika do zaprzestania naruszeń i wyznaczeniu terminu nie krótszego niż 14 dni na pobranie własnych danych.</li>
        <li>Blokada nie może być zastosowana z powodu samej treści notatek nieudostępnionych nikomu, z wyjątkiem przypadków, o których mowa w § 8 ust. 2.</li>
      </ol>

      <h2 id="par13">§ 13. Rezygnacja i usunięcie konta</h2>
      <ol className="legal-items">
        <li>Użytkownik może zrezygnować z Konta w każdej chwili, bez podania przyczyny i bez żadnych kosztów. Konto usuwa się samodzielnie, w ustawieniach Konta na stronie.</li>
        <li>Usunięcie Konta wymaga potwierdzenia kodem wysłanym na adres e-mail przypisany do Konta. Kod jest ważny godzinę i działa jeden raz. Po jego wpisaniu Konto jest kasowane natychmiast. Jeżeli wiadomość z kodem nie dojdzie, żądanie usunięcia Konta można też wysłać na adres <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a> z adresu e-mail przypisanego do Konta.</li>
        <li>Usunięcie Konta kasuje nieodwracalnie: wszystkie notatki wraz z treścią, wszystkie załączniki, foldery, wszystkie udostępnione odnośniki oraz tokeny zalogowanych urządzeń. Danych nie da się po tym odzyskać. <strong>Przed usunięciem Konta Użytkownik powinien wyeksportować to, co chce zachować.</strong></li>
        <li>Notatka wyrzucona do kosza jest kasowana na zawsze po <strong>30 dniach</strong>. Do tego czasu można ją przywrócić.</li>
        <li><strong>Konto, z którego nikt nie korzysta, jest kasowane automatycznie.</strong> Po 365 dniach bez logowania, synchronizacji i zapisania notatki na adres e-mail Konta wysyłane jest ostrzeżenie. Jeżeli przez kolejne 30 dni nadal nic się nie wydarzy, Konto jest kasowane razem ze wszystkimi danymi, w sposób opisany w ust. 3. Wystarczy zalogować się w tym czasie, żeby Konto zostało — licznik rusza wtedy od nowa.</li>
        <li>Administrator może wypowiedzieć umowę o świadczenie usług z zachowaniem 30-dniowego okresu wypowiedzenia, w szczególności gdy zdecyduje o zakończeniu działania Kajetu. Zawiadomienie wysyłane jest pocztą elektroniczną, a Użytkownik ma do końca okresu wypowiedzenia czas na pobranie swoich danych.</li>
        <li>Użytkownik będący konsumentem, który zawarł umowę na odległość, może odstąpić od niej w terminie <strong>14 dni</strong> od założenia Konta, bez podania przyczyny. Odstąpienie następuje przez usunięcie Konta w sposób opisany w ust. 1–3 albo przez oświadczenie wysłane na adres podany w ust. 2; skutek jest ten sam, opisany w ust. 3. Ponieważ usługa jest bezpłatna, z odstąpieniem nie wiążą się żadne rozliczenia.</li>
      </ol>

      <h2 id="par14">§ 14. Etap rozwojowy i ryzyko utraty danych</h2>

      <div className="legal-note legal-note-warning">
        <p style={{ margin: "0" }}><strong>To najważniejszy paragraf tego regulaminu. Przeczytaj go, zanim powierzysz Kajetowi coś, czego nie możesz stracić.</strong></p>
      </div>

      <ol className="legal-items">
        <li>Kajet jest <strong>oprogramowaniem we wczesnym etapie rozwoju</strong>, tworzonym i utrzymywanym przez jedną osobę, na małą skalę, dla wąskiego grona zaproszonych osób. Nie jest usługą komercyjną i nie ma zaplecza, jakim dysponują usługi tego rodzaju prowadzone przez przedsiębiorstwa.</li>
        <li>Oznacza to realne ryzyka, których Administrator nie ukrywa: <strong>awaria serwera, błąd w programie, pomyłka przy aktualizacji albo uszkodzenie bazy danych mogą doprowadzić do utraty notatek — także wszystkich naraz i bez ostrzeżenia.</strong></li>
        <li>Kopie zapasowe wykonywane są przez dostawcę hostingu dla całego serwera i przechowywane przez <strong>3 dni</strong>. Nie są usługą odtwarzania pojedynczej notatki na życzenie i nie stanowią gwarancji odzyskania danych. Administrator nie zobowiązuje się do przywrócenia utraconych treści.</li>
        <li><strong>Użytkownik powinien prowadzić własne kopie tego, co jest dla niego ważne.</strong> Kajet to ułatwia i nie stawia temu żadnych przeszkód:
          <ul>
            <li>notatki w aplikacji leżą jako zwykłe pliki w folderze wskazanym przez Użytkownika — wystarczy skopiować ten folder,</li>
            <li>każdą notatkę można wyeksportować do PDF, DOCX albo Markdown,</li>
            <li>notatki zsynchronizowane są w dwóch miejscach naraz: na urządzeniu i na serwerze.</li>
          </ul>
        </li>
        <li>Administrator dokłada starań, żeby Kajet działał poprawnie i żeby dane były bezpieczne, ale <strong>nie gwarantuje nieprzerwanego działania usługi, braku błędów ani zachowania danych</strong>.</li>
        <li>Administrator uprzedza z co najmniej 30-dniowym wyprzedzeniem o zamiarze zakończenia działania Kajetu, tak aby każdy zdążył pobrać swoje notatki.</li>
      </ol>

      <h2 id="par15">§ 15. Odpowiedzialność</h2>
      <ol className="legal-items">
        <li>Administrator odpowiada za należyte świadczenie usługi na zasadach określonych przepisami prawa, z uwzględnieniem tego, że usługa jest bezpłatna, a Kajet znajduje się na etapie opisanym w § 14.</li>
        <li>Administrator nie ponosi odpowiedzialności za:
          <ul>
            <li>skutki podania nieprawdziwego lub cudzego adresu e-mail przy zakładaniu Konta,</li>
            <li>skutki udostępnienia przez Użytkownika hasła lub odnośnika do notatki osobom trzecim,</li>
            <li>treść notatek Użytkownika i skutki ich udostępnienia,</li>
            <li>działanie sieci internet, urządzenia Użytkownika, jego systemu operacyjnego i przeglądarki,</li>
            <li>przerwy wynikające z awarii po stronie dostawcy hostingu, dostawcy poczty albo dostawcy usług, z których Kajet korzysta,</li>
            <li>skutki działania siły wyższej.</li>
          </ul>
        </li>
        <li>Ograniczenia odpowiedzialności zawarte w regulaminie <strong>nie wyłączają ani nie ograniczają</strong> odpowiedzialności Administratora za szkodę wyrządzoną umyślnie, za szkodę na osobie, ani odpowiedzialności, której nie da się wyłączyć zgodnie z bezwzględnie obowiązującymi przepisami prawa.</li>
        <li><strong>Wobec Użytkownika będącego konsumentem żadne postanowienie regulaminu nie ogranicza uprawnień przyznanych mu przepisami prawa</strong>, w szczególności ustawą o prawach konsumenta i Kodeksem cywilnym. W razie sprzeczności postanowienia regulaminu z takim przepisem stosuje się przepis.</li>
      </ol>

      <h2 id="par16">§ 16. Reklamacje</h2>
      <ol className="legal-items">
        <li>Reklamacje dotyczące działania Kajetu składa się pocztą elektroniczną na adres <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>.</li>
        <li>Reklamacja powinna zawierać: login lub adres e-mail Konta, opis tego, co nie działa, datę i przybliżoną godzinę zdarzenia oraz — jeżeli to możliwe — nazwę urządzenia i wersję aplikacji. Im więcej szczegółów, tym większa szansa na szybkie ustalenie przyczyny.</li>
        <li>Administrator rozpatruje reklamację i odpowiada na nią <strong>w terminie 14 dni</strong> od jej otrzymania, na adres e-mail, z którego reklamacja została wysłana.</li>
        <li>Brak odpowiedzi w terminie wskazanym w ust. 3 oznacza uznanie reklamacji.</li>
      </ol>

      <h2 id="par17">§ 17. Zmiany regulaminu</h2>
      <ol className="legal-items">
        <li>Administrator może zmienić regulamin w razie zmiany przepisów, zmiany sposobu działania Kajetu, dodania albo wycofania funkcji, zmiany zasad bezpieczeństwa albo zmiany danych Administratora.</li>
        <li>O zmianie regulaminu Użytkownicy posiadający Konto zawiadamiani są pocztą elektroniczną albo komunikatem na stronie, z co najmniej <strong>14-dniowym wyprzedzeniem</strong>. Nowa wersja publikowana jest pod tym samym adresem, z datą ostatniej aktualizacji na górze.</li>
        <li>Użytkownik, który nie zgadza się na zmianę, może przed jej wejściem w życie usunąć Konto na zasadach z § 13. Korzystanie z Kajetu po wejściu zmian w życie oznacza ich przyjęcie.</li>
        <li>Zmiany, które nie wpływają na prawa i obowiązki Użytkownika — poprawienie omyłki pisarskiej, uściślenie sformułowania, zmiana układu dokumentu — wchodzą w życie z chwilą publikacji.</li>
      </ol>

      <h2 id="par18">§ 18. Prawo właściwe i spory</h2>
      <ol className="legal-items">
        <li>W sprawach nieuregulowanych regulaminem stosuje się <strong>prawo polskie</strong>, w szczególności Kodeks cywilny, ustawę o świadczeniu usług drogą elektroniczną, ustawę o prawach konsumenta oraz przepisy o ochronie danych osobowych.</li>
        <li>Wybór prawa polskiego nie pozbawia Użytkownika będącego konsumentem ochrony wynikającej z bezwzględnie obowiązujących przepisów prawa państwa jego zwykłego pobytu.</li>
        <li>Spory rozstrzyga sąd właściwy według przepisów ogólnych. <strong>Wobec konsumenta nie stosuje się żadnego umownego zastrzeżenia sądu</strong> — pozostaje sąd właściwy zgodnie z Kodeksem postępowania cywilnego.</li>
        <li>Użytkownik będący konsumentem może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, w szczególności z pomocy powiatowego (miejskiego) rzecznika konsumentów, z mediacji prowadzonej przez wojewódzkiego inspektora Inspekcji Handlowej oraz z bezpłatnej infolinii konsumenckiej Urzędu Ochrony Konkurencji i Konsumentów. Szczegółowe informacje dostępne są na stronie <a href="https://uokik.gov.pl">uokik.gov.pl</a>. Skorzystanie z tych sposobów jest dobrowolne dla obu stron.</li>
      </ol>

      <h2 id="par19">§ 19. Postanowienia końcowe</h2>
      <ol className="legal-items">
        <li>Regulamin jest udostępniony nieodpłatnie pod adresem <a href="https://kajet.wojtoteka.ovh/terms">kajet.wojtoteka.ovh/terms</a>, w sposób umożliwiający jego pobranie, odtworzenie i zapisanie w każdej chwili.</li>
        <li>Jeżeli którekolwiek postanowienie regulaminu okaże się nieważne lub bezskuteczne, pozostałe postanowienia zachowują moc.</li>
        <li>Regulamin obowiązuje od <strong>7 sierpnia 2026 r.</strong></li>
      </ol>

      <p><a className="legal-backlink" href="/privacy">Zobacz też: Polityka prywatności</a></p>

    </>
  );
}

export function RegulaminEn() {
  return (
    <>
      <div className="legal-sheet legal-accent">
        <p className="eyebrow">Kajet</p>
        <h1>Terms of service</h1>
        <p className="lead">Last updated: 9 August 2026</p>
      </div>

      <div className="legal-note">
        <p style={{ margin: "0" }}>This is a courtesy translation. <strong>The Polish version is the binding one</strong>; if the two differ, the Polish wording prevails.</p>
      </div>

      <div className="legal-sheet legal-toc">
        <p className="eyebrow">Contents</p>
        <ol>
          <li><a href="#par1">§ 1. General provisions</a></li>
          <li><a href="#par2">§ 2. What Kajet is</a></li>
          <li><a href="#par3">§ 3. Technical requirements</a></li>
          <li><a href="#par4">§ 4. Creating an account</a></li>
          <li><a href="#par5">§ 5. Payment</a></li>
          <li><a href="#par6">§ 6. Storage space</a></li>
          <li><a href="#par7">§ 7. What the user must do</a></li>
          <li><a href="#par8">§ 8. Unlawful content is forbidden</a></li>
          <li><a href="#par9">§ 9. Your notes are yours</a></li>
          <li><a href="#par10">§ 10. Sharing notes</a></li>
          <li><a href="#par11">§ 11. Running code</a></li>
          <li><a href="#par11a">§ 11a. The KajetAI assistant</a></li>
          <li><a href="#par12">§ 12. Blocking an account</a></li>
          <li><a href="#par13">§ 13. Leaving and deleting the account</a></li>
          <li><a href="#par14">§ 14. Early development and the risk of losing data</a></li>
          <li><a href="#par15">§ 15. Liability</a></li>
          <li><a href="#par16">§ 16. Complaints</a></li>
          <li><a href="#par17">§ 17. Changes to these terms</a></li>
          <li><a href="#par18">§ 18. Governing law and disputes</a></li>
          <li><a href="#par19">§ 19. Final provisions</a></li>
        </ol>
      </div>

      <h2 id="par1">§ 1. General provisions</h2>
      <ol className="legal-items">
        <li>These terms set out the rules for using Kajet and constitute the terms of service for the provision of services by electronic means within the meaning of Article 8 of the Polish Act of 18 July 2002 on the provision of services by electronic means.</li>
        <li>The service provider is <strong>Wojciech Szaliński</strong>, operating under the name <strong>Wojtoteka</strong>, a private individual not conducting business activity, e-mail address: <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>. Referred to below as the “Administrator”.</li>
        <li>In these terms:
          <ul>
            <li><strong>Kajet</strong> means the website at <a href="https://kajet.wojtoteka.ovh">kajet.wojtoteka.ovh</a> together with the Kajet application for Android,</li>
            <li><strong>User</strong> means a person using Kajet,</li>
            <li><strong>Account</strong> means a User's data and resources on the Kajet server,</li>
            <li><strong>Note</strong> means a document created in Kajet: handwriting, text, a mind map or code, together with its attachments.</li>
          </ul>
        </li>
        <li>The Administrator is contacted by e-mail, at the address given in paragraph 2.</li>
        <li>The processing of personal data is described in a separate document: the <a href="/privacy">Privacy policy</a>.</li>
        <li>These terms are available in Polish and in English. <strong>The Polish version is binding</strong>; the English version is a courtesy translation and, in case of any discrepancy, the Polish wording prevails.</li>
      </ol>

      <h2 id="par2">§ 2. What Kajet is</h2>
      <ol className="legal-items">
        <li>Kajet is a notebook. It lets you write notes by hand with a stylus, write text notes, draw mind maps and write code, organise all of it in folders, tag it and search it.</li>
        <li>The Android application works <strong>on its own, without an account and without an internet connection</strong>. Notes are then kept as files in a folder the User chooses on their own device.</li>
        <li>An Account is optional. It adds: storing notes on the server, synchronising them between devices, reaching them through a browser, sharing them with other people and writing together in real time.</li>
        <li>The service runs around the clock as far as this is possible. The Administrator reserves the right to technical breaks needed for maintenance, repair or development.</li>
        <li>The Administrator may change, develop and withdraw individual features. Withdrawal of a feature that matters for the use of an Account is announced as described in § 17.</li>
      </ol>

      <h2 id="par3">§ 3. Technical requirements</h2>
      <ol className="legal-items">
        <li>The application needs a device running <strong>Android 8.0 or newer</strong>, an <strong>arm64</strong> processor and free space for notes. A stylus is not required, but without one handwriting is done with a finger.</li>
        <li>The website needs a current web browser with <strong>JavaScript and cookies enabled</strong>.</li>
        <li>Synchronisation, signing in, sharing and downloading updates need an internet connection. Writing notes on the device does not.</li>
        <li>Turning handwriting into text requires a one-off download of a language model from Google's servers. After that the feature works offline.</li>
        <li>Using Kajet carries the ordinary risks of the internet, in particular interception of data by third parties, malicious software and attempts to phish passwords. The Administrator encrypts the connection and protects passwords as described in the Privacy policy, but the User should use a unique password and share it with nobody.</li>
      </ol>

      <h2 id="par4">§ 4. Creating an account</h2>
      <ol className="legal-items">
        <li>Kajet is <strong>invite-only</strong>. Creating an Account requires a valid invite code issued by the Administrator. Without a code no Account can be created — not even through Google.</li>
        <li>An Account is created on the website by giving an invite code, an e-mail address and a password (at least 8 characters), or by choosing to sign in with a Google account. Accounts are not created in the application — the application signs you in to an Account that already exists.</li>
        <li>When creating an Account the User accepts these terms and reads the privacy policy. Without that no Account is created.</li>
        <li>A message with a link confirming the address is sent to the e-mail address given. The link is valid for 24 hours.</li>
        <li>An Account may be created by a person who is <strong>at least 13 years old</strong>. A minor uses Kajet with the knowledge and consent of a parent or legal guardian.</li>
        <li>One e-mail address means one Account.</li>
        <li>The contract for the provision of services by electronic means is concluded when the Account is created. It is concluded for an indefinite period.</li>
        <li>The User is responsible for keeping their password secret. Any suspicion that somebody else has reached the Account should be reported to the Administrator at once. Changing the password invalidates every session and every signed-in device.</li>
      </ol>

      <h2 id="par5">§ 5. Payment</h2>
      <ol className="legal-items">
        <li>Using Kajet is <strong>free of charge</strong>. The application is free, an Account is free, and no fees or commissions are charged for using it.</li>
        <li>Kajet carries no advertising, does not sell data and does not share it for marketing purposes.</li>
        <li>In individual cases the Administrator may agree <strong>paid access</strong> to Kajet with a particular person. The terms of such access, including the amount and the period it covers, are agreed individually and only before the Account is created. Without an express prior arrangement, using Kajet remains free.</li>
        <li>The Administrator may not introduce a charge for an existing Account without the User's consent. If the User does not consent, use of the Account continues on the current, free terms, or the Account may be deleted under § 13.</li>
      </ol>

      <h2 id="par6">§ 6. Storage space</h2>
      <ol className="legal-items">
        <li>Every Account has a storage limit on the server. The Administrator grants the space – with the invite code or later – and may grant an allowance of any size, unlimited or temporary. An Account that has been granted none has <strong>0 MB</strong> and will save no Note on the server; on the device itself Kajet keeps working as before.</li>
        <li>A single attachment may weigh at most <strong>25 MB</strong>. Images (PNG, JPEG, WebP, GIF, SVG) and JSON files are accepted.</li>
        <li>Once the limit is used up, Kajet refuses to save new data on the server. Notes already saved stay available, and writing on the device itself keeps working. Space is freed by deleting notes and emptying the bin.</li>
        <li>The User can see how much space is used in the Account settings on the website and in the application.</li>
      </ol>

      <h2 id="par7">§ 7. What the user must do</h2>
      <ol className="legal-items">
        <li>The User uses Kajet lawfully, in line with these terms and with good manners.</li>
        <li>In particular, it is forbidden to:
          <ul>
            <li>attempt to bypass security measures or reach other people's Accounts or data the User has no right to,</li>
            <li>disturb the work of the server or of other Users, including generating automated traffic, mass requests and attempts to overload the service,</li>
            <li>create Accounts automatically, or resell or publicly distribute invite codes,</li>
            <li>give one's own sign-in details to third parties,</li>
            <li>use Kajet as a store for files unrelated to notes.</li>
          </ul>
        </li>
        <li>The User is responsible for the content they put into Kajet and for the consequences of sharing it with others.</li>
      </ol>

      <h2 id="par8">§ 8. Unlawful content is forbidden</h2>
      <ol className="legal-items">
        <li>It is forbidden to place in Kajet, or share through it, <strong>unlawful content</strong>, in particular: content infringing someone's copyright, personal rights or trade secrets; inciting hatred or violence; promoting totalitarian systems; depicting the sexual abuse of minors; serving fraud, phishing or the spread of malicious software; and data obtained through crime.</li>
        <li>On receiving official notice or credible information that stored content is unlawful, the Administrator will promptly disable access to that content, in accordance with Article 14 of the Polish Act on the provision of services by electronic means.</li>
        <li>The Administrator notifies the User by e-mail that access has been disabled, unless such notice would be unlawful. The User may respond to the allegation by writing to the address given in § 1(2); if the allegation proves groundless, access is restored.</li>
        <li>Reports of unlawful content are accepted at <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>. A report should give the link to the content and the reason it is considered unlawful.</li>
      </ol>

      <h2 id="par9">§ 9. Your notes are yours</h2>
      <ol className="legal-items">
        <li><strong>All rights to the content of notes remain with the User.</strong> The Administrator acquires no rights to them — neither economic copyright nor any licence beyond what paragraph 2 describes.</li>
        <li>The Administrator stores and processes notes only as far as is technically necessary to provide the service: saving them on the server, sending them to the User's devices, showing them in a browser, sharing them with people the User chooses, making a backup and deleting them on request.</li>
        <li>Notes are used for no other purpose. In particular they are <strong>not read, analysed, published or used to train artificial intelligence models</strong>. The only exception is KajetAI: a note the User asks about themselves is sent to Google on the terms described in § 11a.</li>
        <li>The content of notes stored on the server <strong>is not encrypted</strong> in a way that would prevent the Administrator from reading it. Kajet does not use end-to-end encryption. A User who wants to be certain that nobody else can read a particular note should keep it on their own device only, without synchronisation.</li>
        <li>The application can export notes to PDF, DOCX and Markdown at any time, and notes on the device sit as ordinary files in a folder the User chose. Nothing is locked inside Kajet.</li>
      </ol>

      <h2 id="par10">§ 10. Sharing notes</h2>
      <ol className="legal-items">
        <li>The User may share a note by creating a link for reading or for writing together. The link can be open to anyone who knows it, or personal — tied to a given e-mail address.</li>
        <li><strong>An open link works for anyone who receives it</strong>, including people without an Account. The User is responsible for who the link is passed to.</li>
        <li>A share can be given an expiry date. Access can be withdrawn at any time by deleting the link.</li>
        <li>For a personal share, a message containing the sharer's login and the note's title is sent to the address given. The User should only enter addresses of people who want such a message.</li>
        <li>When writing together, each side sees the other's changes and the name the other person is writing under.</li>
      </ol>

      <h2 id="par11">§ 11. Running code</h2>
      <ol className="legal-items">
        <li>Code notes can be run on the device (a built-in Python interpreter) or on the server, if the Administrator has enabled that.</li>
        <li>Code run on the server works inside a container cut off from the network, with limited running time, memory and privileges, and has no access to other Users' data.</li>
        <li>It is forbidden to run code meant to bypass those limits, to load the server, to mine cryptocurrency, to attack other systems or to reach other people's data.</li>
        <li>The Administrator may withdraw the right to run code from a single Account, or switch the feature off for everyone, in particular when it burdens the server. The rest of Kajet keeps working. <strong>As of the last update of these terms, running code on the server is switched off</strong> and code runs on the device only.</li>
      </ol>

      <h2 id="par11a">§ 11a. The KajetAI assistant</h2>
      <ol className="legal-items">
        <li>Kajet offers KajetAI — an assistant that, on the User's instruction, changes the content of a text note, a mind map or a code file. KajetAI does not work on handwritten notes.</li>
        <li>The feature is <strong>optional and unavailable by default</strong>. The right to use it is granted to a single Account by the Administrator, who may withdraw it at any time. The rest of Kajet keeps working.</li>
        <li>Using KajetAI means that <strong>the content of the note is sent to Google LLC</strong>, whose language model makes the change. The model is free, so Google may use what is sent to train its models. The details are in section 3.9 of the <a href="/privacy#sek3-9">Privacy Policy</a>.</li>
        <li>Before first use the User confirms consent to sending note content to Google. <strong>Without consent KajetAI does not work.</strong> The consent can be withdrawn at any time in account settings.</li>
        <li><strong>The model's output may be wrong, incomplete or not what was asked for.</strong> It may also change more than was requested. The User is responsible for checking the changes made before treating the note as correct.</li>
        <li>Every change made by KajetAI can be undone with one click, until it is replaced by a further change. The Administrator does not keep the version of the note from before the change beyond the closing of the editor.</li>
        <li>The number of KajetAI calls is limited per day and per hour; the Administrator may set a separate limit for a single Account and may switch the feature off for everyone, in particular where its cost or the load on the server requires it.</li>
        <li>Using KajetAI for unlawful content (§ 8), to circumvent limits, or for automated bulk processing of content, is forbidden.</li>
      </ol>

      <h2 id="par12">§ 12. Blocking an account</h2>
      <ol className="legal-items">
        <li>The Administrator may block an Account if the User grossly or persistently breaches these terms, in particular § 7 and § 8, or if the Account threatens the safety of Kajet or of other Users.</li>
        <li>A blocked Account cannot sign in and does not accept synchronisation. The data stays on the server.</li>
        <li>The Administrator notifies the User by e-mail of the block and its reason. The User may appeal by writing to the address given in § 1(2) and will receive an answer within 14 days.</li>
        <li>If the breach does not stop, or the block proves justified and lasting, the Administrator may delete the Account after first calling on the User to stop the breach and allowing a period of no less than 14 days to download their own data.</li>
        <li>An Account may not be blocked because of the content of notes shared with nobody, except in the cases described in § 8(2).</li>
      </ol>

      <h2 id="par13">§ 13. Leaving and deleting the account</h2>
      <ol className="legal-items">
        <li>The User may give up their Account at any time, without giving a reason and at no cost. The Account is deleted by the User themselves, in the Account settings on the website.</li>
        <li>Deleting the Account requires confirmation with a code sent to the e-mail address tied to the Account. The code is valid for one hour and works once. Once it is entered, the Account is deleted immediately. If the message with the code does not arrive, a deletion request can also be sent to <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a> from the e-mail address tied to the Account.</li>
        <li>Deleting the Account irreversibly erases: every note with its content, every attachment, folders, every shared link and the tokens of signed-in devices. The data cannot be recovered afterwards. <strong>Before deleting the Account, the User should export whatever they want to keep.</strong></li>
        <li>A note thrown into the bin is deleted for good after <strong>30 days</strong>. Until then it can be restored.</li>
        <li><strong>An Account nobody uses is deleted automatically.</strong> After 365 days without signing in, synchronising or saving a note, a warning is sent to the Account's e-mail address. If nothing happens for another 30 days, the Account is deleted with all its data, as described in paragraph 3. Simply signing in during that time keeps the Account — the count then starts again.</li>
        <li>The Administrator may terminate the contract with 30 days' notice, in particular on deciding to shut Kajet down. Notice is sent by e-mail, and the User has until the end of the notice period to download their data.</li>
        <li>A User who is a consumer and concluded the contract at a distance may withdraw from it within <strong>14 days</strong> of creating the Account, without giving a reason. Withdrawal is done by deleting the Account as described in paragraphs 1–3, or by a statement sent to the address given in paragraph 2; the effect is the same one described in paragraph 3. As the service is free of charge, no settlement follows from withdrawal.</li>
      </ol>

      <h2 id="par14">§ 14. Early development and the risk of losing data</h2>

      <div className="legal-note legal-note-warning">
        <p style={{ margin: "0" }}><strong>This is the most important section of these terms. Read it before you trust Kajet with anything you cannot afford to lose.</strong></p>
      </div>

      <ol className="legal-items">
        <li>Kajet is <strong>software at an early stage of development</strong>, written and maintained by one person, on a small scale, for a narrow circle of invited people. It is not a commercial service and has none of the backing that services of this kind run by companies have.</li>
        <li>That means real risks, which the Administrator does not hide: <strong>a server failure, a bug, a mistake during an update or a damaged database may lead to notes being lost — including all of them at once and without warning.</strong></li>
        <li>Backups are made by the hosting provider for the whole server and kept for <strong>3 days</strong>. They are not a service for restoring a single note on request and they are no guarantee that data can be recovered. The Administrator does not undertake to restore lost content.</li>
        <li><strong>The User should keep their own copies of whatever matters to them.</strong> Kajet makes this easy and puts nothing in the way:
          <ul>
            <li>notes in the application sit as ordinary files in a folder the User chose — copying that folder is enough,</li>
            <li>every note can be exported to PDF, DOCX or Markdown,</li>
            <li>synchronised notes exist in two places at once: on the device and on the server.</li>
          </ul>
        </li>
        <li>The Administrator takes care that Kajet works properly and that data is safe, but <strong>does not guarantee uninterrupted service, freedom from errors or the preservation of data</strong>.</li>
        <li>The Administrator gives at least 30 days' notice of any intention to shut Kajet down, so that everyone has time to download their notes.</li>
      </ol>

      <h2 id="par15">§ 15. Liability</h2>
      <ol className="legal-items">
        <li>The Administrator is liable for the proper provision of the service on the terms laid down by law, taking into account that the service is free of charge and that Kajet is at the stage described in § 14.</li>
        <li>The Administrator is not liable for:
          <ul>
            <li>the consequences of giving a false or someone else's e-mail address when creating an Account,</li>
            <li>the consequences of the User giving their password or a note link to third parties,</li>
            <li>the content of the User's notes and the consequences of sharing it,</li>
            <li>the working of the internet, the User's device, operating system and browser,</li>
            <li>breaks caused by failures at the hosting provider, the mail provider or other providers Kajet relies on,</li>
            <li>the effects of force majeure.</li>
          </ul>
        </li>
        <li>The limitations of liability in these terms <strong>neither exclude nor limit</strong> the Administrator's liability for damage caused intentionally, for personal injury, or any liability that cannot be excluded under mandatory provisions of law.</li>
        <li><strong>Towards a User who is a consumer, nothing in these terms limits the rights granted to them by law</strong>, in particular by the Polish Consumer Rights Act and the Civil Code. Where a provision of these terms conflicts with such a rule, the rule applies.</li>
      </ol>

      <h2 id="par16">§ 16. Complaints</h2>
      <ol className="legal-items">
        <li>Complaints about how Kajet works are made by e-mail to <a href="mailto:kontakt@wojtoteka.ovh">kontakt@wojtoteka.ovh</a>.</li>
        <li>A complaint should contain: the login or e-mail address of the Account, a description of what is not working, the date and rough time it happened and — if possible — the name of the device and the version of the application. The more detail, the better the chance of finding the cause quickly.</li>
        <li>The Administrator considers the complaint and answers it <strong>within 14 days</strong> of receiving it, to the e-mail address the complaint was sent from.</li>
        <li>No answer within the period given in paragraph 3 means the complaint is upheld.</li>
      </ol>

      <h2 id="par17">§ 17. Changes to these terms</h2>
      <ol className="legal-items">
        <li>The Administrator may change these terms when the law changes, when the way Kajet works changes, when a feature is added or withdrawn, when security rules change or when the Administrator's details change.</li>
        <li>Users with an Account are notified of a change by e-mail or by a message on the website, at least <strong>14 days in advance</strong>. The new version is published at the same address, with the date of the last update at the top.</li>
        <li>A User who does not agree to a change may delete their Account under § 13 before it takes effect. Using Kajet after the change takes effect means accepting it.</li>
        <li>Changes that do not affect the rights and duties of the User — correcting a typo, clarifying wording, rearranging the document — take effect on publication.</li>
      </ol>

      <h2 id="par18">§ 18. Governing law and disputes</h2>
      <ol className="legal-items">
        <li>Matters not covered by these terms are governed by <strong>Polish law</strong>, in particular the Civil Code, the Act on the provision of services by electronic means, the Consumer Rights Act and data protection law.</li>
        <li>The choice of Polish law does not deprive a User who is a consumer of the protection afforded by mandatory provisions of the law of their country of habitual residence.</li>
        <li>Disputes are settled by the court having jurisdiction under general rules. <strong>No contractual choice of court applies to a consumer</strong> — the court is the one determined by the Polish Code of Civil Procedure.</li>
        <li>A User who is a consumer may use out-of-court means of handling complaints and pursuing claims, in particular the help of a district (municipal) consumer ombudsman, mediation by the provincial inspector of the Trade Inspection and the free consumer helpline of the Office of Competition and Consumer Protection. Details are at <a href="https://uokik.gov.pl">uokik.gov.pl</a>. Using these means is voluntary for both sides.</li>
      </ol>

      <h2 id="par19">§ 19. Final provisions</h2>
      <ol className="legal-items">
        <li>These terms are made available free of charge at <a href="https://kajet.wojtoteka.ovh/terms">kajet.wojtoteka.ovh/terms</a>, in a way that allows them to be downloaded, reproduced and saved at any time.</li>
        <li>If any provision of these terms turns out to be invalid or ineffective, the remaining provisions stay in force.</li>
        <li>These terms apply from <strong>7 August 2026</strong>.</li>
      </ol>

      <p><a className="legal-backlink" href="/privacy">See also: Privacy policy</a></p>

    </>
  );
}
