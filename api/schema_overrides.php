<?php
return [

    // -------------------------
    // Tabelle CUSTOMERS
    // -------------------------
    'customers' => [
        'Kontakt_technisch' => [
            'type'   => 'int',
            'label'  => 'Kontakt (technisch)',
            'lookup' => 'users'   // Marker: Optionen aus users holen
        ],
        'Kontakt_kaufm' => [
            'type'   => 'int',
            'label'  => 'Kontakt (kaufm)',
            'lookup' => 'users'   // Marker: Optionen aus users holen
        ]
    ],

    // -------------------------
    // Tabelle HELPdesks
    // -------------------------
    'helpdesks' => [
        'helpdesk_ansprechpartner_id' => [
            'type'   => 'int',
            'label'  => 'Helpdesk-Ansprechpartner',
            'lookup' => 'users'
        ],
        'customer_ID' => [
            'type'   => 'int',
            'label'  => 'Kunde',
            'lookup' => 'customers'
        ]
    ],

    // -------------------------
    // Tabelle USERS
    // -------------------------
    'users' => [
        'customer_ID' => [
            'type'   => 'int',
            'label'  => 'Kunde',
            'lookup' => 'customers'
        ],
        'helpdesk_ID' => [
            'type'   => 'int',
            'label'  => 'Helpdesk',
            'lookup' => 'helpdesks'
        ]
    ],

    // -------------------------
    // Tabelle TMP_IMPORT
    // -------------------------
    'tmp_import' => [
        'customer_ID' => [
            'type'   => 'varchar',
            'label'  => 'Kunde',
            'lookup' => 'customers'
        ],
        'helpdesk_ID' => [
            'type'   => 'varchar',
            'label'  => 'Helpdesk',
            'lookup' => 'helpdesks'
        ]
    ]

];



