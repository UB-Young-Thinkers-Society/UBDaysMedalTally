<?php
// filepath: c:\xampp\htdocs\Medal Tally 2.0\login.php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = $_POST['username'];
    $password = $_POST['password'];

    // Hardcoded credentials
    if ($email === "lilkianie@gmail.com" && $password === "admin123") {
        // Redirect to tabulation-head.html on success
        header("Location: tabulation-head.html");
        exit();
    } else {
        // Redirect back to login.html with error (or show error)
        echo "<script>alert('Invalid email or password'); window.location.href='login.html';</script>";
        exit();
    }
}

?>
