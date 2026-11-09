/* Stove-side controls. Progressive enhancement: every page reads correctly without this file. */

(() => {
    const list = document.querySelector(".ingredients[data-yield]");
    if (!list) return;

    const items = [...list.querySelectorAll("li[data-qty]")];
    const base = Number(list.dataset.yield);
    const noun = list.dataset.yieldNoun;
    const unitLabel = list.dataset.yieldLabel;
    const yieldOut = document.querySelector("[data-yield-out]");
    const seasoned = list.querySelector("[data-noscale]");

    let servings = base;
    let useMetric = false;

    /* ---- Servings and units ------------------------------------------- */

    const bar = document.createElement("div");
    bar.className = "cookbar";
    bar.innerHTML = `
        <div class="cookbar-group">
            <span class="label">${unitLabel}</span>
            <button class="ctl ctl--step" type="button" data-delta="-1"
                aria-label="Fewer ${unitLabel.toLowerCase()}">&minus;</button>
            <output class="cookbar-out" aria-live="polite"></output>
            <button class="ctl ctl--step" type="button" data-delta="1"
                aria-label="More ${unitLabel.toLowerCase()}">+</button>
        </div>
        <div class="cookbar-group">
            <span class="label">Units</span>
            <button class="ctl" type="button" data-units aria-pressed="false">Metric</button>
        </div>`;
    list.before(bar);

    const servingsOut = bar.querySelector(".cookbar-out");

    let note = null;
    if (seasoned) {
        note = document.createElement("p");
        note.className = "note";
        note.hidden = true;
        note.textContent = "Seasoning is held at the written amount. Taste as you go.";
        bar.after(note);
    }

    const render = () => {
        const factor = servings / base;
        for (const li of items) {
            const unit = li.dataset.unit;
            const qty = Number(li.dataset.qty) * (li.hasAttribute("data-noscale") ? 1 : factor);
            li.querySelector(".qty").textContent =
                (useMetric && QTY.metric(unit, qty)) || QTY.label(unit, qty);
            // Counted things carry their own plural ending: one avocado, two avocados.
            for (const s of li.querySelectorAll(".s")) s.hidden = qty <= 1;
        }
        servingsOut.value = String(servings);
        if (yieldOut) {
            yieldOut.textContent = noun
                ? `${servings} ${servings === 1 ? noun : `${noun}s`}`
                : String(servings);
        }
        if (note) note.hidden = servings === base;
    };

    /* ---- Screen wake lock: released whenever the tab hides ------------- */

    let wakeBtn = null;
    let lock = null;
    let wantWake = false;

    const setWake = async (on) => {
        wantWake = on;
        wakeBtn.setAttribute("aria-pressed", String(on));
        if (!on) {
            lock?.release();
            return;
        }
        try {
            lock = await navigator.wakeLock.request("screen");
            lock.addEventListener("release", () => { lock = null; });
        } catch {
            wantWake = false;
            wakeBtn.setAttribute("aria-pressed", "false");
            wakeBtn.textContent = "Screen lock blocked";
            wakeBtn.disabled = true;
        }
    };

    if ("wakeLock" in navigator) {
        const group = document.createElement("div");
        group.className = "cookbar-group";
        group.innerHTML =
            `<button class="ctl" type="button" data-wake aria-pressed="false">Keep screen on</button>`;
        bar.append(group);
        wakeBtn = group.querySelector("button");
        document.addEventListener("visibilitychange", () => {
            if (wantWake && !lock && document.visibilityState === "visible") setWake(true);
        });
    }

    bar.addEventListener("click", (event) => {
        const btn = event.target.closest("button");
        if (!btn) return;
        if (btn.dataset.delta) {
            servings = Math.min(24, Math.max(1, servings + Number(btn.dataset.delta)));
            render();
        } else if ("units" in btn.dataset) {
            useMetric = !useMetric;
            btn.setAttribute("aria-pressed", String(useMetric));
            render();
        } else if ("wake" in btn.dataset) {
            setWake(!wantWake);
        }
    });

    render();

    /* ---- Per-step timers ---------------------------------------------- */

    const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    const beep = () => {
        const ac = new AudioContext();
        const gain = ac.createGain();
        gain.gain.value = 0.0001;
        gain.connect(ac.destination);
        for (const at of [0, 0.3, 0.6]) {
            const osc = ac.createOscillator();
            osc.frequency.value = 880;
            osc.connect(gain);
            gain.gain.setValueAtTime(0.0001, ac.currentTime + at);
            gain.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + at + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 0.2);
            osc.start(ac.currentTime + at);
            osc.stop(ac.currentTime + at + 0.22);
        }
        setTimeout(() => ac.close(), 1400);
    };

    for (const li of document.querySelectorAll(".steps li[data-timer]")) {
        const total = Number(li.dataset.timer);
        const box = document.createElement("div");
        box.className = "timer";
        // An <output> is a live region by default. A countdown must not narrate every second.
        box.innerHTML =
            `<button class="ctl" type="button">Start ${mmss(total)}</button><output aria-live="off"></output>`;
        li.querySelector(".step").append(box);

        const btn = box.querySelector("button");
        const out = box.querySelector("output");
        let id = null;
        let deadline = 0;

        const idle = () => {
            clearInterval(id);
            id = null;
            btn.textContent = `Start ${mmss(total)}`;
        };

        const tick = () => {
            const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
            if (left) {
                out.value = mmss(left);
                return;
            }
            idle();
            box.classList.add("is-done");
            // Register the region first, then write, or the announcement is missed.
            out.setAttribute("aria-live", "polite");
            setTimeout(() => { out.value = "Time is up"; }, 50);
            beep();
        };

        btn.addEventListener("click", () => {
            if (id) {
                idle();
                out.value = "";
                return;
            }
            box.classList.remove("is-done");
            out.setAttribute("aria-live", "off");
            // Wall-clock deadline: setInterval drifts, and a backgrounded tab throttles it.
            deadline = Date.now() + total * 1000;
            btn.textContent = "Stop";
            tick();
            id = setInterval(tick, 250);
        });
    }

    /* ---- Ingredient and step cross-highlight --------------------------- */

    const main = document.querySelector("main");
    let lit = [];

    const light = (token) => {
        if (lit[0]?.dataset.ing === token) return;
        for (const el of lit) el.classList.remove("is-lit");
        lit = token ? [...main.querySelectorAll(`[data-ing="${token}"]`)] : [];
        for (const el of lit) el.classList.add("is-lit");
    };

    const lightFrom = (event) => light(event.target.closest("[data-ing]")?.dataset.ing);

    main.addEventListener("pointerover", lightFrom);
    main.addEventListener("focusin", lightFrom);
    main.addEventListener("pointerleave", () => light());
    main.addEventListener("focusout", (event) => {
        if (!main.contains(event.relatedTarget)) light();
    });
})();
