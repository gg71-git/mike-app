<?php
return [

  // ≡ƒô⌐ Einladung (ohne Code) ΓÇô z.ΓÇ¤B. nach Benutzeranlage
  'einladung_betreff' => '≡ƒô▒ Deine Einladung zur Mike!-App',
  'einladung_body' => function ($vorname) {
    return <<<TEXT
Hallo {$vorname},

du wurdest eingeladen, die Mike!-App zu nutzen.

Damit kannst du auf einfachste Weise Fehler an den Helpdesk melden ΓÇô direkt vom Smartphone aus.

Bitte installiere die App und fordere darüber deinen persönlichen Zugangscode an.

Beste Grüße  
Dein Mike!-Team
TEXT;
  },

  // ≡ƒöÉ Codeversand (App-Button l├╢st aus)
  'code_betreff' => 'Dein pers├╢nlicher Mike!-Zugangscode',
  'code_body' => function ($vorname, $code) {
    return <<<TEXT
Hallo {$vorname},

hier dein persönlicher Zugangscode zur Mike!-App:

    {$code}

Bitte gib diesen Code innerhalb von 10 Minuten direkt in der App ein.

Beste Grüße  
Dein Mike!-Team
TEXT;
  }

];

