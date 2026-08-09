import { describe, expect, it } from "vitest";
import { htmlToMarkdown, markdownToHtml, parseInline, inlineToMarkdown } from "./rich-text";

/** Droga tam i z powrotem: tak wygląda otwarcie notatki i zapisanie jej. */
function round(markdown: string): string {
  return htmlToMarkdown(markdownToHtml(markdown));
}

describe("znaczniki w wierszu", () => {
  it("czyta pogrubienie, kursywę, przekreślenie i podświetlenie", () => {
    expect(markdownToHtml("**gruby** *pochyły* ~~skreślony~~ ==żółty==")).toBe(
      "<p><strong>gruby</strong> <em>pochyły</em> <s>skreślony</s> <mark>żółty</mark></p>",
    );
  });

  it("podkreślenie zapisuje się znacznikiem, bo markdown go nie ma", () => {
    expect(markdownToHtml("<u>tekst</u>")).toBe("<p><u>tekst</u></p>");
    expect(htmlToMarkdown("<p><u>tekst</u></p>")).toBe("<u>tekst</u>");
  });

  it("kod w tekście nie czyta znaczników w środku", () => {
    expect(markdownToHtml("zobacz `**to**`")).toBe(
      "<p>zobacz <code>**to**</code></p>",
    );
  });

  it("znaczniki wchodzą jedne w drugie", () => {
    expect(markdownToHtml("**gruby i *pochyły***")).toBe(
      "<p><strong>gruby i <em>pochyły</em></strong></p>",
    );
  });

  it("odnośnik i zdjęcie", () => {
    expect(markdownToHtml("[opis](https://kajet.pl)")).toBe(
      '<p><a href="https://kajet.pl">opis</a></p>',
    );
    // Szerokość z opisu zdjęcia rysuje się od razu, ale w opisie zostaje -
    // dzięki temu wraca do notatki tak, jak w niej stała.
    expect(markdownToHtml("![zdjęcie|60%](assets/kot.png)")).toBe(
      '<p><img src="assets/kot.png" alt="zdjęcie|60%" style="width:60%"></p>',
    );
  });

  it("odnośnik javascript: nie ma prawa nigdzie zaprowadzić", () => {
    // Notatkę można udostępnić obcej osobie - podgląd rysuje ten sam HTML.
    expect(markdownToHtml("[klik](javascript:alert(1))")).toContain('href="#"');
    expect(markdownToHtml("[klik](https://kajet.pl)")).toContain('href="https://kajet.pl"');
    expect(markdownToHtml("![x](assets/kot.png)")).toContain('src="assets/kot.png"');
  });

  it("zdjęcie pokazane spod innego adresu wraca do notatki tak, jak w niej stało", () => {
    const html = markdownToHtml("![kot](assets/kot.png)", {
      imageUrl: (target) => `/note/1/attachment?name=${target.slice(7)}`,
    });
    expect(html).toContain('src="/note/1/attachment?name=kot.png"');
    expect(htmlToMarkdown(html)).toBe("![kot](assets/kot.png)");
  });

  it("podkreślnik w środku słowa zostaje podkreślnikiem", () => {
    expect(round("plik nazwa_pliku_1.txt")).toBe("plik nazwa_pliku_1.txt");
    expect(markdownToHtml("_kursywa_")).toBe("<p><em>kursywa</em></p>");
  });

  it("samotna gwiazdka nie robi kursywy", () => {
    expect(markdownToHtml("2 * 3 = 6")).toBe("<p>2 * 3 = 6</p>");
  });

  it("znaki HTML w treści nie stają się znacznikami", () => {
    expect(markdownToHtml("a < b & c")).toBe("<p>a &lt; b &amp; c</p>");
    expect(htmlToMarkdown("<p>a &lt; b &amp; c</p>")).toBe("a < b & c");
  });

  it("drzewko wraca na ten sam markdown", () => {
    const text = "**gruby** i `kod` i [link](https://a.pl)";
    expect(inlineToMarkdown(parseInline(text))).toBe(text);
  });
});

describe("bloki", () => {
  it("nagłówki, cytat i linia", () => {
    expect(markdownToHtml("# Tytuł")).toBe("<h1>Tytuł</h1>");
    expect(markdownToHtml("### Trzeci")).toBe("<h3>Trzeci</h3>");
    expect(markdownToHtml("> cytat")).toBe("<blockquote>cytat</blockquote>");
    expect(markdownToHtml("---")).toBe("<hr>");
  });

  it("lista zwykła, numerowana i zadania", () => {
    expect(markdownToHtml("- mleko\n- chleb")).toBe("<ul><li>mleko</li><li>chleb</li></ul>");
    expect(markdownToHtml("1. raz\n2. dwa")).toBe("<ol><li>raz</li><li>dwa</li></ol>");
    expect(markdownToHtml("- [ ] zrobić\n- [x] zrobione")).toBe(
      '<ul data-kind="task"><li data-done="false">zrobić</li><li data-done="true">zrobione</li></ul>',
    );
  });

  it("podlista zostaje podlistą", () => {
    expect(round("- mleko\n  - tłuste\n- chleb")).toBe("- mleko\n  - tłuste\n- chleb");
  });

  it("blok kodu i wzór", () => {
    expect(markdownToHtml("```\nprint(1)\n```")).toBe(
      '<pre data-kind="code">print(1)</pre>',
    );
    expect(markdownToHtml("$$\nE=mc^2\n$$")).toBe('<pre data-kind="math">E=mc^2</pre>');
  });

  /*
    Pole do pisania dokłada pusty akapit pod blokiem kodu i pod cytatem, żeby
    dało się pisać niżej. Ten akapit NIE MOŻE dokładać niczego do treści -
    inaczej notatka rosłaby o pustą linię po każdym otwarciu.
  */
  it("pusty akapit pod blokiem kodu nie zostawia śladu w notatce", () => {
    expect(htmlToMarkdown('<pre data-kind="code">print(1)</pre><p><br></p>')).toBe(
      "```\nprint(1)\n```",
    );
    expect(htmlToMarkdown("<blockquote>cytat</blockquote><p><br></p>")).toBe("> cytat");
  });

  it("notatka z blokiem kodu na końcu wraca bez zmian mimo domknięcia akapitem", () => {
    const markdown = "opis\n\n```\nprint(1)\n```";
    const html = `${markdownToHtml(markdown)}<p><br></p>`;
    expect(htmlToMarkdown(html)).toBe(markdown);
  });

  it("tabela ma nagłówek i wiersze", () => {
    const table = "| Imię | Wiek |\n| --- | --- |\n| Ala | 7 |";
    expect(markdownToHtml(table)).toBe(
      "<table><tr><th>Imię</th><th>Wiek</th></tr><tr><td>Ala</td><td>7</td></tr></table>",
    );
    expect(round(table)).toBe(table);
  });

  it("puste pole ma gdzie postawić kursor", () => {
    expect(markdownToHtml("")).toBe("<p><br></p>");
    expect(htmlToMarkdown("<p><br></p>")).toBe("");
  });
});

describe("droga tam i z powrotem", () => {
  const cases: [string, string][] = [
    ["zwykły akapit", "zwykły akapit"],
    ["dwa\nwiersze jednego akapitu", "dwa\nwiersze jednego akapitu"],
    ["akapit\n\ndrugi akapit", "akapit\n\ndrugi akapit"],
    ["# Tytuł\n\ntreść", "# Tytuł\n\ntreść"],
    ["**gruby** i *pochyły*", "**gruby** i *pochyły*"],
    ["~~skreślony~~ i ==żółty==", "~~skreślony~~ i ==żółty=="],
    ["<u>podkreślony</u>", "<u>podkreślony</u>"],
    ["`kod w tekście`", "`kod w tekście`"],
    ["```\nkod\nw dwóch wierszach\n```", "```\nkod\nw dwóch wierszach\n```"],
    ["$$\na+b\n$$", "$$\na+b\n$$"],
    ["> cytat\n> dalej", "> cytat\n> dalej"],
    ["- raz\n- dwa", "- raz\n- dwa"],
    ["1. raz\n2. dwa", "1. raz\n2. dwa"],
    ["- [ ] zrobić\n- [x] zrobione", "- [ ] zrobić\n- [x] zrobione"],
    ["[opis](https://kajet.pl)", "[opis](https://kajet.pl)"],
    ["![zdjęcie](assets/kot.png)", "![zdjęcie](assets/kot.png)"],
    ["---", "---"],
    // Ujednolicenia: markdown ma po kilka zapisów tej samej rzeczy.
    ["_pochyły_", "*pochyły*"],
    ["__gruby__", "**gruby**"],
    ["* pozycja", "- pozycja"],
    ["1) raz", "1. raz"],
    ["#### czwarty poziom", "#### czwarty poziom"],
  ];

  for (const [from, to] of cases) {
    it(`zachowuje: ${from.replace(/\n/g, "\\n").slice(0, 40)}`, () => {
      expect(round(from)).toBe(to);
    });
  }

  it("znaczniki zbite w kupę nie rozsypują notatki", () => {
    // Zapis z pogranicza: same znaczniki, jeden przy drugim. Nie musi wyjść
    // znak w znak to samo, ale po pierwszym przejściu ma się już nie ruszać -
    // inaczej notatka zmieniałaby się przy każdym otwarciu.
    const messy = "*ttt**tekst*fff*ffff***~~tekst~~**<u>tekst</u>";
    const once = round(messy);
    expect(round(once)).toBe(once);
    expect(once).toContain("tekst");
  });

  it("cała notatka przechodzi bez zmiany", () => {
    const note = [
      "# Zakupy na sobotę",
      "",
      "Trzeba wziąć **dużą** torbę, bo *wszystko* się nie zmieści.",
      "",
      "- [ ] mleko",
      "- [x] chleb",
      "",
      "> Sklep zamykają o 14.",
      "",
      "| Rzecz | Ile |",
      "| --- | --- |",
      "| mleko | 2 |",
      "",
      "```",
      "kod = 1",
      "```",
    ].join("\n");
    expect(round(note)).toBe(note);
    // Drugie przejście też niczego nie rusza - inaczej notatka „pełzałaby"
    // z każdym otwarciem.
    expect(round(round(note))).toBe(note);
  });
});

describe("HTML z przeglądarki", () => {
  it("czyta pogrubienie zapisane stylem", () => {
    expect(htmlToMarkdown('<p><span style="font-weight: bold">gruby</span></p>')).toBe(
      "**gruby**",
    );
    expect(htmlToMarkdown('<p><span style="font-style: italic">pochyły</span></p>')).toBe(
      "*pochyły*",
    );
  });

  it("czyta znaczniki, których sam nie wypisuje", () => {
    expect(htmlToMarkdown("<p><b>a</b><i>b</i><strike>c</strike><del>d</del></p>")).toBe(
      "**a***b*~~c~~~~d~~",
    );
  });

  it("twarda spacja wraca zwykłą", () => {
    expect(htmlToMarkdown("<p>dwa&nbsp;słowa</p>")).toBe("dwa słowa");
  });

  it("div zamiast akapitu też jest akapitem", () => {
    expect(htmlToMarkdown("<div>raz</div><div>dwa</div>")).toBe("raz\n\ndwa");
  });

  it("złamanie wiersza zostaje w akapicie", () => {
    expect(htmlToMarkdown("<p>raz<br>dwa</p>")).toBe("raz\ndwa");
  });

  it("pusty akapit nie dokłada się do treści", () => {
    expect(htmlToMarkdown("<p>raz</p><p><br></p><p>dwa</p>")).toBe("raz\n\ndwa");
  });

  it("nie wywraca się na niedomkniętym znaczniku", () => {
    expect(htmlToMarkdown("<p><strong>gruby</p>")).toBe("**gruby**");
  });
});

describe("kolor pisma", () => {
  it("czyta barwny kawałek na HTML i z powrotem", () => {
    const markdown = 'zwykły <span style="color:#b0322a">czerwony</span> dalej';
    expect(markdownToHtml(markdown)).toBe(
      '<p>zwykły <span style="color:#b0322a">czerwony</span> dalej</p>',
    );
    expect(round(markdown)).toBe(markdown);
  });

  it("koloruje jedno słowo, a nie całą kartkę", () => {
    const markdown = 'raz <span style="color:#1b4f8c">dwa</span> trzy';
    expect(round(markdown)).toBe(markdown);
  });

  it("barwa i pogrubienie stoją jedno w drugim", () => {
    const markdown = '**<span style="color:#1f6b3a">gruby zielony</span>**';
    expect(markdownToHtml(markdown)).toBe(
      '<p><strong><span style="color:#1f6b3a">gruby zielony</span></strong></p>',
    );
    expect(round(markdown)).toBe(markdown);
  });

  it("barwa z przeglądarki w zapisie rgb wraca po kratce", () => {
    expect(htmlToMarkdown('<p><span style="color: rgb(136, 112, 55)">tekst</span></p>')).toBe(
      '<span style="color:#887037">tekst</span>',
    );
  });

  it("skrócony zapis barwy rozwija się do sześciu znaków", () => {
    expect(htmlToMarkdown('<p><span style="color:#ABC">tekst</span></p>')).toBe(
      '<span style="color:#aabbcc">tekst</span>',
    );
  });

  it("znacznik font od przeglądarki nie przynosi barwy, ale treść zostaje", () => {
    expect(htmlToMarkdown('<p><font color="#ff0000">tekst</font></p>')).toBe("tekst");
  });

  it("tło to dalej podświetlenie, nie barwa pisma", () => {
    expect(htmlToMarkdown('<p><span style="background-color:#ff0">tekst</span></p>')).toBe(
      "==tekst==",
    );
  });

  it("nieznany zapis barwy odpada, treść zostaje", () => {
    expect(htmlToMarkdown('<p><span style="color:papuga">tekst</span></p>')).toBe("tekst");
  });

  it("barwa bez treści znika", () => {
    expect(inlineToMarkdown(parseInline('<span style="color:#123456"></span>'))).toBe("");
  });
});

describe("rozmiar pisma kawałka tekstu", () => {
  it("czyta przeskalowany kawałek na HTML i z powrotem", () => {
    const markdown = 'zwykły <span style="font-size:21px">duży</span> dalej';
    expect(markdownToHtml(markdown)).toBe(
      '<p>zwykły <span style="font-size:21px">duży</span> dalej</p>',
    );
    expect(round(markdown)).toBe(markdown);
  });

  it("autozapis ze strony nie gubi rozmiaru", () => {
    // Tak wygląda pole do pisania tuż po otwarciu notatki: HTML z naszego
    // markdownToHtml wraca przez htmlToMarkdown bez żadnej zmiany.
    expect(htmlToMarkdown('<p><span style="font-size:21px">duży</span></p>')).toBe(
      '<span style="font-size:21px">duży</span>',
    );
  });

  it("rozmiar ze spacją i średnikiem w stylu też się czyta", () => {
    expect(htmlToMarkdown('<p><span style="font-size: 21px;">duży</span></p>')).toBe(
      '<span style="font-size:21px">duży</span>',
    );
  });

  it("rozmiar i barwa w jednym stylu rozchodzą się na dwa znaczniki", () => {
    expect(
      htmlToMarkdown('<p><span style="font-size:21px; color:#b0322a">tekst</span></p>'),
    ).toBe('<span style="font-size:21px"><span style="color:#b0322a">tekst</span></span>');
  });

  it("oba porządki zagnieżdżenia wracają w jednym: rozmiar na zewnątrz", () => {
    const canonical = '<span style="font-size:21px"><span style="color:#665222">x</span></span>';
    const swapped = '<span style="color:#665222"><span style="font-size:21px">x</span></span>';
    expect(round(canonical)).toBe(canonical);
    expect(round(swapped)).toBe(canonical);
  });

  it("zepsute zagnieżdżenie kolor w kolorze nie zostawia gołych znaczników", () => {
    const broken = '<span style="color:#111111"><span style="color:#665222">x</span></span>';
    const html = markdownToHtml(broken);
    expect(html).not.toContain("&lt;span");
    expect(htmlToMarkdown(html)).not.toContain("&lt;");
  });

  it("niedomknięty span zostaje zwykłym tekstem, jak dotąd", () => {
    const markdown = 'tekst <span style="color:#665222">bez domknięcia';
    expect(markdownToHtml(markdown)).toBe(
      "<p>tekst &lt;span style=&quot;color:#665222&quot;&gt;bez domknięcia</p>",
    );
  });

  it("rozmiar bez treści znika", () => {
    expect(inlineToMarkdown(parseInline('<span style="font-size:21px"></span>'))).toBe("");
  });
});
