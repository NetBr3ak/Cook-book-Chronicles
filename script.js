if (document.readyState === "complete") {
    document.body.classList.add("loaded");
} else {
    window.addEventListener("load", function () {
        document.body.classList.add("loaded");
    });
}