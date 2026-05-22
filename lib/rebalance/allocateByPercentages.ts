/** Allocate `total` items across DTs by percentage using largest-remainder method. */
export function allocateByPercentagesMap(
  total: number,
  activeDtIds: string[],
  percentages: Map<string, number>
): Map<string, number> {
  const out = new Map<string, number>();
  if (total <= 0 || activeDtIds.length === 0) {
    for (const dtId of activeDtIds) out.set(dtId, 0);
    return out;
  }

  const exact = activeDtIds.map((dtId) => ({
    dtId,
    exact: (total * (percentages.get(dtId) ?? 0)) / 100,
  }));
  const floor = exact.map((x) => Math.floor(x.exact));
  const remaining = total - floor.reduce((s, x) => s + x, 0);
  const frac = exact
    .map((x, i) => ({ i, frac: x.exact - Math.floor(x.exact) }))
    .sort((a, b) => b.frac - a.frac);

  for (let r = 0; r < remaining; r++) {
    floor[frac[r % frac.length].i]++;
  }

  activeDtIds.forEach((dtId, i) => out.set(dtId, floor[i]));
  return out;
}
