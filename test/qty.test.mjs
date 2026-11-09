/* node --test  (from the repo root). No dependencies, no runner config. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../quantities.js", import.meta.url), "utf8");
const { fmtQty, metric, label } = vm.runInNewContext(`${src};QTY`);

test("fractions render as cookbook numerals", () => {
    assert.equal(fmtQty(1.25), "1 ¼");
    assert.equal(fmtQty(0.25), "¼");
    assert.equal(fmtQty(2.5), "2 ½");
    assert.equal(fmtQty(0.375), "3⁄8");
    assert.equal(fmtQty(6), "6");
});

test("the closest fraction wins, not the first one in range", () => {
    assert.equal(fmtQty(1 / 3), "1⁄3");
    assert.equal(fmtQty(2 + 2 / 3), "2 2⁄3");
    // Halving a 6-serving pot is the common case: 1/6 must not collapse to 1/8.
    assert.equal(fmtQty(1 / 6), "1⁄6");
    assert.equal(fmtQty(1 / 8), "1⁄8");
});

test("float dust does not leak an extra fraction", () => {
    assert.equal(fmtQty(0.25 * 3 * 4 / 3), "1");
    assert.equal(fmtQty(2.999), "3");
});

test("quantities outside the fraction set fall back to decimals", () => {
    assert.equal(fmtQty(1.4375), "1.44");
});

test("a scaled-down amount never reads as a decimal or as nothing", () => {
    // 1/4 bunch of spinach split six ways. It used to render "0.04 bunch".
    assert.equal(fmtQty(0.25 / 6), "1⁄8");
    // The same quarter bunch times 23/6. It used to render "0.96 bunch".
    assert.equal(fmtQty(0.25 * 23 / 6), "1");
    assert.equal(label("bunch", 0.25 / 6), "1⁄8 bunch");
});

test("units pluralise on the scaled number, not the original", () => {
    assert.equal(label("lb", 1), "1 pound");
    assert.equal(label("lb", 2), "2 pounds");
    assert.equal(label("cup", 0.5), "½ cup");
});

test("whole units round up, they are not sold in halves", () => {
    assert.equal(label("can", 7.5), "8 cans");
    assert.equal(label("can", 5), "5 cans");
    assert.equal(label("slice", 2.4), "3 slices");
    // Float dust must not buy an extra can.
    assert.equal(label("can", 2.000000001), "2 cans");
});

test("bare counts carry no unit word", () => {
    assert.equal(label("", 9), "9");
    assert.equal(label("", 1.5), "1 ½");
});

test("metric converts volume and weight, and only those", () => {
    assert.equal(metric("cup", 1), "240 ml");
    assert.equal(metric("lb", 1), "450 g");
    assert.equal(metric("tsp", 1.25), "6 ml");
    assert.equal(metric("tbsp", 2), "30 ml");
    assert.equal(metric("can", 5), null);
    assert.equal(metric("", 6), null);
});
