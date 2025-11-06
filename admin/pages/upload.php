<?php
session_start();

$page     = $_GET['page'] ?? "users";   // Zieltabelle (generisch)
$pagename = ucfirst($page);

require '../../db_connect.php';
$db = $pdo;

// Logging → nur Console (gesammelt)
$consoleLogs = [];
function myLog($msg) {
    global $consoleLogs;
    $time = date("Y-m-d H:i:s");
    $consoleLogs[] = "[$time] $msg";
}

// Meldung aus Session
$message = $_SESSION['import_message'] ?? "";
unset($_SESSION['import_message']);

// CSV-Verarbeitung
if (
  $_SERVER["REQUEST_METHOD"] === "POST" &&
  isset($_FILES['csvfile']) &&
  is_uploaded_file($_FILES['csvfile']['tmp_name']) &&
  $_FILES['csvfile']['error'] === UPLOAD_ERR_OK
) {
    $tmpName = $_FILES['csvfile']['tmp_name'];

    if (($handle = fopen($tmpName, "r")) !== false) {
        $firstLine = fgets($handle);
        $delimiter = (substr_count($firstLine, ";") > substr_count($firstLine, ",")) ? ";" : ",";
        rewind($handle);

        $headersRaw = fgetcsv($handle, 0, $delimiter, '"');
        if (!$headersRaw || count($headersRaw) < 2) {
            $_SESSION['import_message'] = "❌ Kopfzeile ungültig oder zu wenige Spalten.";
            header("Location: " . $_SERVER['PHP_SELF'] . "?page={$page}");
            exit;
        }

        $headers = array_map('trim', $headersRaw);

        // -------------------------------
        // tmp_import anhand CSV-Header bauen (zuerst nur TEXT)
        // -------------------------------
        $pdo->exec("DROP TABLE IF EXISTS tmp_import");

        $colDefs = [];
        foreach ($headers as $h) {
            $hSafe = preg_replace('/[^a-zA-Z0-9_]/', '_', $h);
            $colDefs[] = "`$hSafe` TEXT NULL";
        }

        $createSQL = "
            CREATE TABLE tmp_import (
                tmp_import_ID INT AUTO_INCREMENT PRIMARY KEY COMMENT 'hidden',
                " . implode(",", $colDefs) . "
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ";
        $pdo->exec($createSQL);

        myLog("TMP-Tabelle tmp_import (TEXT) neu angelegt für $page");

        // -------------------------------
        // CSV-Daten in tmp_import einfügen
        // -------------------------------
        $count = 0;
        $rownum = 1;

        while (($row = fgetcsv($handle, 0, $delimiter, '"')) !== false) {
            if (count($row) !== count($headers)) {
                myLog("❗ Spaltenanzahl stimmt nicht in Zeile $rownum → " . implode(";", $row));
                $rownum++;
                continue;
            }

            $rowAssoc = array_combine($headers, $row);
            if (!$rowAssoc) {
                myLog("❗ array_combine fehlgeschlagen in Zeile $rownum");
                $rownum++;
                continue;
            }

            $columns = array_keys($rowAssoc);
            $placeholders = array_map(fn($c) => ':' . $c, $columns);

            $sql = "INSERT INTO tmp_import (" . implode(",", $columns) . ")
                    VALUES (" . implode(",", $placeholders) . ")";
            $stmt = $pdo->prepare($sql);

            foreach ($rowAssoc as $key => $value) {
                $stmt->bindValue(':' . $key, $value);
            }

            try {
                $stmt->execute();
                $count++;
            } catch (PDOException $e) {
                myLog("❌ DB-Fehler in Zeile $rownum: " . $e->getMessage());
            }
            $rownum++;
        }
        fclose($handle);

        // -------------------------------
        // Nachträglich ENUM- und FK-Spalten normalisieren + Fehler-Array für Vorschau
        // -------------------------------
        $_SESSION['import_errors'] = [];

        $schemaJson = file_get_contents("http://{$_SERVER['HTTP_HOST']}/api/get_schema.php?table={$page}");
        $userSchema = json_decode($schemaJson, true);

        $tmpCols = $pdo->query("SHOW COLUMNS FROM tmp_import")->fetchAll(PDO::FETCH_COLUMN);

        if ($userSchema && isset($userSchema['fields'])) {
            foreach ($userSchema['fields'] as $f) {
                $col = $f['name'];

                if (!empty($f['options']) && in_array($col, $tmpCols)) {
                    $validOptions = $f['options'];
                    $isFk = is_numeric($validOptions[0]['id']);

                    if ($isFk) {
                        // FK-Spalte
                        $labelMap = [];
                        foreach ($validOptions as $opt) {
                            $labelMap[strtolower(trim($opt['label']))] = $opt['id'];
                        }

                        $rows = $pdo->query("SELECT tmp_import_ID, `$col` FROM tmp_import")->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($rows as $r) {
                            $rowId = $r['tmp_import_ID'];
                            $val   = trim((string)$r[$col]);
                            if ($val === '') continue;

                            $low = strtolower($val);
                            if (isset($labelMap[$low])) {
                                $id = $labelMap[$low];
                                $stmt = $pdo->prepare("UPDATE tmp_import SET `$col` = :id WHERE tmp_import_ID = :rid");
                                $stmt->execute([':id' => $id, ':rid' => $rowId]);
                            } else {
                                $_SESSION['import_errors'][$rowId][$col] = $val;
                            }
                        }
                    } else {
                        // ENUM-Spalte
                        $enumIds = array_column($validOptions, 'id');
                        $normalized = [];
                        foreach ($enumIds as $opt) {
                            $normalized[strtolower(trim($opt))] = $opt;
                        }

                        foreach ($normalized as $lowVal => $corrected) {
                            $stmt = $pdo->prepare("UPDATE tmp_import 
                                                   SET `$col` = :c 
                                                   WHERE LOWER(TRIM(`$col`)) = :l");
                            $stmt->execute([':c' => $corrected, ':l' => $lowVal]);
                        }

                        $rows = $pdo->query("SELECT tmp_import_ID, `$col` FROM tmp_import")->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($rows as $r) {
                            $rowId = $r['tmp_import_ID'];
                            $val   = trim((string)$r[$col]);
                            if ($val !== '' && !in_array($val, $enumIds, true)) {
                                $_SESSION['import_errors'][$rowId][$col] = $val;
                            }
                        }

                        $enumVals = implode(",", array_map(fn($opt) => $pdo->quote($opt), $enumIds));
                        $alterSQL = "ALTER TABLE tmp_import MODIFY `$col` ENUM($enumVals) NULL";
                        try {
                            $pdo->exec($alterSQL);
                            myLog("Spalte $col → ENUM umgewandelt");
                        } catch (PDOException $e) {
                            myLog("❌ Konnte Spalte $col nicht ändern: " . $e->getMessage());
                        }
                    }
                }
            }
        }

        // -------------------------------
        // Weiterleitung
        // -------------------------------
        if ($count > 0) {
            $_SESSION['consoleLogs'] = $consoleLogs;
            header("Location: import.php?origin={$page}");
            exit;
        } else {
            $_SESSION['import_message'] = "⚠️ Kein Datensatz importiert. Bitte CSV prüfen.";
            $_SESSION['consoleLogs'] = $consoleLogs;
            header("Location: " . $_SERVER['PHP_SELF'] . "?page={$page}");
            exit;
        }
    } else {
        $message = "❌ Die Datei konnte nicht geöffnet werden.";
    }
}

// Schema für Header-Hinweis
$schemaJson = file_get_contents("http://{$_SERVER['HTTP_HOST']}/api/get_schema.php?table={$page}");
$schema = json_decode($schemaJson, true);

$felder = [];
if ($schema && isset($schema['fields'])) {
    foreach ($schema['fields'] as $field) {
        if (empty($field['hidden'])) {
            $felder[] = $field['name'];
        }
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>CSV-Import <?= $pagename ?></title>
  <link rel="stylesheet" href="../css/admin.css">
</head>
<body>
  <div class="import-container">
    <h2>CSV-Import <?= $pagename ?></h2>

    <?php if (!empty($message)): ?>
      <div class="import-message"><?= $message ?></div>
    <?php endif; ?>

    <form method="post" enctype="multipart/form-data" class="import-form">
      <input type="file" name="csvfile" accept=".csv" required>
      <button type="submit" class="import-button">CSV hochladen</button>
    </form>

    <div class="import-log">
      <p class="import-header">
        Die Datei muss UTF-8-kodiert sein und die Spalten in dieser Reihenfolge enthalten:
      </p>

      <pre id="csv-header" class="import-data"><?= htmlspecialchars(implode(";", $felder)) ?></pre>
      <div class="import-copy">
        <span id="copy-header-btn" class="import-copy-header-btn" title="Spaltenüberschrift kopieren">⧉</span>
      </div>
    </div>

    <div class="import-links">
      <a href="manage.php" class="button">Zurück zum Filtern</a>
    </div>
  </div>

  <script>
    document.addEventListener("DOMContentLoaded", () => {
      const icon = document.getElementById("copy-header-btn");
      if (!icon) return;
      icon.addEventListener("click", () => {
        const text = document.getElementById("csv-header").innerText.replace(/\n/g, ' ');
        navigator.clipboard.writeText(text).then(() => {
          const original = icon.textContent;
          icon.textContent = "✔";
          setTimeout(() => { icon.textContent = original; }, 1500);
        });
      });
    });
  </script>
</body>
</html>
