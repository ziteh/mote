import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deleteColumn,
  deleteRow,
  insertColumn,
  insertRow,
  parseTable,
  serializeTable,
  setAlign,
  setCell,
} from "./tablemodel.ts";

const SOURCE = "| a | b |\n|:---|---:|\n| 1 | 2 |";

function parse(source: string) {
  const model = parseTable(source);
  assert.ok(model);
  return model;
}

test("parses cells and alignment", () => {
  assert.deepEqual(parse(SOURCE), {
    aligns: ["left", "right"],
    rows: [
      ["a", "b"],
      ["1", "2"],
    ],
  });
});

test("parses rows without outer pipes", () => {
  assert.deepEqual(parse("a | b\n--- | :---:\n1 | 2").aligns, [null, "center"]);
});

test("pads short rows and drops extra cells", () => {
  const { rows } = parse("| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |");
  assert.deepEqual(rows.slice(1), [
    ["1", ""],
    ["1", "2"],
  ]);
});

test("rejects text without a delimiter row", () => {
  assert.equal(parseTable("| a | b |\n| 1 | 2 |"), null);
});

test("round-trips escaped pipes", () => {
  const source = "| a \\| b | c |\n| --- | --- |\n| `x \\| y` | |";
  const model = parse(source);
  assert.equal(model.rows[0][0], "a | b");
  assert.equal(
    serializeTable(model),
    "| a \\| b | c |\n| --- | --- |\n| `x \\| y` |  |",
  );
});

test("serializes compactly with alignment", () => {
  const model = parse("|名稱|數量|\n|:-:|--:|\n|香蕉|12|");
  assert.equal(
    serializeTable(model),
    "| 名稱 | 數量 |\n| :---: | ---: |\n| 香蕉 | 12 |",
  );
});

test("serialized output parses back to the same model", () => {
  const model = parse(SOURCE);
  assert.deepEqual(parse(serializeTable(model)), model);
});

test("edits cells, rows, columns and alignment", () => {
  const model = parse(SOURCE);
  assert.equal(setCell(model, 1, 0, "x").rows[1][0], "x");
  assert.deepEqual(insertRow(model, 1).rows[1], ["", ""]);
  assert.equal(deleteRow(model, 1).rows.length, 1);
  assert.deepEqual(insertColumn(model, 1).aligns, ["left", null, "right"]);
  assert.deepEqual(deleteColumn(model, 0).rows, [["b"], ["2"]]);
  assert.deepEqual(setAlign(model, 0, "center").aligns, ["center", "right"]);
});
