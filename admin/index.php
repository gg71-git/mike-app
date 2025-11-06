<?php
session_start();
if (!isset($_SESSION['rolle'])) {
    header("Location: login.php");
    exit;
}
include 'includes/header.php';
include 'includes/nav.php';
?>

<div class='content-wrapper'>
    <section class='content-header'><h1>Dashboard</h1></section>
    <section class='content'><p>Willkommen im Adminbereich.</p></section>
</div>

<?php include 'includes/footer.php'; ?>