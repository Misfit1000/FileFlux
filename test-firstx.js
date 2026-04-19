const testCases = [
  undefined,
  null,
  NaN,
  Infinity,
  -Infinity,
  "abc",
  "",
  "12",
  0,
  -10,
  {},
  [],
  [12],
  [NaN],
  [Infinity],
  ["abc"],
  [""],
  [{}],
  [[]]
];

for (const val of testCases) {
  let firstX = val !== undefined && val !== null && val.length > 4 ? Number(val[4]) : 0;
  if (!Number.isFinite(firstX)) firstX = 0;
  const indent = Math.max(0, Math.round(firstX * 20)) || 0;
  console.log(`val: ${JSON.stringify(val)}, indent: ${indent}`);
}
