/** Operational privacy policy. Review provider contracts and adopt retention settings before enabling analytics. */
import { PRIVACY } from './privacy-model.mjs';
const NOTICE = {
  "en": [
    [
      "Who is responsible for your data",
      "{{legalName}}, tax identification number {{taxId}}, with its registered office at {{address}}, is the controller for this website, enquiries and the audience measurement described below. Contact us at {{email}}."
    ],
    [
      "When you contact us",
      "The form sends your name, email address, optional company and service selection, and your message. We use these details to understand and answer your enquiry. Please do not send passwords, payment details or sensitive personal information. Sending a message does not subscribe you to marketing."
    ],
    [
      "Why we use enquiry and security data",
      "For a possible contract with you personally, we rely on pre-contractual steps you request (GDPR Article 6(1)(b)). For professional communications and preventing abuse, we rely on our legitimate interests (Article 6(1)(f)). The acknowledgement beside the form confirms that you have read this notice; it is not consent to analytics or marketing."
    ],
    [
      "Hosting, email and security",
      "Authorised ETAMADE staff receive enquiries through our business email provider. Cloudflare provides hosting, form processing, email transmission and Turnstile verification. Technical security data can include IP address, browser signals, hostname and verification result. The web application does not store an enquiry database, and its contact code does not log message content, tokens or IP addresses. Infrastructure and email providers can retain their own operational records."
    ],
    [
      "Turnstile and abuse prevention",
      "Turnstile loads when you reach or focus the contact form. It checks browser and connection signals to distinguish people from bots; our server verifies the result. Rate limits use cryptographically derived IP and email keys in 60-second windows. These security features do not depend on analytics consent. If a security check prevents submission, email us instead. This site does not enable Turnstile pre-clearance."
    ],
    [
      "Optional Google Analytics",
      "Only if you accept analytics, we use Google Analytics 4, provided by Google Ireland Limited, to understand which pages and services are useful and improve the website. The legal basis is your consent (GDPR Article 6(1)(a)), together with the applicable consent rules for non-essential cookies. We do not load the Google tag, contact its analytics servers or send cookieless analytics pings before consent or after rejection. No analytics is collected from earlier interactions when you later accept."
    ],
    [
      "What analytics measures",
      "After consent, analytics can measure page views, visible sections, scrolling, service details, FAQ openings, navigation and external-link categories, language switching, active time and contact-form start/submission/outcome events. Google also processes technical request data, such as IP address and browser/device information, and uses pseudonymous cookie identifiers. This is not a claim of anonymous processing. We do not send names, email addresses, company names, message contents, form error text, full referrers, URL query strings or fragments. Unknown paths are reported as a generic 404 page."
    ],
    [
      "No advertising or cross-domain visitor matching",
      "Google advertising consent remains denied. Google signals and advertising-personalisation signals are disabled in the tag. We do not send User-ID or user-provided data and do not enable remarketing. The two domains can appear in the same analytics property, but each domain has its own consent choice and cookies. No analytics identifier or consent decision is passed through the language-switch link."
    ],
    [
      "Making and changing your choice",
      "Accept analytics and Reject analytics are available with equal prominence. Optional analytics is off by default. Closing preferences or continuing to browse does not mean agreement. Privacy settings is always available in the footer and through the floating control. Rejection or withdrawal stops new analytics, destroys the tag runtime and removes its readable first-party cookies on this domain. It cannot recall a request already sent or automatically delete previously collected data. Contact us to discuss a data-rights request. The contact form remains available regardless of this choice."
    ],
    [
      "How your choice is remembered",
      "We store your choice, notice version, decision time and expiry in local storage under {{consentKey}}, separately on each domain. It is valid for {{days}} days and is not extended merely by revisiting. An expired record is removed on a later visit; browser storage can otherwise remain until you clear it. A material consent-policy version change requires a new choice. There is no central consent database or consent-tracking identifier. If storage is blocked, the choice lasts only for the current page."
    ],
    [
      "Language and appearance preferences",
      "We read only your browser’s first preferred language to offer the other language version. We do not use location detection, fingerprinting or a third-party language service. Dismissing the suggestion or explicitly choosing a language is remembered in session storage under {{languageKey}}, for the browser-tab session. A temporary lang-choice parameter confirms an explicit cross-domain choice and is removed on arrival; it carries no analytics identifier. A manually selected light/dark appearance is stored under etamade-appearance until you choose Auto or clear it. These preferences are not used for audience measurement."
    ],
    [
      "International processing",
      "Google, Cloudflare and our email provider may process data outside the European Economic Area, including in the United States. Appropriate transfer safeguards under GDPR Chapter V are required, such as an applicable adequacy decision or standard contractual clauses, as relevant to each provider and transfer. Analytics consent is not itself the transfer safeguard. Ask us for current provider and safeguard details at {{email}}. Google explains its processing in the linked privacy information."
    ],
    [
      "Retention",
      "Enquiries that do not lead to an engagement are retained for up to {{enquiryMonths}} months after the last discussion, unless needed for a legal obligation or dispute. Contract-related correspondence follows contractual and legal retention requirements. Analytics cookies are configured for at most {{days}} days without extending their expiry on each visit. Our policy for GA4 user-level and event-level data is {{analyticsMonths}} months, separately configured in the property; standard aggregated reports can remain longer. Deleting mailbox messages and implementing provider retention settings are operational responsibilities, not automatic website features."
    ],
    [
      "Your rights",
      "Subject to the applicable conditions, you may request access, correction, deletion, restriction or portability, and object to processing based on legitimate interests. You can withdraw analytics consent at any time without affecting the lawfulness of earlier processing. Contact {{email}}. You may complain to the Romanian supervisory authority, ANSPDCP, or another competent supervisory authority."
    ],
    [
      "Your choice to contact us",
      "Contacting us is voluntary. Name, email, message, acknowledgement and a valid security check are needed to use the form; company and service selection are optional. Automated anti-abuse checks may block a submission, but they do not make decisions with legal or similarly significant effects about you. You can contact us by email instead."
    ]
  ],
  "ro": [
    [
      "Cine răspunde de datele tale",
      "{{legalName}}, CUI {{taxId}}, cu sediul la {{address}}, este operatorul datelor prelucrate prin acest site, prin formularul de contact și prin analiza vizitelor descrisă mai jos. Ne poți scrie la {{email}}."
    ],
    [
      "Când ne trimiți un mesaj",
      "Formularul ne transmite numele, adresa de e-mail, compania și serviciul ales (dacă le completezi), precum și mesajul tău. Le folosim pentru a înțelege solicitarea și a-ți răspunde. Nu trimite parole, date de plată sau date personale sensibile. Mesajul nu te abonează la comunicări de marketing."
    ],
    [
      "Pe ce ne bazăm când folosim datele",
      "Dacă ne contactezi în nume propriu pentru un posibil contract, temeiul este efectuarea demersurilor cerute de tine înainte de încheierea contractului (art. 6 alin. (1) lit. b) din RGPD). Pentru comunicarea profesională și prevenirea abuzurilor, ne bazăm pe interesul legitim (lit. f)). Bifa de lângă formular confirmă că ai citit această politică; nu înseamnă acord pentru analiză sau marketing."
    ],
    [
      "Găzduire, e-mail și securitate",
      "Mesajele ajung la persoanele autorizate din ETAMADE, prin furnizorul nostru de e-mail. Cloudflare asigură găzduirea, procesarea formularului, trimiterea mesajelor și verificarea Turnstile. Pentru securitate pot fi prelucrate adresa IP, semnale ale browserului, domeniul accesat și rezultatul verificării. Site-ul nu păstrează o bază de date cu mesaje, iar codul formularului nu scrie conținutul lor, tokenuri sau adrese IP în jurnalele aplicației. Furnizorii pot păstra separat propriile jurnale tehnice."
    ],
    [
      "Turnstile și prevenirea abuzurilor",
      "Turnstile se încarcă atunci când ajungi la formular sau începi să-l folosești. Analizează semnale ale browserului și conexiunii pentru a deosebi oamenii de boți, iar serverul nostru verifică rezultatul. Limitarea încercărilor folosește chei derivate criptografic din IP și e-mail, în intervale de 60 de secunde. Aceste măsuri nu depind de acordul pentru analiză. Dacă nu poți trimite formularul, scrie-ne direct prin e-mail. Codul site-ului nu activează funcția Turnstile pre-clearance."
    ],
    [
      "Google Analytics, doar cu acordul tău",
      "Doar dacă accepți analiza, folosim Google Analytics 4, furnizat de Google Ireland Limited, pentru a vedea ce pagini și servicii sunt utile și pentru a îmbunătăți site-ul. Temeiul este consimțământul tău (art. 6 alin. (1) lit. a) din RGPD), împreună cu regulile aplicabile cookie-urilor care nu sunt necesare. Înainte de acord sau după refuz nu încărcăm scriptul Google, nu contactăm serverele sale de analiză și nu trimitem nici măsurători fără cookie-uri. Dacă accepți mai târziu, nu trimitem retroactiv ce ai făcut înainte."
    ],
    [
      "Ce măsurăm",
      "După acord, putem măsura paginile și secțiunile vizitate, derularea paginii, deschiderea detaliilor despre servicii și a întrebărilor frecvente, navigarea, categoriile de linkuri accesate, schimbarea limbii, timpul activ și începerea, trimiterea sau rezultatul unei solicitări prin formular. Google prelucrează și date tehnice ale cererii, precum IP-ul și informații despre browser sau dispozitiv, și folosește identificatori pseudonimi în cookie-uri. Asta nu înseamnă că prelucrarea este anonimă. Nu trimitem nume, adrese de e-mail, nume de companii, conținutul mesajelor, texte ale erorilor din formular, adresa completă a paginii de proveniență ori parametri și fragmente din URL. Adresele necunoscute sunt raportate ca o pagină 404 generică."
    ],
    [
      "Fără publicitate și fără urmărire între domenii",
      "Consimțământul pentru publicitate rămâne refuzat. Google signals și semnalele pentru personalizarea reclamelor sunt dezactivate în script. Nu trimitem User-ID sau date furnizate de utilizator pentru publicitate și nu activăm remarketingul. Cele două domenii pot apărea în aceeași proprietate de analiză, dar au alegeri și cookie-uri separate. Linkul pentru schimbarea limbii nu transmite nici identificatori de analiză, nici acordul tău."
    ],
    [
      "Cum alegi și cum îți retragi acordul",
      "Butoanele Accept analiza și Refuz analiza sunt la fel de vizibile. Analiza este oprită inițial. Închiderea setărilor sau simpla navigare nu înseamnă acord. Poți reveni oricând la Setări de confidențialitate, din subsol sau de la butonul flotant. Refuzul ori retragerea acordului oprește măsurătorile noi, închide mediul în care rulează scriptul și șterge cookie-urile sale accesibile de pe acest domeniu. Nu poate anula o cerere deja trimisă și nu șterge automat datele colectate anterior. Pentru o cerere privind datele tale, contactează-ne. Formularul rămâne disponibil indiferent ce alegi."
    ],
    [
      "Cum reținem alegerea",
      "Salvăm local, sub cheia {{consentKey}}, alegerea, versiunea informării, momentul deciziei și data expirării, separat pe fiecare domeniu. Alegerea este valabilă {{days}} de zile, fără prelungire la fiecare vizită. Înregistrarea expirată este ștearsă la o vizită ulterioară; altfel, datele locale pot rămâne până când le ștergi din browser. O schimbare importantă a versiunii politicii cere o alegere nouă. Nu avem o bază de date centrală cu acorduri și nu atribuim un identificator pentru memorarea lor. Dacă browserul blochează salvarea, alegerea este valabilă doar pe pagina curentă."
    ],
    [
      "Preferințe de limbă și aspect",
      "Citim doar prima limbă preferată a browserului, ca să îți putem sugera cealaltă versiune a site-ului. Nu folosim localizarea, amprenta digitală a dispozitivului sau un serviciu extern. Dacă închizi sugestia ori alegi explicit o limbă, reținem acest lucru în sessionStorage, sub cheia {{languageKey}}, pentru sesiunea filei din browser. Parametrul temporar lang-choice confirmă alegerea făcută între domenii și este eliminat la sosire; nu conține un identificator de analiză. Aspectul deschis sau închis ales manual este salvat sub etamade-appearance, până când alegi Automat sau ștergi datele. Nu folosim aceste preferințe pentru analiza vizitelor."
    ],
    [
      "Prelucrarea datelor în afara SEE",
      "Google, Cloudflare și furnizorul de e-mail pot prelucra date și în afara Spațiului Economic European, inclusiv în Statele Unite. Transferurile necesită garanțiile aplicabile potrivit capitolului V din RGPD, de exemplu o decizie de adecvare aplicabilă sau clauze contractuale standard, în funcție de furnizor și transfer. Acordul pentru analiză nu înlocuiește aceste garanții. Ne poți cere informații actuale despre furnizori și garanții la {{email}}. Detaliile despre prelucrarea Google sunt disponibile în politica indicată mai jos."
    ],
    [
      "Cât timp păstrăm datele",
      "Păstrăm solicitările care nu duc la o colaborare cel mult {{enquiryMonths}} luni de la ultima discuție, cu excepția situațiilor în care sunt necesare pentru o obligație legală sau un litigiu. Corespondența privind un contract se păstrează potrivit obligațiilor contractuale și legale. Cookie-urile de analiză sunt configurate pentru cel mult {{days}} de zile, fără prelungirea expirării la fiecare vizită. Politica noastră pentru datele GA4 la nivel de utilizator și eveniment este de {{analyticsMonths}} luni, configurată separat în proprietate; rapoartele agregate standard pot fi păstrate mai mult. Ștergerea mesajelor din e-mail și aplicarea setărilor furnizorilor sunt operațiuni interne, nu funcții automate ale site-ului."
    ],
    [
      "Drepturile tale",
      "În condițiile prevăzute de lege, poți cere accesul la date, rectificarea, ștergerea, restricționarea sau portabilitatea lor și te poți opune prelucrării bazate pe interes legitim. Îți poți retrage oricând acordul pentru analiză, fără a afecta legalitatea prelucrării anterioare. Scrie-ne la {{email}}. Poți depune o plângere la ANSPDCP sau la o altă autoritate de supraveghere competentă."
    ],
    [
      "Alegerea de a ne contacta",
      "Ne contactezi doar dacă dorești. Numele, e-mailul, mesajul, confirmarea citirii politicii și verificarea de securitate sunt necesare pentru formular; compania și serviciul sunt opționale. Verificările automate anti-abuz pot bloca trimiterea, dar nu iau decizii despre tine cu efecte juridice sau efecte semnificative similare. Ne poți scrie alternativ prin e-mail."
    ]
  ]
};
const STORAGE = {
  "en": [
    [
      "etamade-consent-v1",
      "Essential local storage: your choice, version and timestamps. No visitor identifier.",
      "180-day validity; expiry checked on later visits."
    ],
    [
      "etamade-appearance",
      "Requested light/dark appearance; local storage.",
      "Until Auto is selected or browser data is cleared."
    ],
    [
      "etamade-language-v1",
      "Requested language / dismissed suggestion; session storage.",
      "Browser-tab session."
    ],
    [
      "_ga",
      "Optional first-party Google Analytics browser identifier. Consent required.",
      "Up to 180 days, no rolling extension."
    ],
    [
      "_ga_<stream>",
      "Optional Google Analytics session state. Consent required.",
      "Up to 180 days, no rolling extension."
    ],
    [
      "Cloudflare security",
      "Strictly necessary security signals/storage depend on your connection and the configured security services. No analytics purpose.",
      "Provider/service-dependent; anti-abuse counters use 60-second windows."
    ]
  ],
  "ro": [
    [
      "etamade-consent-v1",
      "Stocare locală necesară: alegerea, versiunea și momentele deciziei/expirării. Fără identificator de vizitator.",
      "Valabilă 180 de zile; expirarea este verificată la vizitele ulterioare."
    ],
    [
      "etamade-appearance",
      "Aspectul deschis sau închis ales de tine; stocare locală.",
      "Până alegi Automat sau ștergi datele browserului."
    ],
    [
      "etamade-language-v1",
      "Limba aleasă sau sugestia închisă; stocare de sesiune.",
      "Sesiunea filei din browser."
    ],
    [
      "_ga",
      "Identificator opțional Google Analytics, pe acest domeniu. Necesită acord.",
      "Cel mult 180 de zile, fără prelungire automată."
    ],
    [
      "_ga_<stream>",
      "Starea sesiunii Google Analytics. Opțională, numai cu acord.",
      "Cel mult 180 de zile, fără prelungire automată."
    ],
    [
      "Cloudflare security",
      "Semnale și stocare strict necesare securității, în funcție de conexiune și serviciile configurate. Fără scop de analiză.",
      "Depinde de serviciu; contoarele anti-abuz folosesc intervale de 60 de secunde."
    ]
  ]
};
export function privacySections(lang, site) {
 const language = lang === 'ro' ? 'ro' : 'en';
 const vars = {legalName:site.legalName,taxId:site.taxId,email:site.email,
   address:`${site.streetAddress}, ${site.city}, ${site.region}, ${site.postalCode}, ${language==='ro'?'Rom\u00e2nia':'Romania'}`,
   consentKey:PRIVACY.storageKey,languageKey:PRIVACY.languageKey,days:PRIVACY.lifetimeDays,
   enquiryMonths:site.enquiryRetentionMonths,analyticsMonths:PRIVACY.retentionMonths};
 return NOTICE[language].map(section => section.map(value => value.replace(/\{\{(\w+)\}\}/g,(_,key)=>String(vars[key] ?? ''))));
}
export function storageRows(lang) { return STORAGE[lang === 'ro' ? 'ro' : 'en']; }
