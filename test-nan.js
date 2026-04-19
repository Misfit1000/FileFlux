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
  let scaleX = val !== undefined && val !== null && val.length > 0 ? Number(val[0]) : 12;
  if (!Number.isFinite(scaleX)) scaleX = 12;
  const size = Math.max(10, Math.round(Math.abs(scaleX) * 2)) || 24;
  console.log(`val: ${JSON.stringify(val)}, size: ${size}`);
}
