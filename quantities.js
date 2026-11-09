/* Pure quantity maths for the servings scaler. No DOM. Checked by test/qty.test.mjs. */

const QTY = (() => {
    const UNITS = {
        tsp: { one: "teaspoon", many: "teaspoons", ml: 4.92892 },
        tbsp: { one: "tablespoon", many: "tablespoons", ml: 14.7868 },
        cup: { one: "cup", many: "cups", ml: 236.588 },
        lb: { one: "pound", many: "pounds", g: 453.592 },
        bunch: { one: "bunch", many: "bunches" },
        can: { one: "can", many: "cans", whole: true },
        sheet: { one: "sheet", many: "sheets", whole: true },
        slice: { one: "slice", many: "slices", whole: true },
    };

    // Only fractions the site fonts carry: precomposed vulgar glyphs, else U+2044.
    const FRACTIONS = [
        [1 / 8, "1⁄8"], [1 / 6, "1⁄6"], [1 / 4, "¼"], [1 / 3, "1⁄3"],
        [3 / 8, "3⁄8"], [1 / 2, "½"], [5 / 8, "5⁄8"], [2 / 3, "2⁄3"],
        [3 / 4, "¾"], [5 / 6, "5⁄6"], [7 / 8, "7⁄8"],
    ];

    // A cookbook says "1 1/4", never "1.25".
    const fmtQty = (n) => {
        if (n === 0) return "0";
        const whole = Math.floor(n);
        const rest = n - whole;
        if (rest > 0.94) return String(whole + 1);
        // Scaled down far enough and the remainder sits below every fraction. A cookbook
        // says "1/8 bunch", never "0.04 bunch", and never drops the ingredient entirely.
        if (rest < 0.06) return whole ? String(whole) : FRACTIONS[0][1];
        const hit = FRACTIONS.reduce((best, f) =>
            Math.abs(rest - f[0]) < Math.abs(rest - best[0]) ? f : best);
        if (Math.abs(rest - hit[0]) > 0.055) return String(Math.round(n * 100) / 100);
        return whole ? `${whole} ${hit[1]}` : hit[1];
    };

    // Volume and weight only. Cans, sheets and bare counts have no metric form.
    const metric = (unit, qty) => {
        const u = UNITS[unit];
        if (!u || !(u.ml || u.g)) return null;
        const raw = (u.ml || u.g) * qty;
        const step = raw < 20 ? 1 : raw < 100 ? 5 : 10;
        return `${Math.round(raw / step) * step} ${u.ml ? "ml" : "g"}`;
    };

    // Whole units cannot be halved in a shop, so they round up.
    const label = (unit, qty) => {
        const u = UNITS[unit];
        const n = u && u.whole ? Math.ceil(qty - 1e-9) : qty;
        return u ? `${fmtQty(n)} ${n <= 1 ? u.one : u.many}` : fmtQty(n);
    };

    return { fmtQty, metric, label };
})();
